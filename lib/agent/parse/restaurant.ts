import { RestaurantIntent, SessionPreferences, MultilingualQueryContext } from "../../types";
import { minimaxChat } from "../../minimax";
import { resolveLocationHint } from "../../nlu";
import { UserRequirementsSchema } from "../../schemas";
import { formatSessionPreferences } from "../composer/scoring";

export async function parseRestaurantIntent(
  userMessage: string,
  cityFullName: string,
  queryContext?: MultilingualQueryContext,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<RestaurantIntent> {
  const prefContext = sessionPreferences
    ? formatSessionPreferences(sessionPreferences)
    : "";

  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract structured requirements from this restaurant request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention any location): ${cityFullName}
Canonical NLU hints: ${JSON.stringify({
  normalized_query: queryContext?.normalized_query,
  intent_summary: queryContext?.intent_summary,
  location_hint: queryContext?.location_hint,
  cuisine_hint: queryContext?.cuisine_hint,
  purpose_hint: queryContext?.purpose_hint,
  party_size_hint: queryContext?.party_size_hint,
  budget_per_person_hint: queryContext?.budget_per_person_hint,
  budget_total_hint: queryContext?.budget_total_hint,
  constraints_hint: queryContext?.constraints_hint,
})}
${prefContext ? `\n${prefContext}` : ""}
${profileContext ? `\nUser profile: ${profileContext}` : ""}

IMPORTANT: For "location", look for any city or place name in the user request (including typos). Only fall back to "${cityFullName}" if the user truly mentioned no location.

Return JSON with these fields (omit fields that aren't mentioned):
{
  "cuisine": "string or null",
  "purpose": "date|business|family|friends|solo|group|null",
  "budget_per_person": number or null,
  "budget_total": number or null,
  "atmosphere": ["romantic", "quiet", "lively", "cozy", "trendy", etc],
  "noise_level": "quiet|moderate|lively|any",
  "location": "<city from user message, or ${cityFullName} if none>",
  "neighborhood": "specific neighborhood or null",
  "near_location": "specific landmark, address, or area to search near (e.g. 'Union Square', 'Times Square'), or null",
  "party_size": number or null,
  "constraints": ["no chains", "no tourist traps", "no wait", etc],
  "priorities": ["atmosphere", "food quality", "price", "service", etc],
  "service_pace_required": "fast" if user says "quick lunch", "in and out", "no wait", "15 minutes", "fast service", "quick bite", "快速", "不想等", "不等位", "出餐快" — else omit this field
}`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      category: "restaurant",
      location: resolveLocationHint(undefined, queryContext, userMessage, cityFullName),
      cuisine: queryContext?.cuisine_hint,
      purpose: queryContext?.purpose_hint,
      party_size: queryContext?.party_size_hint,
      budget_per_person: queryContext?.budget_per_person_hint,
      budget_total: queryContext?.budget_total_hint,
      constraints: queryContext?.constraints_hint,
    } as RestaurantIntent;
  }
  try {
    const parsed = UserRequirementsSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) {
      return {
        category: "restaurant",
        location: resolveLocationHint(undefined, queryContext, userMessage, cityFullName),
        cuisine: queryContext?.cuisine_hint,
        purpose: queryContext?.purpose_hint,
        party_size: queryContext?.party_size_hint,
        budget_per_person: queryContext?.budget_per_person_hint,
        budget_total: queryContext?.budget_total_hint,
        constraints: queryContext?.constraints_hint,
      } as RestaurantIntent;
    }

    return {
      category: "restaurant",
      ...parsed.data,
      cuisine: parsed.data.cuisine ?? queryContext?.cuisine_hint,
      purpose: parsed.data.purpose ?? queryContext?.purpose_hint,
      party_size: parsed.data.party_size ?? queryContext?.party_size_hint,
      budget_per_person: parsed.data.budget_per_person ?? queryContext?.budget_per_person_hint,
      budget_total: parsed.data.budget_total ?? queryContext?.budget_total_hint,
      constraints:
        parsed.data.constraints && parsed.data.constraints.length > 0
          ? parsed.data.constraints
          : queryContext?.constraints_hint,
      location: resolveLocationHint(parsed.data.location, queryContext, userMessage, cityFullName),
    } as RestaurantIntent;
  } catch {
    return {
      category: "restaurant",
      location: resolveLocationHint(undefined, queryContext, userMessage, cityFullName),
      cuisine: queryContext?.cuisine_hint,
      purpose: queryContext?.purpose_hint,
      party_size: queryContext?.party_size_hint,
      budget_per_person: queryContext?.budget_per_person_hint,
      budget_total: queryContext?.budget_total_hint,
      constraints: queryContext?.constraints_hint,
    } as RestaurantIntent;
  }
}
