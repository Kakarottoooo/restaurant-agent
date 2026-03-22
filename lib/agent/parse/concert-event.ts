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

function resolveDateText(text: string): string | undefined {
  const lower = text.toLowerCase().trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;

  // "this weekend" / "next weekend" → next Saturday
  if (/this weekend|next weekend|weekend/.test(lower)) {
    const now = new Date();
    const daysToSaturday = (6 - now.getDay() + 7) % 7 || 7;
    const sat = new Date(now);
    sat.setDate(now.getDate() + daysToSaturday);
    return sat.toISOString().slice(0, 10);
  }

  // "this week" / "next week" → today / next Monday
  if (/this week/.test(lower)) return new Date().toISOString().slice(0, 10);
  if (/next week/.test(lower)) {
    const now = new Date();
    const daysToMonday = (8 - now.getDay()) % 7 || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() + daysToMonday);
    return mon.toISOString().slice(0, 10);
  }

  // "tonight" / "today" → today
  if (/tonight|today/.test(lower)) return new Date().toISOString().slice(0, 10);

  // "tomorrow" → tomorrow
  if (/tomorrow/.test(lower)) {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().slice(0, 10);
  }

  return undefined;
}

function extractDate(queryContext: MultilingualQueryContext, userMessage: string): string | undefined {
  // Prefer the structured hint from NLU (populated for Chinese queries and English fast-path)
  if (queryContext.date_text_hint) {
    const resolved = resolveDateText(queryContext.date_text_hint);
    if (resolved) return resolved;
  }

  // Fall back to scanning the raw user message for date expressions
  // This catches English queries where analyzeMultilingualQuery skips the LLM path
  const datePatterns = [
    /this weekend/i, /next weekend/i, /this week/i, /next week/i,
    /tonight/i, /today/i, /tomorrow/i,
  ];
  for (const pattern of datePatterns) {
    const m = pattern.exec(userMessage);
    if (m) return resolveDateText(m[0]);
  }

  return undefined;
}

export function parseConcertEventIntent(
  userMessage: string,
  queryContext: MultilingualQueryContext
): ConcertEventIntent {
  const lower = userMessage.toLowerCase();

  // Treat GPS placeholder as no city — it's not a real city name
  const realLocationHint =
    queryContext.location_hint && queryContext.location_hint !== "your current location"
      ? queryContext.location_hint
      : undefined;

  const eventCity = realLocationHint ?? "New York, NY"; // safe default; agent will clarify if missing

  const keyword = extractKeyword(userMessage, lower);
  const eventType = detectEventType(lower);
  const eventDate = extractDate(queryContext, userMessage);
  const travelers = queryContext.party_size_hint ?? 1;
  const budget = queryContext.budget_total_hint ?? queryContext.budget_per_person_hint;

  const missingFields: string[] = [];
  if (!realLocationHint) missingFields.push("city");

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
