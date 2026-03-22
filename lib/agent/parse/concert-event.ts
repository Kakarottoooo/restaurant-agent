import { ConcertEventIntent, MultilingualQueryContext } from "../../types";

const CONCERT_EVENT_TYPES = ["concert", "festival", "theater", "sports", "comedy", "other"] as const;
type EventType = typeof CONCERT_EVENT_TYPES[number];

function detectEventType(lower: string): EventType {
  if (/\bfestival\b/.test(lower)) return "festival";
  if (/\btheater\b|\btheatre\b|\bmusical\b|\bopera\b|\bballet\b|\bplay\b/.test(lower)) return "theater";
  if (/\bsports?\b|\bgame\b|\bmatch\b|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|\bsoccer\b|\bfootball\b/.test(lower)) return "sports";
  if (/\bcomedy\b|\bstand.?up\b/.test(lower)) return "comedy";
  if (/\bconcert\b|\bgig\b|\bshow\b|\blive music\b|\bperformance\b|\bband\b/.test(lower)) return "concert";
  return "other";
}

const GENRE_KEYWORDS: Array<[RegExp, string]> = [
  [/\bjazz\b/, "jazz"],
  [/\bindie\b/, "indie"],
  [/\brock\b/, "rock"],
  [/\bhip.?hop\b|\brap\b/, "hip-hop"],
  [/\bclassical\b/, "classical"],
  [/\bcountry\b/, "country"],
  [/\bedm\b|\belectronic\b/, "electronic"],
  [/\br&b\b|\brnb\b/, "R&B"],
  // Note: "pop" excluded to avoid false-positive on "popular"
];

function extractKeyword(message: string, lower: string): string | undefined {
  // Check genres first to avoid false-positive artist-name extraction
  for (const [pattern, genre] of GENRE_KEYWORDS) {
    if (pattern.test(lower)) return genre;
  }

  // Try to extract proper-noun artist/team names
  // "see Taylor Swift concert", "Taylor Swift concert", etc.
  const seePattern = /\b(?:see|watch|attend)\s+([A-Z][a-zA-Z\s&]+?)(?:\s+(?:concert|show|game|live|perform|play|at\b)|\s*$|,)/u.exec(message);
  if (seePattern) return seePattern[1].trim();

  // "Taylor Swift concert" — proper noun before keyword (must start with uppercase)
  const concertPattern = /([A-Z][a-zA-Z\s&]{2,30}?)\s+(?:concert|show|tour|game|match)/u.exec(message);
  if (concertPattern) return concertPattern[1].trim();

  return undefined;
}

function extractDate(queryContext: MultilingualQueryContext): string | undefined {
  const dateText = queryContext.date_text_hint;
  if (!dateText) return undefined;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText;

  // "this weekend" → next Saturday
  if (/this weekend|weekend/.test(dateText.toLowerCase())) {
    const now = new Date();
    const daysToSaturday = (6 - now.getDay() + 7) % 7 || 7;
    const sat = new Date(now);
    sat.setDate(now.getDate() + daysToSaturday);
    return sat.toISOString().slice(0, 10);
  }

  // "this week" → today
  if (/this week/.test(dateText.toLowerCase())) {
    return new Date().toISOString().slice(0, 10);
  }

  return undefined;
}

export function parseConcertEventIntent(
  userMessage: string,
  queryContext: MultilingualQueryContext
): ConcertEventIntent {
  const lower = userMessage.toLowerCase();

  const eventCity =
    queryContext.location_hint ??
    "New York, NY"; // safe default; agent will clarify if missing

  const keyword = extractKeyword(userMessage, lower);
  const eventType = detectEventType(lower);
  const eventDate = extractDate(queryContext);
  const travelers = queryContext.party_size_hint ?? 1;
  const budget = queryContext.budget_total_hint ?? queryContext.budget_per_person_hint;

  const missingFields: string[] = [];
  if (!queryContext.location_hint) missingFields.push("city");

  const assumptions: string[] = [];
  if (keyword) assumptions.push(`Looking for: ${keyword}`);
  if (eventDate) assumptions.push(`Date: ${eventDate}`);
  assumptions.push(`City: ${eventCity}`);
  if (travelers > 1) assumptions.push(`${travelers} people`);
  if (budget) assumptions.push(`Budget: up to $${budget}`);

  return {
    category: "trip",
    scenario: "concert_event",
    scenario_goal: keyword
      ? `Find ${eventType === "other" ? "event" : eventType} tickets for ${keyword} in ${eventCity}`
      : `Find ${eventType === "other" ? "events" : `${eventType} events`} in ${eventCity}`,
    event_city: eventCity,
    keyword,
    event_date: eventDate,
    event_type: eventType,
    travelers,
    budget_total: budget,
    planning_assumptions: assumptions,
    needs_clarification: false, // Ticketmaster search is forgiving — try regardless
    missing_fields: missingFields,
  };
}
