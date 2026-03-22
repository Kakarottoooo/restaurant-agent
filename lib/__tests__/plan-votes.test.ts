import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock DB ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  ensurePlanVotesTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

import { GET, POST } from "../../app/api/plan/[id]/vote/route";
import { sql } from "@/lib/db";

const mockSql = vi.mocked(sql);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, unknown>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── GET /api/plan/[id]/vote ────────────────────────────────────────────────

describe("GET /api/plan/[id]/vote", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty tally when no votes exist", async () => {
    mockSql.mockResolvedValueOnce(qr([]));
    const req = new NextRequest("http://localhost/api/plan/plan-001/vote");
    const res = await GET(req, makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tally).toEqual({});
  });

  it("returns tally aggregated by option_id", async () => {
    mockSql.mockResolvedValueOnce(qr([
      { option_id: "opt-a", count: "3" },
      { option_id: "opt-b", count: "1" },
    ]));
    const req = new NextRequest("http://localhost/api/plan/plan-001/vote");
    const res = await GET(req, makeCtx("plan-001"));
    const json = await res.json();
    expect(json.tally).toEqual({ "opt-a": 3, "opt-b": 1 });
  });
});

// ── POST /api/plan/[id]/vote ───────────────────────────────────────────────

describe("POST /api/plan/[id]/vote", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makePost(body: object) {
    return new NextRequest("http://localhost/api/plan/plan-001/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when voter_session is missing", async () => {
    const res = await POST(makePost({ option_id: "opt-a" }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when option_id is missing", async () => {
    const res = await POST(makePost({ voter_session: "vs_abc" }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("records a vote and returns updated tally", async () => {
    mockSql
      .mockResolvedValueOnce(qr([]))  // INSERT (upsert)
      .mockResolvedValueOnce(qr([{ option_id: "opt-a", count: "2" }])); // tally query

    const res = await POST(makePost({ voter_session: "vs_abc", option_id: "opt-a" }), makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.tally).toEqual({ "opt-a": 2 });
  });

  it("allows a voter to change their vote (upsert)", async () => {
    mockSql
      .mockResolvedValueOnce(qr([]))  // upsert succeeds
      .mockResolvedValueOnce(qr([
        { option_id: "opt-a", count: "1" },
        { option_id: "opt-b", count: "1" },
      ]));

    const res = await POST(makePost({ voter_session: "vs_abc", option_id: "opt-b" }), makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tally["opt-b"]).toBe(1);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/plan/plan-001/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });
});
