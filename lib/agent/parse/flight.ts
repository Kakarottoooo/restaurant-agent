import { FlightIntent, MultilingualQueryContext } from "../../types";
import { minimaxChat } from "../../minimax";

export async function parseFlightIntent(
  userMessage: string,
  cityFullName: string,
  queryContext?: MultilingualQueryContext
): Promise<FlightIntent> {
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract flight search requirements from this request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention departure): ${cityFullName}
Today's date: ${new Date().toISOString().split("T")[0]}
Canonical NLU hints: ${JSON.stringify({
  normalized_query: queryContext?.normalized_query,
  location_hint: queryContext?.location_hint,
  date_text_hint: queryContext?.date_text_hint,
  time_hint: queryContext?.time_hint,
})}

Return JSON with these fields (omit fields not mentioned):
{
  "category": "flight",
  "departure_city": "<city or IATA code from user message>",
  "arrival_city": "<destination city or IATA code>",
  "date": "YYYY-MM-DD or null",
  "return_date": "YYYY-MM-DD or null (only for round trip)",
  "is_round_trip": true or false,
  "passengers": number or null,
  "cabin_class": "economy|business|first or null",
  "prefer_direct": true or false (true if user says 'nonstop', 'direct', '直飞'),
  "max_stops": null or 0 (nonstop only) or 1 (at most 1 stop) — set when user explicitly limits stops, otherwise null,
  "avoid_red_eye": true if user says "no red-eye", "no early flights", "not too early", "不要凌晨", "not early morning" — else omit,
  "earliest_departure": "HH:MM" if user specifies earliest acceptable departure time — else omit,
  "latest_departure": "HH:MM" if user specifies latest acceptable departure time — else omit,
  "budget_total": number or null
}

For relative dates: "tomorrow" = tomorrow, "next Friday" = nearest upcoming Friday, "this weekend" = nearest Saturday.
For "round trip"/"往返": set is_round_trip=true.
Default cabin_class to "economy" if not specified.
For "not after 9pm" → latest_departure: "21:00". For "not before 8am" → earliest_departure: "08:00". "no red-eye" implies avoid_red_eye: true (flights departing midnight–6am).`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "flight" };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      category: "flight",
      ...parsed,
      departure_city:
        parsed.departure_city ??
        queryContext?.location_hint ??
        parsed.departure_city,
    };
  } catch {
    return { category: "flight" };
  }
}
