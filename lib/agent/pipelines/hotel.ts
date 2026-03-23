import { HotelIntent, HotelRecommendationCard, ScoringDimensions } from "../../types";
import { searchHotels } from "../../tools";
import { minimaxChat } from "../../minimax";
import { computeWeightedScore, HOTEL_DEFAULT_WEIGHTS } from "../composer/scoring";

// ─── Phase 7.2: Hotel Pipeline ───────────────────────────────────────────────

export async function runHotelPipeline(
  intent: HotelIntent,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  cityFullName: string,
): Promise<{ hotelRecommendations: HotelRecommendationCard[]; suggested_refinements: string[] }> {
  const hotels = await searchHotels({
    location: intent.location ?? cityFullName,
    check_in: intent.check_in,
    check_out: intent.check_out,
    guests: intent.guests,
    hotel_class: intent.star_rating,
    maxResults: 20,
  });

  if (hotels.length === 0) {
    return { hotelRecommendations: [], suggested_refinements: [] };
  }

  // Pre-filter: rating >= 3.5 and some reviews
  const filtered = hotels
    .filter((h) => h.rating >= 3.5 || h.review_count === 0)
    .slice(0, 15);

  const hotelList = filtered
    .map(
      (h, i) =>
        `${i + 1}. ${h.name} | ${h.star_rating}★ | ⭐${h.rating} (${h.review_count} reviews) | $${h.price_per_night}/night | ${h.address} | Amenities: ${h.amenities.slice(0, 5).join(", ")}`
    )
    .join("\n");

  const nights = intent.nights ?? 1;
  const systemPrompt = `You are an expert hotel advisor. Pick the best hotels for the user's specific needs and explain exactly why each one fits.`;

  const specialOccasionNote = intent.special_occasion
    ? `\nSPECIAL OCCASION: User is celebrating a ${intent.special_occasion}. Heavily favour hotels with spa, ocean/city view rooms, suites, couples packages, and romantic reputation in reviews. In why_recommended, add a 'Special occasion tip' (e.g. "Call ahead to request turndown service or a room upgrade").`
    : "";

  const familyNote = intent.has_children
    ? `\nFAMILY MODE: User is travelling with ${intent.children_count ?? "children"}. Heavily favour hotels with: pool, kids club, family rooms or connecting rooms, cribs/rollaway, on-site dining, and proximity to family attractions. Penalise adult-only or boutique-only properties. Include a family tip in why_recommended (e.g. "Request a connecting room when booking").`
    : "";

  const text = await minimaxChat({
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      {
        role: "user" as const,
        content: `User hotel requirements: ${JSON.stringify(intent, null, 2)}

Candidate hotels:
${hotelList}
${specialOccasionNote}${familyNote}
Pick the TOP 10 hotels that best match. For each, score honestly across dimensions, then explain.

Also suggest 3-4 refinement queries (in Chinese) like "更便宜一点", "离市中心近一点", "带早餐的".

Return a JSON array:
[
  {
    "rank": 1,
    "hotel_index": 0,
    "scoring": {
      "budget_match": 8,
      "scene_match": 9,
      "review_quality": 7,
      "location_convenience": 8,
      "preference_match": 7,
      "red_flag_penalty": 0
    },
    "why_recommended": "Perfect for business travel with strong WiFi and close to the convention center",
    "best_for": "Business travelers, solo professionals",
    "watch_out": "Street noise at night, parking is extra",
    "not_great_if": "You want a quiet retreat or romantic getaway",
    "price_summary": "$${Math.round((filtered[0]?.price_per_night ?? 150))} /night · ${nights} nights $${Math.round((filtered[0]?.price_per_night ?? 150) * nights)} total",
    "location_summary": "Downtown, 5 min walk to convention center",
    "suggested_refinements": ["更便宜一点", "离市中心近一点", "带早餐的"]
  }
]

Return ONLY the JSON array.`,
      },
    ],
    max_tokens: 4096,
    timeout_ms: 60000,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { hotelRecommendations: [], suggested_refinements: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return { hotelRecommendations: [], suggested_refinements: [] };
  }

  if (!Array.isArray(raw)) return { hotelRecommendations: [], suggested_refinements: [] };

  const suggested_refinements: string[] = (raw[0] as Record<string, unknown>)?.suggested_refinements as string[] ?? [];

  const cards: HotelRecommendationCard[] = (raw as Array<Record<string, unknown>>)
    .filter((item) => typeof item.hotel_index === "number" && (item.hotel_index as number) < filtered.length)
    .map((item, i): HotelRecommendationCard => {
      const hotel = filtered[item.hotel_index as number];
      const scoring = item.scoring as Omit<ScoringDimensions, "weighted_total"> | undefined;
      const weighted_total = scoring ? computeWeightedScore(scoring, HOTEL_DEFAULT_WEIGHTS) : 0;
      return {
        hotel,
        rank: i + 1,
        score: weighted_total,
        why_recommended: String(item.why_recommended ?? ""),
        best_for: String(item.best_for ?? ""),
        watch_out: String(item.watch_out ?? ""),
        not_great_if: String(item.not_great_if ?? ""),
        price_summary: String(item.price_summary ?? `$${hotel.price_per_night}/night`),
        location_summary: String(item.location_summary ?? hotel.address),
        scoring: scoring ? { ...scoring, weighted_total } : undefined,
        suggested_refinements: [],
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((card, i) => ({ ...card, rank: i + 1 }));

  return { hotelRecommendations: cards, suggested_refinements };
}
