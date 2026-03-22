import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  ensurePlanOutcomesTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-abc" }),
}));

import { POST, GET } from "../../app/api/plan/[id]/outcome/route";
import { sql, ensurePlanOutcomesTable } from "@/lib/db";

const mockSql = vi.mocked(sql);
// Helper to build a minimal QueryResult-compatible mock return value
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, string>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

function makePostRequest(body: object, planId = "plan-001") {
  return {
    req: new NextRequest(`http://localhost/api/plan/${planId}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id: planId }),
  };
}

describe("POST /api/plan/[id]/outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // First call: plan existence check (returns empty = unknown plan)
    // Second call: INSERT
    mockSql
      .mockResolvedValueOnce(qr([{ id: "plan-001" }]))
      .mockResolvedValue(qr([]));
  });

  it("records a valid outcome and returns ok", async () => {
    const { req, params } = makePostRequest({ outcome_type: "went" });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(ensurePlanOutcomesTable).toHaveBeenCalled();
  });

  it("accepts all valid outcome_type values", async () => {
    const validTypes = ["went", "skipped", "rated_positive", "rated_negative", "partner_approved"];
    for (const outcome_type of validTypes) {
      vi.clearAllMocks();
      mockSql
        .mockResolvedValueOnce(qr([{ id: "plan-001" }]))
        .mockResolvedValue(qr([]));
      const { req, params } = makePostRequest({ outcome_type });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
    }
  });

  it("returns 400 for an invalid outcome_type", async () => {
    const { req, params } = makePostRequest({ outcome_type: "hacked" });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 when outcome_type is missing", async () => {
    const { req, params } = makePostRequest({});
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it("still records outcome for unknown plan_id (never drops signals)", async () => {
    mockSql.mockReset();
    // plan check returns empty (unknown plan)
    mockSql
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValue(qr([]));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { req, params } = makePostRequest({ outcome_type: "went" }, "unknown-plan");
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown-plan"));
    warnSpy.mockRestore();
  });

  it("accepts nullable session_id for calendar deep-link outcomes", async () => {
    const { req, params } = makePostRequest({ outcome_type: "went", session_id: null });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/plan/[id]/outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql
      .mockResolvedValueOnce(qr([{ id: "plan-001" }]))
      .mockResolvedValue(qr([]));
  });

  it("records outcome from query param and redirects to plan page", async () => {
    const planId = "plan-001";
    const req = new NextRequest(
      `http://localhost/api/plan/${planId}/outcome?type=went`
    );
    const res = await GET(req, { params: Promise.resolve({ id: planId }) });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(`/plan/${planId}?outcome=recorded`);
  });

  it("redirects even for invalid outcome type without inserting", async () => {
    const planId = "plan-001";
    const req = new NextRequest(
      `http://localhost/api/plan/${planId}/outcome?type=invalid`
    );
    vi.clearAllMocks();
    const res = await GET(req, { params: Promise.resolve({ id: planId }) });
    // Should redirect (not crash)
    expect(res.status).toBe(307);
    // Should NOT have called ensurePlanOutcomesTable (invalid type, no insert)
    expect(ensurePlanOutcomesTable).not.toHaveBeenCalled();
  });
});
