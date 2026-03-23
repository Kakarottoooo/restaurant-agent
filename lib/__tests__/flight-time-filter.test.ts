/**
 * G-1: Flight time-of-day filtering tests
 * Tests the filterByTime logic with mock flight data in both 12-hour and 24-hour formats.
 */

import { Flight, FlightIntent } from "../types";

// ─── Inline copy of the filter helpers (mirrors flight pipeline) ──────────────

function parseHHMM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function filterByTime(flights: Flight[], intent: FlightIntent): Flight[] {
  const avoidRedEye = intent.avoid_red_eye;
  const earliest = intent.earliest_departure ? parseHHMM(intent.earliest_departure) : null;
  const latest = intent.latest_departure ? parseHHMM(intent.latest_departure) : null;

  if (!avoidRedEye && earliest === null && latest === null) return flights;

  const filtered = flights.filter((f) => {
    if (!f.departure_time) return true;
    let minutes: number;
    if (f.departure_time.toUpperCase().includes("PM") || f.departure_time.toUpperCase().includes("AM")) {
      const [hm, period] = f.departure_time.split(/\s+/);
      const [hh, mm] = hm.split(":").map(Number);
      let hour = hh % 12;
      if (period?.toUpperCase() === "PM") hour += 12;
      minutes = hour * 60 + (mm ?? 0);
    } else {
      const raw = f.departure_time.trim();
      minutes = parseHHMM(raw);
    }
    if (avoidRedEye && minutes >= 0 && minutes < 6 * 60) return false;
    if (earliest !== null && minutes < earliest) return false;
    if (latest !== null && minutes > latest) return false;
    return true;
  });

  return filtered.length > 0 ? filtered : flights;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFlight(id: string, departure_time: string): Flight {
  return {
    id,
    airline: "Test Air",
    departure_airport: "JFK",
    arrival_airport: "LAX",
    departure_city: "New York",
    arrival_city: "Los Angeles",
    departure_time,
    arrival_time: "12:00",
    duration: "6h",
    stops: 0,
    price: 300,
    booking_link: "https://example.com",
  };
}

const baseIntent: FlightIntent = { category: "flight" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("filterByTime — no filters", () => {
  it("returns all flights when no time constraints set", () => {
    const flights = [makeFlight("1", "05:00"), makeFlight("2", "10:00"), makeFlight("3", "22:00")];
    expect(filterByTime(flights, baseIntent)).toHaveLength(3);
  });
});

describe("filterByTime — avoid_red_eye (24h format)", () => {
  const intent: FlightIntent = { ...baseIntent, avoid_red_eye: true };

  it("excludes midnight flight (00:00)", () => {
    const flights = [makeFlight("a", "00:00"), makeFlight("b", "08:00")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });

  it("excludes 03:30 red-eye", () => {
    const flights = [makeFlight("a", "03:30"), makeFlight("b", "07:00")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });

  it("keeps 06:00 exactly (boundary — 06:00 is NOT red-eye)", () => {
    const flights = [makeFlight("a", "05:59"), makeFlight("b", "06:00")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });

  it("falls back to all flights if all are red-eye", () => {
    const flights = [makeFlight("a", "01:00"), makeFlight("b", "03:00")];
    const result = filterByTime(flights, intent);
    expect(result).toHaveLength(2); // fallback
  });
});

describe("filterByTime — avoid_red_eye (12-hour format)", () => {
  const intent: FlightIntent = { ...baseIntent, avoid_red_eye: true };

  it("excludes 2:30 AM", () => {
    const flights = [makeFlight("a", "2:30 AM"), makeFlight("b", "9:00 AM")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });

  it("keeps 12:00 PM (noon)", () => {
    const flights = [makeFlight("a", "12:00 PM"), makeFlight("b", "11:00 PM")];
    const result = filterByTime(flights, intent);
    expect(result).toHaveLength(2);
  });

  it("excludes 12:00 AM (midnight in 12h format)", () => {
    // 12:00 AM = 0 minutes = midnight
    const flights = [makeFlight("a", "12:00 AM"), makeFlight("b", "8:00 AM")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b"]);
  });
});

describe("filterByTime — earliest_departure", () => {
  it("excludes flights before 08:00 (24h)", () => {
    const intent: FlightIntent = { ...baseIntent, earliest_departure: "08:00" };
    const flights = [makeFlight("a", "07:59"), makeFlight("b", "08:00"), makeFlight("c", "10:00")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b", "c"]);
  });

  it("excludes flights before 07:00 (12h AM format)", () => {
    const intent: FlightIntent = { ...baseIntent, earliest_departure: "07:00" };
    const flights = [makeFlight("a", "6:30 AM"), makeFlight("b", "7:00 AM"), makeFlight("c", "9:00 AM")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["b", "c"]);
  });
});

describe("filterByTime — latest_departure", () => {
  it("excludes flights after 21:00 (24h)", () => {
    const intent: FlightIntent = { ...baseIntent, latest_departure: "21:00" };
    const flights = [makeFlight("a", "20:59"), makeFlight("b", "21:00"), makeFlight("c", "21:01")];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("excludes 9:30 PM when latest is 21:00 (12h PM format)", () => {
    const intent: FlightIntent = { ...baseIntent, latest_departure: "21:00" };
    const flights = [makeFlight("a", "8:00 PM"), makeFlight("b", "9:30 PM")];
    // 8:00 PM = 20:00 = 1200min, 9:30 PM = 21:30 = 1290min
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["a"]);
  });
});

describe("filterByTime — combined filters", () => {
  it("applies red-eye + earliest + latest together", () => {
    const intent: FlightIntent = {
      ...baseIntent,
      avoid_red_eye: true,
      earliest_departure: "07:00",
      latest_departure: "20:00",
    };
    const flights = [
      makeFlight("a", "03:00"), // red-eye
      makeFlight("b", "06:30"), // before earliest
      makeFlight("c", "09:00"), // OK
      makeFlight("d", "20:00"), // OK (boundary)
      makeFlight("e", "21:00"), // after latest
    ];
    const result = filterByTime(flights, intent);
    expect(result.map((f) => f.id)).toEqual(["c", "d"]);
  });

  it("keeps flights with no departure_time (no data = keep)", () => {
    const intent: FlightIntent = { ...baseIntent, avoid_red_eye: true };
    const flight = { ...makeFlight("a", ""), departure_time: "" };
    // departure_time is empty string — treated as no data
    const result = filterByTime([flight], intent);
    // empty string is falsy, so it's kept
    expect(result).toHaveLength(1);
  });
});
