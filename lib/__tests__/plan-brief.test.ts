import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { buildPlanBrief } from "../agent/planners/plan-brief";
import type { DecisionPlan, PlanOption } from "../types";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeOption(overrides: Partial<PlanOption> = {}): PlanOption {
  return {
    id: "opt1",
    label: "Main pick",
    option_category: "trip",
    title: "Fly to Chicago + stay at Grand Hotel",
    subtitle: "Delta | 4 star | Downtown",
    summary: "A solid weekend package.",
    why_this_now: "Best nonstop flight with a centrally located hotel.",
    best_for: "Couples wanting a city break",
    estimated_total: "$610",
    timing_note: "Arrives 5h before check-in — room may not be ready.",
    risks: ["Early arrival"],
    tradeoffs: ["Higher price than value option"],
    highlights: [
      "Delta JFK->ORD, 2h nonstop.",
      "Grand Hotel: $180/night near downtown.",
      "Chase Sapphire is the cleanest card fit.",
    ],
    score: 8.5,
    ...overrides,
  };
}

function makePlan(overrides: Partial<DecisionPlan> = {}): DecisionPlan {
  return {
    id: "plan-test-001",
    scenario: "weekend_trip",
    output_language: "en",
    title: "Chicago weekend trip",
    summary: "Bundled flight + hotel package.",
    approval_prompt: "Approve the package.",
    confidence: "high",
    scenario_brief: ["NYC to Chicago", "Apr 11-13"],
    primary_plan: makeOption(),
    backup_plans: [
      makeOption({ id: "backup1", label: "Backup 1", title: "Budget option", estimated_total: "$450", tradeoff_reason: "Slower flight" }),
    ],
    risks: ["Hotels book fast on spring weekends", "Early arrival — room may not be ready"],
    next_actions: [],
    evidence_card_ids: [],
    evidence_items: [],
    ...overrides,
  };
}

// ── buildPlanBrief unit tests ─────────────────────────────────────────────────

describe("buildPlanBrief", () => {
  it("includes the plan title", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("Chicago weekend trip");
  });

  it("includes estimated total", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("$610");
  });

  it("includes primary plan title", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("Fly to Chicago + stay at Grand Hotel");
  });

  it("includes highlights as bullet points", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("- Delta JFK->ORD");
    expect(brief).toContain("- Grand Hotel");
  });

  it("includes risks", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("Hotels book fast");
    expect(brief).toContain("Early arrival");
  });

  it("includes backup options", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("Budget option");
    expect(brief).toContain("Slower flight");
  });

  it("includes event_datetime formatted nicely when set", () => {
    const brief = buildPlanBrief(makePlan({ event_datetime: "2026-04-11T09:00:00" }));
    expect(brief).toContain("Apr 11, 2026");
  });

  it("includes event_location when set", () => {
    const brief = buildPlanBrief(makePlan({ event_location: "100 N Michigan Ave" }));
    expect(brief).toContain("100 N Michigan Ave");
  });

  it("includes trip_card_callout when set", () => {
    const brief = buildPlanBrief(makePlan({ trip_card_callout: "Pay with Chase Sapphire" }));
    expect(brief).toContain("💳 Pay with Chase Sapphire");
  });

  it("omits trip_card_callout section when not set", () => {
    const brief = buildPlanBrief(makePlan({ trip_card_callout: undefined }));
    expect(brief).not.toContain("💳");
  });

  it("includes plan ID in footer", () => {
    const brief = buildPlanBrief(makePlan());
    expect(brief).toContain("plan-test-001");
  });

  it("includes tradeoff_summary when set", () => {
    const brief = buildPlanBrief(makePlan({ tradeoff_summary: "Stable is the best all-around pick." }));
    expect(brief).toContain("Stable is the best all-around pick.");
  });

  it("works for date_night scenario", () => {
    const plan = makePlan({
      scenario: "date_night",
      title: "Date night at Trattoria Roma",
      event_datetime: "2026-04-12T19:30:00",
      event_location: "123 Main St",
      primary_plan: makeOption({
        title: "Trattoria Roma",
        estimated_total: "$120",
        option_category: "restaurant",
        highlights: ["Quiet Italian spot", "Best wine list in the neighborhood"],
      }),
    });
    const brief = buildPlanBrief(plan);
    expect(brief).toContain("Date night at Trattoria Roma");
    expect(brief).toContain("Apr 12, 2026");
    expect(brief).toContain("7:30 PM");
    expect(brief).toContain("123 Main St");
  });
});

// ── GET /api/plan/[id]/brief route tests ─────────────────────────────────────

vi.mock("@/lib/db", () => ({
  ensureDecisionPlansTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

import { GET } from "../../app/api/plan/[id]/brief/route";
import { sql } from "@/lib/db";

const mockSql = vi.mocked(sql);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, unknown>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

function makeGetRequest(planId = "plan-001") {
  return {
    req: new NextRequest(`http://localhost/api/plan/${planId}/brief`),
    params: Promise.resolve({ id: planId }),
  };
}

describe("GET /api/plan/[id]/brief", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when id is missing", async () => {
    const { req } = makeGetRequest("");
    const res = await GET(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when plan is not found", async () => {
    mockSql.mockResolvedValueOnce(qr([]));
    const { req, params } = makeGetRequest("missing");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 with text/plain content type", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: makePlan() }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("Content-Disposition header includes .md filename", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: makePlan() }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".md");
  });

  it("body contains plan title and primary plan title", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: makePlan() }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    const body = await res.text();
    expect(body).toContain("Chicago weekend trip");
    expect(body).toContain("Fly to Chicago");
  });
});
