import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock DB ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  ensurePriceWatchesTable: vi.fn().mockResolvedValue(undefined),
  ensurePlanOutcomesTable: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));

import { GET as watchGET, POST as watchPOST } from "../../app/api/plan/[id]/price-watch/route";
import { GET as cronGET } from "../../app/api/cron/price-check/route";
import { sql } from "@/lib/db";

const mockSql = vi.mocked(sql);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qr = (rows: Record<string, unknown>[]) => ({ rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }) as any;

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── POST /api/plan/[id]/price-watch ─────────────────────────────────────────

describe("POST /api/plan/[id]/price-watch", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makePost(body: object) {
    return new NextRequest("http://localhost/api/plan/plan-001/price-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when session_id is missing", async () => {
    const res = await watchPOST(makePost({ items: [{ item_type: "hotel", item_key: "h1", item_label: "Hotel A", last_known_price: 200 }] }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when items array is empty", async () => {
    const res = await watchPOST(makePost({ session_id: "sess-1", items: [] }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when item has invalid type", async () => {
    const res = await watchPOST(makePost({
      session_id: "sess-1",
      items: [{ item_type: "restaurant", item_key: "r1", item_label: "R", last_known_price: 100 }],
    }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when last_known_price is zero", async () => {
    const res = await watchPOST(makePost({
      session_id: "sess-1",
      items: [{ item_type: "hotel", item_key: "h1", item_label: "Hotel A", last_known_price: 0 }],
    }), makeCtx("plan-001"));
    expect(res.status).toBe(400);
  });

  it("creates a new watch and returns created=1", async () => {
    mockSql
      .mockResolvedValueOnce(qr([]))   // no existing watch
      .mockResolvedValueOnce(qr([]));  // INSERT

    const res = await watchPOST(makePost({
      session_id: "sess-1",
      items: [{ item_type: "hotel", item_key: "h1", item_label: "Grand Hyatt", last_known_price: 250 }],
    }), makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(1);
    expect(json.skipped).toBe(0);
  });

  it("skips if watch already exists for the item_key", async () => {
    mockSql.mockResolvedValueOnce(qr([{ id: 1 }])); // existing watch found

    const res = await watchPOST(makePost({
      session_id: "sess-1",
      items: [{ item_type: "hotel", item_key: "h1", item_label: "Grand Hyatt", last_known_price: 250 }],
    }), makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(0);
    expect(json.skipped).toBe(1);
  });
});

// ── GET /api/plan/[id]/price-watch ───────────────────────────────────────────

describe("GET /api/plan/[id]/price-watch", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty watches array when none exist", async () => {
    mockSql.mockResolvedValueOnce(qr([]));
    const req = new NextRequest("http://localhost/api/plan/plan-001/price-watch");
    const res = await watchGET(req, makeCtx("plan-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.watches).toEqual([]);
  });

  it("returns watches for the plan", async () => {
    mockSql.mockResolvedValueOnce(qr([{
      id: 1, item_type: "hotel", item_label: "Grand Hyatt",
      last_known_price: "250.00", last_checked_at: null,
    }]));
    const req = new NextRequest("http://localhost/api/plan/plan-001/price-watch");
    const res = await watchGET(req, makeCtx("plan-001"));
    const json = await res.json();
    expect(json.watches).toHaveLength(1);
    expect(json.watches[0].item_label).toBe("Grand Hyatt");
  });
});

// ── GET /api/cron/price-check ────────────────────────────────────────────────

describe("GET /api/cron/price-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  function makeRequest() {
    return new NextRequest("http://localhost/api/cron/price-check", {
      headers: { Authorization: "Bearer test-secret" },
    });
  }

  it("returns 401 when Authorization header is missing", async () => {
    const req = new NextRequest("http://localhost/api/cron/price-check");
    const res = await cronGET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when wrong secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/price-check", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await cronGET(req);
    expect(res.status).toBe(401);
  });

  it("returns ok=true with counts when no watches exist", async () => {
    mockSql.mockResolvedValueOnce(qr([])); // no watches
    const res = await cronGET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checked).toBe(0);
  });

  it("skips watches with no search_params", async () => {
    mockSql
      .mockResolvedValueOnce(qr([{
        id: 1, plan_id: "p1", session_id: "s1",
        item_type: "hotel", item_key: "h1", item_label: "Hotel A",
        last_known_price: "200.00", threshold_pct: "10.00", search_params: null,
      }]))
      .mockResolvedValueOnce(qr([])); // UPDATE last_checked_at

    const res = await cronGET(makeRequest());
    const json = await res.json();
    expect(json.checked).toBe(1);
    expect(json.skipped).toBe(1);
    expect(json.drops).toBe(0);
  });
});
