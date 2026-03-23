import { WeekendTripIntent, MultilingualQueryContext } from "../../types";
import { minimaxChat } from "../../minimax";
import { normalizeDate } from "../../tools";
import { resolveLocationHint } from "../../nlu";

export async function parseWeekendTripIntent(
  userMessage: string,
  cityFullName: string,
  queryContext?: MultilingualQueryContext
): Promise<WeekendTripIntent> {
  const today = new Date().toISOString().split("T")[0];
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract a weekend trip planning intent from this request. Return ONLY valid JSON.

Today: ${today} (tomorrow = ${new Date(Date.now() + 86400000).toISOString().split("T")[0]})
Default departure city (use if user does not specify): ${cityFullName}
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
- Only put "destination" in missing_fields if the destination truly cannot be inferred.
- Only put "travel dates" in missing_fields if no date or relative time word (tomorrow, this weekend, next week, etc.) is present.
- missing_fields should be EMPTY when destination and start date are both known or inferable.
- Keep planning_assumptions short and explicit.
- Keep trip_pace conservative: "easy" for relaxing language; "packed" for dense/ambitious; otherwise "balanced".`,
      },
    ],
    max_tokens: 1200,
  });

  const fallback: WeekendTripIntent = {
    category: "trip",
    scenario: "weekend_trip",
    scenario_goal: `Plan a weekend trip from ${cityFullName} with one default package and backups the user can approve quickly.`,
    departure_city: cityFullName,
    destination_city: undefined,
    start_date: undefined,
    end_date: undefined,
    nights: 2,
    travelers: 1,
    budget_total: undefined,
    trip_pace: "balanced",
    hotel_style: "comfortable",
    hotel_star_rating: undefined,
    hotel_neighborhood: undefined,
    cabin_class: "economy",
    prefer_direct: null,
    planning_assumptions: [`Using ${cityFullName} as the departure city.`],
    missing_fields: ["destination", "travel dates"],
    needs_clarification: true,
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<WeekendTripIntent>;
    const startDate = normalizeDate(parsed.start_date ?? null) ?? undefined;
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
    return {
      category: "trip",
      scenario: "weekend_trip",
      scenario_goal: `Plan a weekend trip to ${parsed.destination_city ?? "the destination"} with flight, hotel, and budget tradeoffs compressed into a few approval-ready packages.`,
      departure_city: parsed.departure_city ?? cityFullName,
      destination_city: parsed.destination_city ?? undefined,
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
      needs_clarification:
        !parsed.destination_city ||
        (!startDate && missing_fields.includes("travel dates")),
    };
  } catch {
    return fallback;
  }
}
