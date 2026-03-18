// import Anthropic from "@anthropic-ai/sdk";
// const client = new Anthropic();

import { googlePlacesSearch, tavilySearch, geocodeLocation, fetchReviewSignals } from "./tools";
import { UserRequirements, Restaurant, RecommendationCard, SessionPreferences, ScoringDimensions } from "./types";
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

const DEFAULT_WEIGHTS = {
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

// ─── Layer 1: Intent Parsing ──────────────────────────────────────────────────

export async function parseIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<UserRequirements> {
  const prefContext = sessionPreferences
    ? formatSessionPreferences(sessionPreferences)
    : "";

  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract structured requirements from this restaurant request. Return ONLY valid JSON.

User request: "${userMessage}"
City: ${cityFullName}
${prefContext ? `\n${prefContext}` : ""}
${profileContext ? `\nUser profile: ${profileContext}` : ""}

Return JSON with these fields (omit fields that aren't mentioned):
{
  "cuisine": "string or null",
  "purpose": "date|business|family|friends|solo|group|null",
  "budget_per_person": number or null,
  "budget_total": number or null,
  "atmosphere": ["romantic", "quiet", "lively", "cozy", "trendy", etc],
  "noise_level": "quiet|moderate|lively|any",
  "location": "${cityFullName}",
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
  if (!jsonMatch) return {};
  try {
    const parsed = UserRequirementsSchema.safeParse(JSON.parse(jsonMatch[0]));
    return parsed.success ? (parsed.data as UserRequirements) : {};
  } catch {
    return {};
  }
}

// ─── Layer 2+3: Search & Collect (parallel) ──────────────────────────────────

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

  const tavilyQuery = [
    requirements.cuisine,
    `restaurant ${city.fullName}`,
    requirements.purpose === "date" ? "romantic date night" : "",
    requirements.atmosphere?.join(" "),
    requirements.noise_level === "quiet" ? "quiet atmosphere" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Parallel: Google Places + Tavily (Tavily failure is non-fatal)
  const [restaurants, tavilyResult] = await Promise.all([
    googlePlacesSearch({
      query: searchQuery,
      location,
      cityCenter,
      nearLocationCoords,
      maxResults: 20,
    }),
    tavilySearch(`best ${tavilyQuery} reviews 2024`).catch((err) => {
      console.warn("Tavily search failed:", err);
      return { results: "", failed: true };
    }),
  ]);
  const semanticSignals = tavilyResult.failed ? "" : tavilyResult.results;

  // Hard filter: remove low-rated
  const filtered = restaurants.filter((r) => {
    if (r.rating < 3.5) return false;
    if (r.review_count < 10) return false;
    return true;
  });

  return { restaurants: filtered.slice(0, 20), semanticSignals, tavilyQuery };
}

// ─── Layer 4+5+6: Rank, Score, Explain ───────────────────────────────────────

async function rankAndExplain(
  requirements: UserRequirements,
  restaurants: Restaurant[],
  semanticSignals: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<RecommendationCard[]> {
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

Pick the TOP 10 restaurants that best match the user's needs. For each one, fill in scoring dimensions honestly, then write the explanation. Return a JSON array:
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
    "estimated_total": "$80-100 for two with drinks"
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
  if (!jsonMatch) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  const parsed = RankedItemArraySchema.safeParse(raw);
  if (!parsed.success) return [];

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
        const weighted_total = computeWeightedScore(item.scoring);
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

  return cards;
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  cityId: string = DEFAULT_CITY,
  gpsCoords: { lat: number; lng: number } | null = null,
  nearLocation?: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<{
  requirements: UserRequirements;
  recommendations: RecommendationCard[];
}> {
  const city = CITIES[cityId] ?? CITIES[DEFAULT_CITY];
  const cityFullName = gpsCoords ? "your current location" : city.fullName;

  // Layer 1: Parse intent (with session preferences + profile context)
  const requirements = await parseIntent(
    userMessage,
    cityFullName,
    sessionPreferences,
    profileContext
  );

  // Layer 2+3: Gather candidates (parallel search)
  const { restaurants, semanticSignals, tavilyQuery } = await gatherCandidates(
    requirements,
    cityId,
    gpsCoords,
    nearLocation
  );

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
  const recommendations = await rankAndExplain(
    requirements,
    candidatesWithSignals,
    semanticSignals,
    conversationHistory,
    cityFullName,
    sessionPreferences,
    profileContext
  );

  // Add OpenTable search URLs
  const withOpenTable = recommendations.map((card) => ({
    ...card,
    opentable_url: card.restaurant?.name
      ? `https://www.opentable.com/s?term=${encodeURIComponent(card.restaurant.name + " " + city.fullName)}&covers=${requirements.party_size ?? 2}`
      : undefined,
  }));

  return { requirements, recommendations: withOpenTable };
}
