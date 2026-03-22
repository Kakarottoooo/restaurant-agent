import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock DB ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  ensureFeedbackPromptsTable: vi.fn().mockResolvedValue(undefined),
  ensurePlanOutcomesTable: vi.fn().mockResolvedValue(undefined),
  ensureDecisionPlansTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

import { GET as cronGET } from "../../app/api/cron/feedback-prompts/route";
import { GET as promptsGET, POST as promptsPOST } from "../../app/api/feedback-prompts/route";
import { sql } from "@/lib/db";

const mockSql = vi.mocked(sql);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, unknown>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

// ── Cron route tests ──────────────────────────────────────────────────────────

describe("GET /api/cron/feedback-prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  function makeRequest() {
    return new NextRequest("http://localhost/api/cron/feedback-prompts", {
      headers: { Authorization: "Bearer test-secret" },
    });
  }

  it("returns 401 when Authorization header is missing", async () => {
    const req = new NextRequest("http://localhost/api/cron/feedback-prompts");
    const res = await cronGET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when wrong secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/feedback-prompts", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await cronGET(req);
    expect(res.status).toBe(401);
  });

  it("returns ok=true with created/skipped counts when no plans found", async () => {
    mockSql.mockResolvedValueOnce(qr([])); // no plans in window
    const res = await cronGET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.created).toBe(0);
    expect(json.skipped).toBe(0);
  });

  it("creates a prompt for a new plan", async () => {
    mockSql
      .mockResolvedValueOnce(qr([{ id: "plan-001", session_id: "sess-1", plan_json: {} }])) // plans in window
      .mockResolvedValueOnce(qr([]))   // no existing prompt
      .mockResolvedValueOnce(qr([]));  // INSERT

    const res = await cronGET(makeRequest());
    const json = await res.json();
    expect(json.created).toBe(1);
    expect(json.skipped).toBe(0);
  });

  it("skips a plan that already has a prompt", async () => {
    mockSql
      .mockResolvedValueOnce(qr([{ id: "plan-001", session_id: "sess-1", plan_json: {} }])) // plans in window
      .mockResolvedValueOnce(qr([{ id: 1 }])); // existing prompt found

    const res = await cronGET(makeRequest());
    const json = await res.json();
    expect(json.created).toBe(0);
    expect(json.skipped).toBe(1);
  });
});

// ── GET /api/feedback-prompts tests ──────────────────────────────────────────

describe("GET /api/feedback-prompts", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when session_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/feedback-prompts");
    const res = await promptsGET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty prompts array when none exist", async () => {
    mockSql.mockResolvedValueOnce(qr([]));
    const req = new NextRequest("http://localhost/api/feedback-prompts?session_id=sess-1");
    const res = await promptsGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.prompts).toEqual([]);
  });

  it("returns pending prompts with venue_name from plan_json", async () => {
    mockSql.mockResolvedValueOnce(qr([{
      id: 1,
      plan_id: "plan-001",
      user_session: "sess-1",
      scheduled_for: "2026-04-13T10:00:00Z",
      plan_json: { primary_plan: { title: "Trattoria Roma" }, scenario: "date_night" },
    }]));
    const req = new NextRequest("http://localhost/api/feedback-prompts?session_id=sess-1");
    const res = await promptsGET(req);
    const json = await res.json();
    expect(json.prompts).toHaveLength(1);
    expect(json.prompts[0].venue_name).toBe("Trattoria Roma");
    expect(json.prompts[0].scenario).toBe("date_night");
  });

  it("falls back to 'your plan' when primary_plan.title is missing", async () => {
    mockSql.mockResolvedValueOnce(qr([{
      id: 2,
      plan_id: "plan-002",
      user_session: "sess-1",
      scheduled_for: "2026-04-13T10:00:00Z",
      plan_json: {},
    }]));
    const req = new NextRequest("http://localhost/api/feedback-prompts?session_id=sess-1");
    const res = await promptsGET(req);
    const json = await res.json();
    expect(json.prompts[0].venue_name).toBe("your plan");
  });
});

// ── POST /api/feedback-prompts tests ─────────────────────────────────────────

describe("POST /api/feedback-prompts", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makePostRequest(body: object) {
    return new NextRequest("http://localhost/api/feedback-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when required fields are missing", async () => {
    const res = await promptsPOST(makePostRequest({ prompt_id: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating is invalid", async () => {
    const res = await promptsPOST(makePostRequest({
      prompt_id: 1,
      plan_id: "plan-001",
      session_id: "sess-1",
      feedback: { rating: "amazing" },
    }));
    expect(res.status).toBe(400);
  });

  it("records a 'great' feedback response and returns ok", async () => {
    mockSql
      .mockResolvedValueOnce(qr([])) // UPDATE feedback_prompts
      .mockResolvedValueOnce(qr([])); // INSERT plan_outcomes

    const res = await promptsPOST(makePostRequest({
      prompt_id: 1,
      plan_id: "plan-001",
      session_id: "sess-1",
      feedback: { rating: "great" },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("records 'ok' feedback with issues and returns ok", async () => {
    mockSql
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValueOnce(qr([]));

    const res = await promptsPOST(makePostRequest({
      prompt_id: 2,
      plan_id: "plan-002",
      session_id: "sess-2",
      feedback: { rating: "ok", issues: ["too_noisy", "too_expensive"] },
    }));
    expect(res.status).toBe(200);
  });

  it("records 'did_not_go' feedback and returns ok", async () => {
    mockSql
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValueOnce(qr([]));

    const res = await promptsPOST(makePostRequest({
      prompt_id: 3,
      plan_id: "plan-003",
      session_id: "sess-3",
      feedback: { rating: "did_not_go" },
    }));
    expect(res.status).toBe(200);
  });
});
