import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fetch ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Mock env ──────────────────────────────────────────────────────────────────
vi.stubEnv("TICKETMASTER_API_KEY", "test-api-key");

// ─────────────────────────────────────────────────────────────────────────────

import { searchConcertEvents } from "../ticketmaster";
import { parseConcertEventIntent } from "../agent/parse/concert-event";
import { runConcertEventPlanner } from "../agent/planners/concert-event";
import type { MultilingualQueryContext } from "../types";

const BASE_CONTEXT: MultilingualQueryContext = {
  input_language: "en",
  output_language: "en",
  normalized_query: "concert in NYC",
  intent_summary: "concert in NYC",
  location_hint: "New York, NY",
  scenario_hint: "concert_event",
};

const MOCK_EVENT = {
  id: "ev1",
  name: "Taylor Swift | The Eras Tour",
  url: "https://ticketmaster.com/event/ev1",
  dates: { start: { localDate: "2026-05-10", localTime: "20:00:00" } },
  _embedded: {
    venues: [
      {
        name: "Madison Square Garden",
        address: { line1: "4 Penn Plaza" },
        city: { name: "New York" },
      },
    ],
  },
  priceRanges: [{ min: 80, max: 400, currency: "USD" }],
  classifications: [{ genre: { name: "Pop" }, subGenre: { name: "Dance-Pop" } }],
  images: [{ url: "https://img.example.com/photo.jpg", width: 1024, ratio: "16_9" }],
};

function makeFetchResponse(events: unknown[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ _embedded: { events } }),
    text: () => Promise.resolve(""),
  });
}

// ── searchConcertEvents ───────────────────────────────────────────────────────

describe("searchConcertEvents", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns parsed events on success", async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse([MOCK_EVENT]));
    const events = await searchConcertEvents({ keyword: "Taylor Swift", city: "New York" });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Taylor Swift | The Eras Tour");
    expect(events[0].venue_name).toBe("Madison Square Garden");
    expect(events[0].date).toBe("2026-05-10");
    expect(events[0].time).toBe("20:00");
    expect(events[0].price_min).toBe(80);
    expect(events[0].price_max).toBe(400);
    expect(events[0].genre).toBe("Pop");
    expect(events[0].image_url).toBe("https://img.example.com/photo.jpg");
  });

  it("returns empty array when API responds with non-200", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 429, text: () => Promise.resolve("Rate limited") })
    );
    const events = await searchConcertEvents({ city: "New York" });
    expect(events).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const events = await searchConcertEvents({ city: "New York" });
    expect(events).toEqual([]);
  });

  it("filters out events missing name or url", async () => {
    const badEvent = { id: "bad", dates: { start: { localDate: "2026-05-10" } } };
    mockFetch.mockReturnValueOnce(makeFetchResponse([badEvent, MOCK_EVENT]));
    const events = await searchConcertEvents({});
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Taylor Swift | The Eras Tour");
  });

  it("returns empty array when no events in response", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") })
    );
    const events = await searchConcertEvents({});
    expect(events).toEqual([]);
  });
});

// ── parseConcertEventIntent ───────────────────────────────────────────────────

describe("parseConcertEventIntent", () => {
  it("extracts artist name from 'see Taylor Swift concert'", () => {
    const intent = parseConcertEventIntent("I want to see Taylor Swift concert in NYC", {
      ...BASE_CONTEXT,
      location_hint: "New York, NY",
    });
    expect(intent.scenario).toBe("concert_event");
    expect(intent.keyword).toMatch(/Taylor Swift/i);
    expect(intent.event_city).toBe("New York, NY");
    expect(intent.event_type).toBe("concert");
  });

  it("falls back to genre when no artist name found", () => {
    const intent = parseConcertEventIntent("find me a jazz show in NYC", BASE_CONTEXT);
    expect(intent.keyword).toBe("jazz");
    expect(intent.event_type).toBe("concert");
  });

  it("detects festival type", () => {
    const intent = parseConcertEventIntent("music festival this weekend in Austin", {
      ...BASE_CONTEXT,
      location_hint: "Austin, TX",
    });
    expect(intent.event_type).toBe("festival");
  });

  it("detects sports type", () => {
    const intent = parseConcertEventIntent("NBA game in Chicago", {
      ...BASE_CONTEXT,
      location_hint: "Chicago, IL",
    });
    expect(intent.event_type).toBe("sports");
  });

  it("uses party_size_hint for travelers", () => {
    const intent = parseConcertEventIntent("concert tickets for 4 people", {
      ...BASE_CONTEXT,
      party_size_hint: 4,
    });
    expect(intent.travelers).toBe(4);
  });

  it("uses location fallback when no location_hint", () => {
    const intent = parseConcertEventIntent("find me a concert", {
      ...BASE_CONTEXT,
      location_hint: undefined,
    });
    expect(intent.event_city).toBeDefined();
    expect(intent.missing_fields).toContain("city");
  });

  it("resolves this weekend to a future date string", () => {
    const intent = parseConcertEventIntent("concert this weekend", {
      ...BASE_CONTEXT,
      date_text_hint: "this weekend",
    });
    // Should produce a YYYY-MM-DD string in the future (or today)
    expect(intent.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const eventMs = new Date(intent.event_date! + "T12:00:00").getTime();
    expect(eventMs).toBeGreaterThan(Date.now() - 7 * 86400000); // within last 7 days at most
  });
});

// ── runConcertEventPlanner ────────────────────────────────────────────────────

describe("runConcertEventPlanner", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns null when Ticketmaster returns no events", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") })
    );
    const intent = parseConcertEventIntent("concert in NYC", BASE_CONTEXT);
    const plan = await runConcertEventPlanner({ intent, outputLanguage: "en" });
    expect(plan).toBeNull();
  });

  it("returns a DecisionPlan with up to 3 options", async () => {
    const events = [
      MOCK_EVENT,
      { ...MOCK_EVENT, id: "ev2", name: "Billie Eilish Live" },
      { ...MOCK_EVENT, id: "ev3", name: "Coldplay World Tour" },
      { ...MOCK_EVENT, id: "ev4", name: "Extra Event" },
    ];
    mockFetch.mockReturnValueOnce(makeFetchResponse(events));
    const intent = parseConcertEventIntent("concert in NYC", BASE_CONTEXT);
    const plan = await runConcertEventPlanner({ intent, outputLanguage: "en" });
    expect(plan).not.toBeNull();
    expect(plan!.scenario).toBe("concert_event");
    expect(plan!.backup_plans.length).toBeLessThanOrEqual(2);
    expect(plan!.primary_plan.title).toBeDefined();
    expect(plan!.primary_plan.primary_action?.url).toContain("ticketmaster.com");
  });

  it("deduplicates events with the same name", async () => {
    const duplicate = { ...MOCK_EVENT, id: "ev1b" }; // same name as MOCK_EVENT
    mockFetch.mockReturnValueOnce(makeFetchResponse([MOCK_EVENT, duplicate]));
    const intent = parseConcertEventIntent("concert in NYC", BASE_CONTEXT);
    const plan = await runConcertEventPlanner({ intent, outputLanguage: "en" });
    expect(plan).not.toBeNull();
    // Only 1 unique event → primary only, no backups
    expect(plan!.backup_plans).toHaveLength(0);
  });

  it("sets event_datetime from the first event's date and time", async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse([MOCK_EVENT]));
    const intent = parseConcertEventIntent("Taylor Swift NYC", BASE_CONTEXT);
    const plan = await runConcertEventPlanner({ intent, outputLanguage: "en" });
    expect(plan!.event_datetime).toContain("2026-05-10");
    expect(plan!.event_location).toBe("Madison Square Garden");
  });

  it("builds Chinese output when outputLanguage is zh", async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse([MOCK_EVENT]));
    const intent = parseConcertEventIntent("concert in NYC", { ...BASE_CONTEXT, output_language: "zh" });
    const plan = await runConcertEventPlanner({ intent, outputLanguage: "zh" });
    expect(plan!.output_language).toBe("zh");
    expect(plan!.primary_plan.why_this_now).toMatch(/购票|活动|名额/);
  });
});
