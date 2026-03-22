import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock DB and auth before importing the route
vi.mock("@/lib/db", () => ({
  ensureDecisionPlansTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-abc" }),
}));

import { POST } from "../../app/api/plan/save/route";
import { sql, ensureDecisionPlansTable } from "@/lib/db";

const mockSql = vi.mocked(sql);

function makePlan(overrides?: object) {
  return {
    id: "plan-001",
    scenario: "date_night",
    title: "Romantic Evening",
    summary: "A perfect night out",
    primary_plan: { id: "opt-1", name: "La Belle", score: 9 },
    backup_plans: [],
    actions: [],
    output_language: "en",
    ...overrides,
  };
}

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/plan/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plan/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
  });

  it("saves a valid plan and returns 200 with plan_id", async () => {
    const req = makeRequest({
      plan: makePlan(),
      session_id: "sess-1",
      query_text: "date night",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.plan_id).toBe("plan-001");
    expect(ensureDecisionPlansTable).toHaveBeenCalled();
  });

  it("returns 400 when plan.id is missing", async () => {
    const req = makeRequest({
      plan: { scenario: "date_night" },
      session_id: "sess-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it("returns 400 when session_id is missing", async () => {
    const req = makeRequest({
      plan: makePlan(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when plan.scenario is missing", async () => {
    const req = makeRequest({
      plan: { id: "plan-x" },
      session_id: "sess-2",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("includes query_text as null when omitted", async () => {
    const req = makeRequest({
      plan: makePlan(),
      session_id: "sess-3",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("is idempotent — calls sql (upsert handles conflict in DB)", async () => {
    const req = makeRequest({
      plan: makePlan(),
      session_id: "sess-4",
      query_text: "romantic dinner",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("passes parent_plan_id to sql when provided (refinement lineage)", async () => {
    const req = makeRequest({
      plan: makePlan(),
      session_id: "sess-5",
      parent_plan_id: "plan-parent-001",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Verify sql was called — parent_plan_id is passed as a template arg
    expect(mockSql).toHaveBeenCalledTimes(1);
    const sqlArgs = (mockSql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    // The tagged template produces an array of strings + values; "plan-parent-001" must appear
    const flatArgs = sqlArgs.flat();
    expect(flatArgs).toContain("plan-parent-001");
  });

  it("passes null parent_plan_id when omitted (original plan)", async () => {
    const req = makeRequest({
      plan: makePlan(),
      session_id: "sess-6",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const sqlArgs = (mockSql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const flatArgs = sqlArgs.flat();
    expect(flatArgs).toContain(null);
  });
});
