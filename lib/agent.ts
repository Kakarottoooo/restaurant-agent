// import Anthropic from "@anthropic-ai/sdk";
// const client = new Anthropic();

import { googlePlacesSearch, tavilySearch, geocodeLocation, fetchReviewSignals, searchHotels, searchFlights, resolveMultiAirport } from "./tools";
import { UserRequirements, Restaurant, RecommendationCard, SessionPreferences, ScoringDimensions, HotelIntent, RestaurantIntent, FlightIntent, ParsedIntent, HotelRecommendationCard, FlightRecommendationCard, CategoryType, Flight } from "./types";
import { CITIES, DEFAULT_CITY } from "./cities";
import { UserRequirementsSchema, RankedItemArraySchema } from "./schemas";

const MINIMAX_API_URL = "https://api.minimaxi.chat/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-Text-01";

async function minimaxChat(params: {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
}): Promise<string> {
  const messages = params.system
    ? [{ role: "system" as const, content: params.system }, ...params.messages]
    : params.messages;

  const res = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      max_tokens: params.max_tokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Phase 3.2: Weighted Scoring ─────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  budget_match: 0.25,
  scene_match: 0.30,
  review_quality: 0.20,
  location_convenience: 0.15,
  preference_match: 0.10,
};

export function computeWeightedScore(
  dimensions: Omit<ScoringDimensions, "weighted_total">,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): number {
  const raw =
    dimensions.budget_match * weights.budget_match +
    dimensions.scene_match * weights.scene_match +
    dimensions.review_quality * weights.review_quality +
    dimensions.location_convenience * weights.location_convenience +
    dimensions.preference_match * weights.preference_match;
  const penalized = raw - dimensions.red_flag_penalty;
  return Math.round(Math.max(0, Math.min(10, penalized)) * 10) / 10;
}

// ─── Phase 3.3a: Session Preference Extraction ───────────────────────────────

export async function extractRefinements(
  newMessage: string,
  currentPreferences: SessionPreferences
): Promise<SessionPreferences> {
  try {
    const text = await minimaxChat({
      messages: [
        {
          role: "user",
          content: `You are updating a user preference profile based on their latest refinement message.
Current preferences: ${JSON.stringify(currentPreferences)}
New message: "${newMessage}"

Extract any preference updates implied by the message. Return ONLY updated preferences JSON with the same schema.
Only update fields that are clearly implied. Do not invent preferences.
Examples:
- "more quiet" → noise_preference: "quiet"
- "cheaper options" → budget_ceiling reduced by ~30%
- "no chains please" → exclude_chains: true
- "remove Thai from results" → excluded_cuisines: [..., "Thai"]

Return the full updated JSON object.`,
        },
      ],
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return currentPreferences;
    const updated = JSON.parse(jsonMatch[0]);
    return {
      ...currentPreferences,
      ...updated,
      refined_from_query_count: currentPreferences.refined_from_query_count + 1,
    };
  } catch {
    return currentPreferences;
  }
}

function formatSessionPreferences(prefs: SessionPreferences): string {
  const parts: string[] = [];
  if (prefs.noise_preference) parts.push(`Noise preference: ${prefs.noise_preference}`);
  if (prefs.budget_ceiling) parts.push(`Budget ceiling: $${prefs.budget_ceiling}/person`);
  if (prefs.exclude_chains) parts.push("Exclude chains: yes");
  if (prefs.excluded_cuisines.length > 0)
    parts.push(`Excluded cuisines: ${prefs.excluded_cuisines.join(", ")}`);
  if (prefs.required_features.length > 0)
    parts.push(`Required features: ${prefs.required_features.join(", ")}`);
  if (prefs.occasion) parts.push(`Occasion: ${prefs.occasion}`);
  return parts.length > 0
    ? `User session preferences (accumulated from conversation):\n${parts.map((p) => `- ${p}`).join("\n")}\nPlease factor these into your recommendations.`
    : "";
}

// ─── Phase 7.1: Two-layer Intent Architecture ────────────────────────────────

export const HOTEL_DEFAULT_WEIGHTS = {
  budget_match: 0.30,
  scene_match: 0.25,
  review_quality: 0.20,
  location_convenience: 0.20,
  preference_match: 0.05,
};

async function detectCategory(message: string): Promise<CategoryType> {
  const lower = message.toLowerCase();
  const flightKeywords = [
    "flight", "flights", "fly", "flying", "plane", "airline", "airport",
    "ticket", "tickets", "one way", "round trip", "roundtrip", "nonstop",
    "economy class", "business class", "first class", "layover", "stopover",
    "depart", "departing", "arrive", "arriving", "boarding",
    "机票", "航班", "飞机", "起飞", "降落", "经济舱", "商务舱",
  ];
  const hotelKeywords = [
    "hotel", "motel", "inn", "resort", "lodge", "hostel", "airbnb",
    "check in", "check-in", "check out", "check-out", "nights", "night stay",
    "stay at", "book a room", "accommodation", "suite", "booking",
    "酒店", "旅馆", "住", "入住", "退房", "晚", "客房",
  ];
  if (flightKeywords.some((kw) => lower.includes(kw))) return "flight";
  if (hotelKeywords.some((kw) => lower.includes(kw))) return "hotel";
  return "restaurant";
}

async function parseHotelIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<HotelIntent> {
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract hotel search requirements from this request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention any location): ${cityFullName}
Today's date: ${new Date().toISOString().split("T")[0]}

IMPORTANT: For "location", look for any city, region, or place name in the user request (including typos like "las vagas"="Las Vegas", "new yok"="New York"). Only fall back to "${cityFullName}" if the user truly mentioned no location.

Return JSON with these fields (omit fields that aren't mentioned):
{
  "category": "hotel",
  "location": "<city from user message, or ${cityFullName} if none>",
  "check_in": "YYYY-MM-DD or null",
  "check_out": "YYYY-MM-DD or null",
  "nights": number or null,
  "guests": number or null,
  "star_rating": number or null (minimum star rating requested),
  "room_type": "single|double|suite|null",
  "amenities": ["pool", "gym", "parking", "breakfast", "wifi", etc],
  "budget_per_night": number or null,
  "budget_total": number or null,
  "neighborhood": "specific area or null",
  "purpose": "business|leisure|romantic|family|null",
  "constraints": ["no chains", "quiet", "pet-friendly", etc],
  "priorities": ["price", "location", "amenities", etc]
}

For relative dates: "tonight" = today, "tomorrow" = tomorrow, "next Friday" = nearest upcoming Friday, "2 nights" sets nights=2 and check_out = check_in + 2 days.`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "hotel", location: cityFullName };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // If nights given but no check_out, compute it
    if (parsed.check_in && parsed.nights && !parsed.check_out) {
      const d = new Date(parsed.check_in);
      d.setDate(d.getDate() + parsed.nights);
      parsed.check_out = d.toISOString().split("T")[0];
    }
    return { category: "hotel", ...parsed };
  } catch {
    return { category: "hotel", location: cityFullName };
  }
}

// ─── Layer 1: Intent Parsing ──────────────────────────────────────────────────

async function parseRestaurantIntent(
  userMessage: string,
  cityFullName: string,
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
  "priorities": ["atmosphere", "food quality", "price", "service", etc]
}`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "restaurant" } as RestaurantIntent;
  try {
    const parsed = UserRequirementsSchema.safeParse(JSON.parse(jsonMatch[0]));
    return parsed.success ? ({ category: "restaurant", ...parsed.data } as RestaurantIntent) : { category: "restaurant" };
  } catch {
    return { category: "restaurant" } as RestaurantIntent;
  }
}

async function parseFlightIntent(
  userMessage: string,
  cityFullName: string
): Promise<FlightIntent> {
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract flight search requirements from this request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention departure): ${cityFullName}
Today's date: ${new Date().toISOString().split("T")[0]}

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
  "budget_total": number or null
}

For relative dates: "tomorrow" = tomorrow, "next Friday" = nearest upcoming Friday, "this weekend" = nearest Saturday.
For "round trip"/"往返": set is_round_trip=true.
Default cabin_class to "economy" if not specified.`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "flight" };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { category: "flight", ...parsed };
  } catch {
    return { category: "flight" };
  }
}

export async function parseIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<ParsedIntent> {
  const category = await detectCategory(userMessage);
  if (category === "flight") {
    return parseFlightIntent(userMessage, cityFullName);
  }
  if (category === "hotel") {
    return parseHotelIntent(userMessage, cityFullName, sessionPreferences, profileContext);
  }
  return parseRestaurantIntent(userMessage, cityFullName, sessionPreferences, profileContext);
}

// ─── Layer 2+3: Search & Collect (parallel) ──────────────────────────────────

// Phase 4.1: StreamCallbacks type
export type StreamCallbacks = {
  onPartial?: (cards: RecommendationCard[], requirements: UserRequirements) => void;
};

async function gatherCandidates(
  requirements: UserRequirements,
  cityId: string,
  gpsCoords: { lat: number; lng: number } | null = null,
  uiNearLocation?: string
): Promise<{ restaurants: Restaurant[]; semanticSignals: string; tavilyQuery: string }> {
  const city = CITIES[cityId] ?? CITIES[DEFAULT_CITY];

  // UI near_location takes priority over parsed near_location from message
  const effectiveNearLocation = uiNearLocation ?? requirements.near_location;

  // Geocode near_location if provided
  let nearLocationCoords: { lat: number; lng: number } | undefined;
  if (effectiveNearLocation) {
    const geocoded = await geocodeLocation(effectiveNearLocation);
    if (geocoded) nearLocationCoords = geocoded;
  }

  const cityCenter = nearLocationCoords ?? gpsCoords ?? city.center;

  const location = gpsCoords
    ? "Nearby"
    : effectiveNearLocation
    ? effectiveNearLocation
    : requirements.neighborhood
    ? `${requirements.neighborhood}, ${city.fullName}`
    : city.fullName;

  // Map budget to price filter
  let priceFilter: string | undefined;
  const bpp = requirements.budget_per_person;
  if (bpp) {
    if (bpp <= 15) priceFilter = "1";
    else if (bpp <= 30) priceFilter = "1,2";
    else if (bpp <= 60) priceFilter = "2,3";
    else if (bpp <= 100) priceFilter = "3,4";
    else priceFilter = "4";
  }

  const searchQuery = [
    requirements.cuisine,
    requirements.purpose === "date" ? "romantic" : "",
    requirements.noise_level === "quiet" ? "quiet" : "",
    priceFilter ? (parseInt(priceFilter[0]) <= 2 ? "affordable" : "upscale") : "",
    "restaurant",
  ]
    .filter(Boolean)
    .join(" ");

  // Phase 4.4: Broadened search (no cuisine, no price filter)
  const broadSearchQuery = [
    requirements.purpose === "date" ? "romantic" : "",
    requirements.noise_level === "quiet" ? "quiet" : "",
    "restaurant",
  ]
    .filter(Boolean)
    .join(" ");

  const tavilyQuery = [
    requirements.cuisine,
    `restaurant ${city.fullName}`,
    requirements.purpose === "date" ? "romantic date night" : "",
    requirements.atmosphere?.join(" "),
    requirements.noise_level === "quiet" ? "quiet atmosphere" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Phase 4.4: Run primary AND broadened search in parallel, plus Tavily
  const [primaryRestaurants, broadRestaurants, tavilyResult] = await Promise.all([
    googlePlacesSearch({
      query: searchQuery,
      location,
      cityCenter,
      nearLocationCoords,
      maxResults: 20,
    }),
    googlePlacesSearch({
      query: broadSearchQuery,
      location,
      cityCenter,
      nearLocationCoords,
      maxResults: 20,
    }).catch(() => [] as Restaurant[]),
    tavilySearch(`best ${tavilyQuery} reviews 2024`).catch((err) => {
      console.warn("Tavily search failed:", err);
      return { results: "", failed: true };
    }),
  ]);
  const semanticSignals = tavilyResult.failed ? "" : tavilyResult.results;

  // Phase 4.4: Merge and deduplicate by id
  const seenIds = new Set<string>();
  const merged: Restaurant[] = [];
  for (const r of [...primaryRestaurants, ...broadRestaurants]) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      merged.push(r);
    }
  }

  // Phase 4.4: Three-stage funnel
  // Stage 1 (Recall): pool of 30-60 raw candidates → we have merged (up to 40)
  // Stage 2 (Pre-filter): remove rating < 3.5 AND review_count < 30; sort by score, take top 15
  const preFiltered = merged
    .filter((r) => r.rating >= 3.5 && r.review_count >= 30)
    .sort((a, b) => b.rating * Math.log(b.review_count + 1) - a.rating * Math.log(a.review_count + 1))
    .slice(0, 15);

  return { restaurants: preFiltered, semanticSignals, tavilyQuery };
}

// ─── Layer 4+5+6: Rank, Score, Explain ───────────────────────────────────────

async function rankAndExplain(
  requirements: UserRequirements,
  restaurants: Restaurant[],
  semanticSignals: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): Promise<{ cards: RecommendationCard[]; suggested_refinements: string[] }> {
  const restaurantList = restaurants
    .map((r, i) => {
      const signals = r.review_signals;
      let signalLine = "";
      if (signals) {
        const parts = [
          signals.noise_level !== "unknown" ? `noise=${signals.noise_level}` : null,
          signals.wait_time ? `wait=${signals.wait_time}` : null,
          `date_suitability=${signals.date_suitability}/10`,
          signals.red_flags.length > 0 ? `red_flags=${JSON.stringify(signals.red_flags)}` : null,
          signals.notable_dishes.length > 0
            ? `notable=${JSON.stringify(signals.notable_dishes)}`
            : null,
        ].filter(Boolean);
        if (parts.length > 0) signalLine = `\n   Review signals: ${parts.join(", ")}`;
      }
      return `${i + 1}. ${r.name} | ${r.cuisine} | ${r.price} | ⭐${r.rating} (${r.review_count} reviews) | ${r.address}${signalLine}`;
    })
    .join("\n");

  const prefContext = sessionPreferences
    ? formatSessionPreferences(sessionPreferences)
    : "";

  const systemPrompt = `You are an expert ${cityFullName} restaurant advisor. Your job is to pick the best restaurants for the user's specific needs and explain exactly why each one fits or doesn't fit.

Be honest about downsides. Don't recommend places that don't fit. Quality of matching matters more than quantity.`;

  const messages = [
    ...conversationHistory,
    {
      role: "user" as const,
      content: `User requirements: ${JSON.stringify(requirements, null, 2)}
${prefContext ? `\n${prefContext}` : ""}
${profileContext ? `\nUser profile: ${profileContext}` : ""}

Candidate restaurants:
${restaurantList}

Additional context from web search:
${semanticSignals}

Pick the TOP 10 restaurants that best match the user's needs. For each one, fill in scoring dimensions honestly, then write the explanation.

Also, based on the current results and user requirements, suggest 3-5 refinements the user might want to make (in Chinese), such as "更安静一点", "再便宜一点", "离地铁近一点" etc.

Return a JSON array:
[
  {
    "rank": 1,
    "restaurant_index": 0,
    "scoring": {
      "budget_match": 8,
      "scene_match": 9,
      "review_quality": 7,
      "location_convenience": 6,
      "preference_match": 5,
      "red_flag_penalty": 0
    },
    "why_recommended": "Perfect for a first date — intimate booths, candlelit, conversation-friendly noise level",
    "best_for": "Romantic dates, special occasions",
    "watch_out": "Book at least 3 days ahead, parking is tough",
    "not_great_if": "You're on a tight budget or want a lively atmosphere",
    "estimated_total": "$80-100 for two with drinks",
    "suggested_refinements": ["更安静一点", "再便宜一点", "离地铁近一点"]
  }
]

Return ONLY the JSON array, no other text.`,
    },
  ];

  const text = await minimaxChat({
    system: systemPrompt,
    messages,
    max_tokens: 4096,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { cards: [], suggested_refinements: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return { cards: [], suggested_refinements: [] };
  }
  const parsed = RankedItemArraySchema.safeParse(raw);
  if (!parsed.success) return { cards: [], suggested_refinements: [] };

  // Extract suggested_refinements from first item (they should all be the same)
  const suggested_refinements: string[] = parsed.data[0]?.suggested_refinements ?? [];

  // Merge custom weights with defaults
  const effectiveWeights = customWeights
    ? { ...DEFAULT_WEIGHTS, ...customWeights }
    : DEFAULT_WEIGHTS;

  // Phase 3.2: compute weighted_total and re-sort by it
  type MappedItem = {
    rank: number;
    restaurant_index: number;
    score: number;
    scoring?: ScoringDimensions;
    why_recommended: string;
    best_for: string;
    watch_out: string;
    not_great_if: string;
    estimated_total: string;
    restaurant: Restaurant;
  };
  const cards: MappedItem[] = parsed.data
    .filter((item) => item.restaurant_index < restaurants.length)
    .map((item): MappedItem => {
      if (item.scoring) {
        const weighted_total = computeWeightedScore(item.scoring, effectiveWeights);
        return {
          ...item,
          score: weighted_total,
          scoring: { ...item.scoring, weighted_total },
          restaurant: restaurants[item.restaurant_index],
        };
      }
      return {
        ...item,
        scoring: undefined,
        restaurant: restaurants[item.restaurant_index],
      };
    })
    .sort((a, b) => {
      const aScore = (a.scoring as ScoringDimensions | undefined)?.weighted_total ?? a.score ?? 0;
      const bScore = (b.scoring as ScoringDimensions | undefined)?.weighted_total ?? b.score ?? 0;
      return bScore - aScore;
    })
    .map((item, i) => ({ ...item, rank: i + 1 }));

  return { cards, suggested_refinements };
}

// ─── Phase 7.2: Hotel Pipeline ───────────────────────────────────────────────

async function runHotelPipeline(
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

  const text = await minimaxChat({
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      {
        role: "user" as const,
        content: `User hotel requirements: ${JSON.stringify(intent, null, 2)}

Candidate hotels:
${hotelList}

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

// ─── Phase 8: Flight Pipeline ─────────────────────────────────────────────────

async function runFlightPipeline(
  intent: FlightIntent,
): Promise<{ flightRecommendations: FlightRecommendationCard[]; missing_fields: string[]; no_direct_available: boolean }> {
  // Check required fields
  const missing: string[] = [];
  if (!intent.departure_city) missing.push("departure city");
  if (!intent.arrival_city) missing.push("destination city");
  if (!intent.date) missing.push("travel date");

  if (missing.length > 0) {
    return { flightRecommendations: [], missing_fields: missing, no_direct_available: false };
  }

  const searchParams = {
    arrival_city: intent.arrival_city!,
    date: intent.date!,
    return_date: intent.return_date,
    is_round_trip: intent.is_round_trip,
    passengers: intent.passengers,
    cabin_class: intent.cabin_class,
    prefer_direct: intent.prefer_direct,
  };

  // Multi-airport city handling: search primary airport + cheapest from alternates
  const depMulti = resolveMultiAirport(intent.departure_city!);
  const arrMulti = resolveMultiAirport(intent.arrival_city!);

  let flights: Flight[];

  if (depMulti && depMulti.all.length > 1) {
    // Parallel search: primary airport + each alternate airport
    const alternates = depMulti.all.filter((code) => code !== depMulti.primary);
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: depMulti.primary, maxResults: 5 }),
      ...alternates.map((alt) =>
        searchFlights({ ...searchParams, departure_city: alt, maxResults: 3 })
      ),
    ]);

    // Take best 3 from primary airport
    const primaryBest = primaryFlights.slice(0, 3);

    // Find cheapest flight from any alternate airport (only if cheaper than primary cheapest)
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];

    if (cheapestAlt && cheapestAlt.price < primaryCheapest) {
      flights = [...primaryBest, cheapestAlt];
    } else {
      // Also add a 1-stop / 2-stop from alternates if available
      const altOneStop = allAltFlights.find((f) => f.stops === 1);
      flights = altOneStop ? [...primaryBest, altOneStop] : primaryBest;
    }
  } else if (arrMulti && arrMulti.all.length > 1) {
    // Multi-airport arrival (less common but handled symmetrically)
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: arrMulti.primary, maxResults: 5 }),
      ...arrMulti.all
        .filter((c) => c !== arrMulti.primary)
        .map((alt) =>
          searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: alt, maxResults: 3 })
        ),
    ]);
    const primaryBest = primaryFlights.slice(0, 3);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    flights = cheapestAlt && cheapestAlt.price < primaryCheapest
      ? [...primaryBest, cheapestAlt]
      : primaryBest;
  } else {
    flights = await searchFlights({
      ...searchParams,
      departure_city: intent.departure_city!,
      maxResults: 5,
    });
  }

  if (flights.length === 0) {
    return { flightRecommendations: [], missing_fields: [], no_direct_available: false };
  }

  const no_direct_available = intent.prefer_direct === true && flights.every((f) => f.stops > 0);

  const cards: FlightRecommendationCard[] = flights.map((flight, i) => {
    const group: FlightRecommendationCard["group"] =
      flight.stops === 0 ? "direct" : flight.stops === 1 ? "one_stop" : "two_stop";

    const why =
      flight.stops === 0
        ? `Nonstop flight — fastest option at ${flight.duration}`
        : flight.stops === 1
        ? `1 stop via ${flight.layover_city ?? "connecting city"} (${flight.layover_duration ?? ""} layover)`
        : `${flight.stops} stops — most affordable option`;

    return {
      flight,
      rank: i + 1,
      group,
      why_recommended: why,
    };
  });

  return { flightRecommendations: cards, missing_fields: [], no_direct_available };
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  cityId: string = DEFAULT_CITY,
  gpsCoords: { lat: number; lng: number } | null = null,
  nearLocation?: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string,
  streamCallbacks?: StreamCallbacks,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): Promise<{
  requirements: UserRequirements | HotelIntent | FlightIntent;
  recommendations: RecommendationCard[];
  hotelRecommendations: HotelRecommendationCard[];
  flightRecommendations: FlightRecommendationCard[];
  missing_flight_fields: string[];
  no_direct_available: boolean;
  suggested_refinements: string[];
  category: CategoryType;
}> {
  const city = CITIES[cityId] ?? CITIES[DEFAULT_CITY];
  const cityFullName = gpsCoords ? "your current location" : city.fullName;

  // Layer 1: Parse intent (with session preferences + profile context)
  const intent = await parseIntent(
    userMessage,
    cityFullName,
    sessionPreferences,
    profileContext
  );

  // Route to flight pipeline if needed
  if (intent.category === "flight") {
    const { flightRecommendations, missing_fields, no_direct_available } = await runFlightPipeline(intent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations,
      missing_flight_fields: missing_fields,
      no_direct_available,
      suggested_refinements: [],
      category: "flight",
    };
  }

  // Route to hotel pipeline if needed
  if (intent.category === "hotel") {
    const { hotelRecommendations, suggested_refinements } = await runHotelPipeline(
      intent,
      conversationHistory,
      cityFullName,
    );
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations,
      flightRecommendations: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements,
      category: "hotel",
    };
  }

  // Otherwise continue with restaurant pipeline
  const requirements: UserRequirements = intent;

  // Layer 2+3: Gather candidates (parallel search)
  const { restaurants, semanticSignals, tavilyQuery } = await gatherCandidates(
    requirements,
    cityId,
    gpsCoords,
    nearLocation
  );

  // Phase 4.1: Send partial results after candidate gathering
  if (streamCallbacks?.onPartial) {
    // Quick top 3 sorted by rating * log(review_count + 1)
    const quickTop3: RecommendationCard[] = restaurants
      .slice()
      .sort((a, b) => b.rating * Math.log(b.review_count + 1) - a.rating * Math.log(a.review_count + 1))
      .slice(0, 3)
      .map((r, i) => ({
        restaurant: r,
        rank: i + 1,
        score: r.rating,
        why_recommended: `${r.name} — ⭐${r.rating} (${r.review_count} reviews)`,
        best_for: r.cuisine,
        watch_out: "",
        not_great_if: "",
        estimated_total: r.price,
      }));
    streamCallbacks.onPartial(quickTop3, requirements);
  }

  // Phase 3.1: Extract review signals for top candidates (non-blocking)
  const reviewSignalsMap = await fetchReviewSignals(
    restaurants.slice(0, 12),
    tavilyQuery,
    cityFullName
  ).catch(() => new Map());

  // Inject review signals into restaurant objects
  const candidatesWithSignals = restaurants.map((r) => ({
    ...r,
    review_signals: reviewSignalsMap.get(r.name),
  }));

  // Layer 4+5+6: Rank and explain (with scoring + preferences)
  const { cards, suggested_refinements } = await rankAndExplain(
    requirements,
    candidatesWithSignals,
    semanticSignals,
    conversationHistory,
    cityFullName,
    sessionPreferences,
    profileContext,
    customWeights
  );

  // Add OpenTable search URLs
  const withOpenTable = cards.map((card) => ({
    ...card,
    opentable_url: card.restaurant?.name
      ? `https://www.opentable.com/s?term=${encodeURIComponent(card.restaurant.name + " " + city.fullName)}&covers=${requirements.party_size ?? 2}`
      : undefined,
  }));

  return { requirements, recommendations: withOpenTable, hotelRecommendations: [], flightRecommendations: [], missing_flight_fields: [], no_direct_available: false, suggested_refinements, category: "restaurant" };
}
