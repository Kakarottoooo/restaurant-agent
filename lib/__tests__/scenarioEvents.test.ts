import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveScenarioEventsQuery } from "../scenarioEvents";

// ─── resolveScenarioEventsQuery ───────────────────────────────────────────────
// Tests query parsing and clamping without hitting the DB or auth layer.

describe("resolveScenarioEventsQuery", () => {
  it("defaults to 14 days and 25 limit with empty params", () => {
    const result = resolveScenarioEventsQuery({});
    expect(result.days).toBe(14);
    expect(result.limit).toBe(25);
    expect(result.scenario).toBeUndefined();
  });

  it("parses valid days parameter", () => {
    const result = resolveScenarioEventsQuery({ days: "7" });
    expect(result.days).toBe(7);
  });

  it("clamps days to max 90", () => {
    const result = resolveScenarioEventsQuery({ days: "999" });
    expect(result.days).toBe(90);
  });

  it("clamps days to min 1", () => {
    const result = resolveScenarioEventsQuery({ days: "0" });
    expect(result.days).toBe(1);
  });

  it("falls back to default days for non-numeric input", () => {
    const result = resolveScenarioEventsQuery({ days: "abc" });
    expect(result.days).toBe(14);
  });

  it("parses valid limit parameter", () => {
    const result = resolveScenarioEventsQuery({ limit: "50" });
    expect(result.limit).toBe(50);
  });

  it("clamps limit to max 100", () => {
    const result = resolveScenarioEventsQuery({ limit: "999" });
    expect(result.limit).toBe(100);
  });

  it("clamps limit to min 1", () => {
    const result = resolveScenarioEventsQuery({ limit: "0" });
    expect(result.limit).toBe(1);
  });

  it("accepts valid scenario filter: date_night", () => {
    const result = resolveScenarioEventsQuery({ scenario: "date_night" });
    expect(result.scenario).toBe("date_night");
  });

  it("accepts valid scenario filter: weekend_trip", () => {
    const result = resolveScenarioEventsQuery({ scenario: "weekend_trip" });
    expect(result.scenario).toBe("weekend_trip");
  });

  it("accepts valid scenario filter: big_purchase", () => {
    const result = resolveScenarioEventsQuery({ scenario: "big_purchase" });
    expect(result.scenario).toBe("big_purchase");
  });

  it("rejects invalid scenario value — returns undefined", () => {
    const result = resolveScenarioEventsQuery({ scenario: "invalid_scenario" });
    expect(result.scenario).toBeUndefined();
  });

  it("accepts URLSearchParams input", () => {
    const params = new URLSearchParams("days=30&limit=10&scenario=date_night");
    const result = resolveScenarioEventsQuery(params);
    expect(result.days).toBe(30);
    expect(result.limit).toBe(10);
    expect(result.scenario).toBe("date_night");
  });
});

// ─── requireInternalAnalyticsAccess — production guard ───────────────────────
// Tests the security fix: open analytics endpoint must be blocked in production.
// Uses vi.stubEnv to safely set NODE_ENV without descriptor conflicts.

describe("requireInternalAnalyticsAccess (production guard)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks access in production when Clerk is not configured", async () => {
    // Regression: ISSUE-002-security — analytics open when Clerk unconfigured in production
    // Found by /plan-eng-review on 2026-03-21
    vi.stubEnv("NODE_ENV", "production");
    // Ensure Clerk env vars are absent (no pk_ / sk_ prefix)
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");

    const { requireInternalAnalyticsAccess } = await import("../scenarioEvents");
    const result = await requireInternalAnalyticsAccess();
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});
