import { WeekendTripIntent, MultilingualQueryContext } from "../../types";
import { minimaxChat } from "../../minimax";
import { normalizeDate } from "../../tools";
import { resolveLocationHint } from "../../nlu";

/**
 * Detect the departure city (origin) from "fly back to X" / "return to X" / "fly home to X" patterns.
 * These phrases indicate where the user lives, NOT the trip destination.
 */
function extractDepartureCityFromMessage(message: string): string | undefined {
  const lower = message.toLowerCase();
  // "fly back to X" / "fly home to X" / "return to X" / "back to X" after trip context
  const returnPatterns = [
    /\bfly(?:ing)?\s+back\s+to\s+([a-zA-Z\s,]+?)(?:\b|$)/i,
    /\bfly(?:ing)?\s+home\s+to\s+([a-zA-Z\s,]+?)(?:\b|$)/i,
    /\breturn(?:ing)?\s+to\s+([a-zA-Z\s,]+?)(?:\b|$)/i,
    /\bback\s+to\s+([a-zA-Z\s,]+?)\s+(?:after|when|once|at the end)/i,
    /\bhead(?:ing)?\s+back\s+to\s+([a-zA-Z\s,]+?)(?:\b|$)/i,
  ];
  for (const pattern of returnPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const cityName = match[1].trim().replace(/[,.\s]+$/, "");
      // Normalize to known cities
      const normalized = extractDestinationFromCityName(cityName);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

function extractDestinationFromCityName(cityName: string): string | undefined {
  const lower = cityName.toLowerCase().trim();
  if (/^(ny|new york|nyc|manhattan)$/.test(lower)) return "New York, NY";
  if (/^(la|los angeles|lax)$/.test(lower)) return "Los Angeles, CA";
  if (/^(sf|san francisco|sfo)$/.test(lower)) return "San Francisco, CA";
  if (/^(chicago|chi)$/.test(lower)) return "Chicago, IL";
  if (/^(miami|mia)$/.test(lower)) return "Miami, FL";
  if (/^(vegas|las vegas|lvs)$/.test(lower)) return "Las Vegas, NV";
  if (/^(seattle|sea)$/.test(lower)) return "Seattle, WA";
  if (/^(boston|bos)$/.test(lower)) return "Boston, MA";
  if (/^(denver|den)$/.test(lower)) return "Denver, CO";
  if (/^(austin|atx)$/.test(lower)) return "Austin, TX";
  if (/^(dallas|dfw)$/.test(lower)) return "Dallas, TX";
  if (/^(houston|hou)$/.test(lower)) return "Houston, TX";
  if (/^(atlanta|atl)$/.test(lower)) return "Atlanta, GA";
  if (/^(nashville|bna)$/.test(lower)) return "Nashville, TN";
  if (/^(portland|pdx)$/.test(lower)) return "Portland, OR";
  if (/^(phoenix|phx)$/.test(lower)) return "Phoenix, AZ";
  if (/^(san diego|sdg)$/.test(lower)) return "San Diego, CA";
  if (/^(new orleans|nola)$/.test(lower)) return "New Orleans, LA";
  if (/^(washington\s*dc|dc|washington\s*d\.c\.?)$/.test(lower)) return "Washington, DC";
  if (/^(philadelphia|philly|phl)$/.test(lower)) return "Philadelphia, PA";
  if (/^(minneapolis|min)$/.test(lower)) return "Minneapolis, MN";
  if (/^(detroit|det)$/.test(lower)) return "Detroit, MI";
  return undefined;
}

function extractDestinationFromMessage(message: string): string | undefined {
  const lower = message.toLowerCase();
  // Common city abbreviations and names
  if (/\b(ny|new york|nyc|manhattan)\b/.test(lower)) return "New York, NY";
  if (/\b(la|los angeles|lax)\b/.test(lower)) return "Los Angeles, CA";
  if (/\b(sf|san francisco|sfo)\b/.test(lower)) return "San Francisco, CA";
  if (/\b(chicago|chi)\b/.test(lower)) return "Chicago, IL";
  if (/\b(miami|mia)\b/.test(lower)) return "Miami, FL";
  if (/\b(vegas|las vegas|lvs)\b/.test(lower)) return "Las Vegas, NV";
  if (/\b(seattle|sea)\b/.test(lower)) return "Seattle, WA";
  if (/\b(boston|bos)\b/.test(lower)) return "Boston, MA";
  if (/\b(denver|den)\b/.test(lower)) return "Denver, CO";
  if (/\b(austin|atx)\b/.test(lower)) return "Austin, TX";
  if (/\b(dallas|dfw)\b/.test(lower)) return "Dallas, TX";
  if (/\b(houston|hou)\b/.test(lower)) return "Houston, TX";
  if (/\b(atlanta|atl)\b/.test(lower)) return "Atlanta, GA";
  if (/\b(nashville|bna)\b/.test(lower)) return "Nashville, TN";
  if (/\b(portland|pdx)\b/.test(lower)) return "Portland, OR";
  if (/\b(phoenix|phx)\b/.test(lower)) return "Phoenix, AZ";
  if (/\b(san diego|san-diego|sdg)\b/.test(lower)) return "San Diego, CA";
  if (/\b(new orleans|nola)\b/.test(lower)) return "New Orleans, LA";
  if (/\b(washington\s*dc|dc|washington\s*d\.c\.?)\b/.test(lower)) return "Washington, DC";
  if (/\b(philadelphia|philly|phl)\b/.test(lower)) return "Philadelphia, PA";
  if (/\b(minneapolis|min)\b/.test(lower)) return "Minneapolis, MN";
  if (/\b(detroit|det)\b/.test(lower)) return "Detroit, MI";
  if (/\b(toronto|yyz)\b/.test(lower)) return "Toronto, Canada";
  if (/\b(london|lhr)\b/.test(lower)) return "London, UK";
  if (/\b(paris|cdg)\b/.test(lower)) return "Paris, France";
  if (/\b(tokyo|tyo)\b/.test(lower)) return "Tokyo, Japan";
  if (/\b(barcelona)\b/.test(lower)) return "Barcelona, Spain";
  if (/\b(amsterdam|ams)\b/.test(lower)) return "Amsterdam, Netherlands";
  if (/\b(rome|fco)\b/.test(lower)) return "Rome, Italy";
  if (/\b(cancun|cun)\b/.test(lower)) return "Cancun, Mexico";
  if (/\b(hawaii|honolulu|oahu|maui|hnl)\b/.test(lower)) return "Honolulu, HI";
  return undefined;
}

function resolveRelativeDates(message: string): { resolvedMessage: string; dateHint: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const dayAfter = new Date(now); dayAfter.setDate(now.getDate() + 2);

  const lower = message.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return { resolvedMessage: message, dateHint: `Start date: ${fmt(tomorrow)} (tomorrow)` };
  if (/\bday after tomorrow\b/.test(lower)) return { resolvedMessage: message, dateHint: `Start date: ${fmt(dayAfter)} (day after tomorrow)` };
  if (/\bthis weekend\b/.test(lower)) {
    const daysUntilFri = (5 - now.getDay() + 7) % 7 || 7;
    const fri = new Date(now); fri.setDate(now.getDate() + daysUntilFri);
    return { resolvedMessage: message, dateHint: `Start date: ${fmt(fri)} (this Friday)` };
  }
  if (/\bnext weekend\b/.test(lower)) {
    const daysUntilFri = (5 - now.getDay() + 7) % 7 || 7;
    const fri = new Date(now); fri.setDate(now.getDate() + daysUntilFri + 7);
    return { resolvedMessage: message, dateHint: `Start date: ${fmt(fri)} (next Friday)` };
  }
  return { resolvedMessage: message, dateHint: "" };
}

export async function parseWeekendTripIntent(
  userMessage: string,
  cityFullName: string,
  queryContext?: MultilingualQueryContext
): Promise<WeekendTripIntent> {
  const today = new Date().toISOString().split("T")[0];
  const { dateHint } = resolveRelativeDates(userMessage);
  const preDestination = extractDestinationFromMessage(userMessage);
  const preDepartureCity = extractDepartureCityFromMessage(userMessage);
  const resolvedStartDateForFallback = dateHint ? dateHint.match(/(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract a weekend trip planning intent from this request. Return ONLY valid JSON.

Today: ${today}${dateHint ? `\nRESOLVED DATE HINT: ${dateHint} — use this as start_date, do NOT put travel dates in missing_fields` : ` (tomorrow = ${new Date(Date.now() + 86400000).toISOString().split("T")[0]})`}
Default departure city (use if user does not specify): ${cityFullName}${preDepartureCity ? `\nPRE-EXTRACTED DEPARTURE CITY: "${preDepartureCity}" (detected from "fly back to" / "return to" / "fly home to" phrase — use this as departure_city)` : ""}${preDestination ? `\nPRE-EXTRACTED DESTINATION: "${preDestination}" (use this as destination_city)` : ""}
User request: "${userMessage}"
Canonical NLU hints: ${JSON.stringify({
  normalized_query: queryContext?.normalized_query,
  scenario_hint: queryContext?.scenario_hint,
  location_hint: queryContext?.location_hint,
  date_text_hint: queryContext?.date_text_hint,
  time_hint: queryContext?.time_hint,
})}

Return JSON:
{
  "category": "trip",
  "scenario": "weekend_trip",
  "departure_city": string or null,
  "destination_city": string or null,
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "nights": number or null,
  "travelers": number or null,
  "budget_total": number or null,
  "trip_pace": "easy" | "balanced" | "packed",
  "hotel_style": "value" | "comfortable" | "boutique" | "luxury" | "any",
  "hotel_star_rating": number or null,
  "hotel_neighborhood": string or null,
  "cabin_class": "economy" | "business" | "first",
  "prefer_direct": true | false | null,
  "planning_assumptions": string[],
  "missing_fields": string[]
}

Rules:
- "tomorrow" → start_date = tomorrow's date shown above. NEVER put "travel dates" in missing_fields when the user says "tomorrow".
- "this weekend" / "next weekend" → convert to concrete Friday-Sunday dates.
- "next month" → choose first Friday-Sunday weekend of next month.
- If the user gives a start date but no end date, default to a 2-night trip (end_date = start_date + nights).
- If the user gives no traveler count, default to 2 for "we/us", otherwise 1.
- If the user gives no departure city, use the default departure city.
- CRITICAL: "fly back to X" / "fly home to X" / "return to X" / "heading back to X" means X is the departure_city (where the user is coming FROM), NOT the destination. The destination is where they are going TO visit.
- CRITICAL: "make a plan to X" / "going to X" / "trip to X" → X is the destination_city.
- departure_city and destination_city must NEVER be the same city.
- Only put "destination" in missing_fields if the destination truly cannot be inferred.
- Only put "travel dates" in missing_fields if no date or relative time word (tomorrow, this weekend, next week, etc.) is present.
- missing_fields should be EMPTY when destination and start date are both known or inferable.
- Keep planning_assumptions short and explicit.
- Keep trip_pace conservative: "easy" for relaxing language; "packed" for dense/ambitious; otherwise "balanced".`,
      },
    ],
    max_tokens: 1200,
  });

  const fallbackMissingFields: string[] = [];
  if (!preDestination) fallbackMissingFields.push("destination");
  if (!resolvedStartDateForFallback) fallbackMissingFields.push("travel dates");

  const fallback: WeekendTripIntent = {
    category: "trip",
    scenario: "weekend_trip",
    scenario_goal: `Plan a weekend trip to ${preDestination ?? "the destination"} with flight, hotel, and budget tradeoffs compressed into a few approval-ready packages.`,
    departure_city: preDepartureCity ?? cityFullName,
    destination_city: preDestination,
    start_date: resolvedStartDateForFallback,
    end_date: resolvedStartDateForFallback
      ? (() => {
          const d = new Date(`${resolvedStartDateForFallback}T00:00:00`);
          d.setDate(d.getDate() + 2);
          return d.toISOString().split("T")[0];
        })()
      : undefined,
    nights: 2,
    travelers: 1,
    budget_total: undefined,
    trip_pace: "balanced",
    hotel_style: "comfortable",
    hotel_star_rating: undefined,
    hotel_neighborhood: undefined,
    cabin_class: "economy",
    prefer_direct: null,
    planning_assumptions: [
      `Using ${preDepartureCity ?? cityFullName} as the departure city.`,
      ...(preDestination ? [`Destination inferred as ${preDestination}.`] : []),
      ...(resolvedStartDateForFallback ? [`Start date resolved from message: ${resolvedStartDateForFallback}.`] : []),
    ],
    missing_fields: fallbackMissingFields,
    needs_clarification: fallbackMissingFields.length > 0,
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<WeekendTripIntent>;
    // If MiniMax ignored the date hint, fall back to our pre-resolved date
    const resolvedStartDate = dateHint ? dateHint.match(/(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
    const startDate = normalizeDate(parsed.start_date ?? null) ?? resolvedStartDate ?? undefined;
    const endDate = normalizeDate(parsed.end_date ?? null) ?? undefined;
    const nights =
      parsed.nights ??
      (startDate && endDate
        ? Math.max(
            1,
            Math.round(
              (new Date(`${endDate}T00:00:00`).getTime() -
                new Date(`${startDate}T00:00:00`).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 2);
    const missing_fields = Array.isArray(parsed.missing_fields)
      ? parsed.missing_fields.filter((field): field is string => typeof field === "string")
      : [];
    // Resolve departure and destination — apply safeguards against MiniMax confusion:
    // 1. "fly back to X" phrase is a strong signal for departure city; prefer it over MiniMax
    // 2. Regex-extracted preDestination is authoritative for destination
    // 3. If MiniMax makes departure === destination, something went wrong — fall back
    const resolvedDeparture = preDepartureCity ?? parsed.departure_city ?? cityFullName;
    const resolvedDestination = preDestination ?? parsed.destination_city ?? undefined;
    // Sanity check: departure and destination must differ
    const finalDeparture = resolvedDeparture === resolvedDestination ? (preDepartureCity ?? cityFullName) : resolvedDeparture;
    const finalDestination = resolvedDeparture === resolvedDestination ? (preDestination ?? parsed.destination_city ?? undefined) : resolvedDestination;

    return {
      category: "trip",
      scenario: "weekend_trip",
      scenario_goal: `Plan a weekend trip to ${finalDestination ?? "the destination"} with flight, hotel, and budget tradeoffs compressed into a few approval-ready packages.`,
      departure_city: finalDeparture,
      destination_city: finalDestination,
      start_date: startDate,
      end_date: endDate,
      nights,
      travelers: parsed.travelers ?? 1,
      budget_total: parsed.budget_total ?? undefined,
      trip_pace:
        parsed.trip_pace === "easy" || parsed.trip_pace === "packed"
          ? parsed.trip_pace
          : "balanced",
      hotel_style:
        parsed.hotel_style === "value" ||
        parsed.hotel_style === "comfortable" ||
        parsed.hotel_style === "boutique" ||
        parsed.hotel_style === "luxury"
          ? parsed.hotel_style
          : "any",
      hotel_star_rating: parsed.hotel_star_rating ?? undefined,
      hotel_neighborhood: parsed.hotel_neighborhood ?? undefined,
      cabin_class:
        parsed.cabin_class === "business" || parsed.cabin_class === "first"
          ? parsed.cabin_class
          : "economy",
      prefer_direct:
        typeof parsed.prefer_direct === "boolean" ? parsed.prefer_direct : null,
      planning_assumptions: Array.isArray(parsed.planning_assumptions)
        ? parsed.planning_assumptions.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : [],
      missing_fields,
      // Only ask for clarification when destination or dates are truly unknown
      // Never ask about dates when we pre-resolved a relative date hint
      // Fall back to TypeScript-extracted destination before giving up
      needs_clarification:
        (!parsed.destination_city && !preDestination) ||
        (!startDate && !dateHint && missing_fields.includes("travel dates")),
    };
  } catch {
    return fallback;
  }
}
