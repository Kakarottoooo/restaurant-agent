import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  ensureDecisionPlansTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

import { GET } from "../../app/api/plan/[id]/calendar/route";
import { sql } from "@/lib/db";

const mockSql = vi.mocked(sql);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, unknown>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

function makeGetRequest(planId = "plan-001") {
  return {
    req: new NextRequest(`http://localhost/api/plan/${planId}/calendar`),
    params: Promise.resolve({ id: planId }),
  };
}

const basePlan = {
  id: "plan-001",
  scenario: "date_night",
  title: "Date night at Trattoria Roma",
  summary: "Romantic dinner for two",
  event_datetime: "2026-04-12T19:30:00",
  event_location: "123 Main St",
};

describe("GET /api/plan/[id]/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is missing", async () => {
    const { req, params } = makeGetRequest("");
    const res = await GET(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when plan is not found", async () => {
    mockSql.mockResolvedValueOnce(qr([]));
    const { req, params } = makeGetRequest("missing-plan");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns 422 when plan has no event_datetime", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: { ...basePlan, event_datetime: undefined } }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    expect(res.status).toBe(422);
  });

  it("returns 200 with text/calendar content type", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: basePlan }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
  });

  it("ICS body contains VEVENT with SUMMARY and LOCATION", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: basePlan }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:Date night at Trattoria Roma");
    expect(body).toContain("LOCATION:123 Main St");
    expect(body).toContain("END:VEVENT");
    expect(body).toContain("END:VCALENDAR");
  });

  it("ICS body contains DTSTART with the event datetime", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: basePlan }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    const body = await res.text();
    expect(body).toContain("DTSTART:");
    // 2026-04-12T19:30:00 → 20260412T193000 (floating local time, no Z)
    expect(body).toMatch(/DTSTART:20260412T193000/);
  });

  it("Content-Disposition header includes .ics filename", async () => {
    mockSql.mockResolvedValueOnce(qr([{ plan_json: basePlan }]));
    const { req, params } = makeGetRequest("plan-001");
    const res = await GET(req, { params });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".ics");
  });
});
