import { CityTripIntent, MultilingualQueryContext } from "../../types";
import { minimaxChat } from "../../minimax";
import { normalizeDate } from "../../tools";

export async function parseCityTripIntent(
  userMessage: string,
  queryContext?: MultilingualQueryContext
): Promise<CityTripIntent> {
  const today = new Date().toISOString().split("T")[0];
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract a city trip planning intent from this request. Return ONLY valid JSON.

Today: ${today}
User request: "${userMessage}"
NLU hints: ${JSON.stringify({
  normalized_query: queryContext?.normalized_query,
  location_hint: queryContext?.location_hint,
  date_text_hint: queryContext?.date_text_hint,
})}

Return JSON:
{
  "destination_city": string,
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "nights": number or null,
  "travelers": number or null,
  "hotel_star_rating": number or null,
  "hotel_neighborhood": string or null,
  "activities": string[],
  "cuisine_preferences": string[],
  "vibe": "trendy" | "upscale" | "local" | "mixed",
  "planning_assumptions": string[],
  "missing_fields": string[]
}

Rules:
- Extract the destination city from phrases like "travel to LA", "going to Nashville", "visiting New York".
- activities: list what the user wants to do — e.g. ["music bars", "restaurants", "nightlife", "brunch", "museums", "shopping"]. Always include "restaurants" if they mention dining or food.
- cuisine_preferences: extract any mentioned cuisines (e.g. ["steakhouse", "sushi"]). Empty array if none specified.
- vibe: "upscale" if they mention luxury/4-star/5-star/fine dining; "trendy" if they mention trendy/cool/hip; "local" if they mention authentic/local/neighborhood; default "mixed".
- If user mentions "4 star" or "4-star" or specific star rating, capture in hotel_star_rating.
- If start_date is given but no end_date, derive end_date from nights count.
- If nights not given but dates are, compute nights.
- If destination cannot be inferred, add "destination_city" to missing_fields.
- Keep planning_assumptions short and explicit.`,
      },
    ],
    max_tokens: 800,
  });

  const fallback: CityTripIntent = {
    category: "trip",
    scenario: "city_trip",
    scenario_goal: "Plan a multi-day city trip with hotel and activity recommendations.",
    destination_city: queryContext?.location_hint ?? "the destination",
    activities: ["restaurants", "bars"],
    cuisine_preferences: [],
    vibe: "mixed",
    planning_assumptions: [],
    needs_clarification: true,
    missing_fields: ["destination_city"],
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<CityTripIntent> & {
      destination_city?: string;
      start_date?: string | null;
      end_date?: string | null;
    };

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
        : undefined);

    const destination =
      parsed.destination_city?.trim() ||
      queryContext?.location_hint ||
      "";

    const missing_fields = Array.isArray(parsed.missing_fields)
      ? parsed.missing_fields.filter((f): f is string => typeof f === "string")
      : destination ? [] : ["destination_city"];

    const activities = Array.isArray(parsed.activities) && parsed.activities.length > 0
      ? parsed.activities.filter((a): a is string => typeof a === "string")
      : ["restaurants", "bars"];

    return {
      category: "trip",
      scenario: "city_trip",
      scenario_goal: `Plan a ${nights ?? "multi"}-night trip to ${destination || "the destination"} with hotel and curated activity recommendations.`,
      destination_city: destination || "the destination",
      start_date: startDate,
      end_date: endDate,
      nights,
      travelers: typeof parsed.travelers === "number" ? parsed.travelers : 1,
      hotel_star_rating: typeof parsed.hotel_star_rating === "number" ? parsed.hotel_star_rating : undefined,
      hotel_neighborhood: typeof parsed.hotel_neighborhood === "string" ? parsed.hotel_neighborhood : undefined,
      activities,
      cuisine_preferences: Array.isArray(parsed.cuisine_preferences)
        ? parsed.cuisine_preferences.filter((c): c is string => typeof c === "string")
        : [],
      vibe:
        parsed.vibe === "trendy" || parsed.vibe === "upscale" || parsed.vibe === "local"
          ? parsed.vibe
          : "mixed",
      planning_assumptions: Array.isArray(parsed.planning_assumptions)
        ? parsed.planning_assumptions.filter((a): a is string => typeof a === "string")
        : [],
      missing_fields,
      needs_clarification: missing_fields.length > 0,
    };
  } catch {
    return fallback;
  }
}
