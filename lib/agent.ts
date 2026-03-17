import Anthropic from "@anthropic-ai/sdk";
import { googlePlacesSearch, tavilySearch } from "./tools";
import { UserRequirements, Restaurant, RecommendationCard } from "./types";

const client = new Anthropic();

// ─── Layer 1: Intent Parsing ──────────────────────────────────────────────────

export async function parseIntent(userMessage: string): Promise<UserRequirements> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract structured requirements from this restaurant request. Return ONLY valid JSON.

User request: "${userMessage}"

Return JSON with these fields (omit fields that aren't mentioned):
{
  "cuisine": "string or null",
  "purpose": "date|business|family|friends|solo|group|null",
  "budget_per_person": number or null,
  "budget_total": number or null,
  "atmosphere": ["romantic", "quiet", "lively", "cozy", "trendy", etc],
  "noise_level": "quiet|moderate|lively|any",
  "location": "SF neighborhood or 'San Francisco, CA'",
  "neighborhood": "specific neighborhood or null",
  "party_size": number or null,
  "constraints": ["no chains", "no tourist traps", "no wait", etc],
  "priorities": ["atmosphere", "food quality", "price", "service", etc]
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}

// ─── Layer 2+3: Search & Collect (parallel) ──────────────────────────────────

async function gatherCandidates(
  requirements: UserRequirements
): Promise<{ restaurants: Restaurant[]; semanticSignals: string }> {
  const location = requirements.neighborhood
    ? `${requirements.neighborhood}, San Francisco, CA`
    : requirements.location ?? "San Francisco, CA";

  // Map budget to Yelp price filter
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
    "restaurant San Francisco",
    requirements.purpose === "date" ? "romantic date night" : "",
    requirements.atmosphere?.join(" "),
    requirements.noise_level === "quiet" ? "quiet atmosphere" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Parallel: Google Places + Tavily
  const [restaurants, semanticSignals] = await Promise.all([
    googlePlacesSearch({ query: searchQuery, location, maxResults: 20 }),
    tavilySearch(`best ${tavilyQuery} reviews 2024`),
  ]);

  // Hard filter: remove low-rated
  const filtered = restaurants.filter((r) => {
    if (r.rating < 3.5) return false;
    if (r.review_count < 10) return false;
    return true;
  });

  return { restaurants: filtered.slice(0, 20), semanticSignals };
}

// ─── Layer 4+5+6: Rank, Score, Explain ───────────────────────────────────────

async function rankAndExplain(
  requirements: UserRequirements,
  restaurants: Restaurant[],
  semanticSignals: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<RecommendationCard[]> {
  const restaurantList = restaurants
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} | ${r.cuisine} | ${r.price} | ⭐${r.rating} (${r.review_count} reviews) | ${r.address}`
    )
    .join("\n");

  const systemPrompt = `You are an expert SF restaurant advisor. Your job is to pick the best restaurants for the user's specific needs and explain exactly why each one fits or doesn't fit.

Be honest about downsides. Don't recommend places that don't fit. Quality of matching matters more than quantity.`;

  const messages = [
    ...conversationHistory,
    {
      role: "user" as const,
      content: `User requirements: ${JSON.stringify(requirements, null, 2)}

Candidate restaurants:
${restaurantList}

Additional context from web search:
${semanticSignals}

Pick the TOP 10 restaurants that best match the user's needs. For each one, return a JSON array with this structure:
[
  {
    "rank": 1,
    "restaurant_index": 0,
    "score": 8.5,
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const ranked = JSON.parse(jsonMatch[0]);
    return ranked.map((item: any) => ({
      ...item,
      restaurant: restaurants[item.restaurant_index],
    }));
  } catch {
    return [];
  }
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{
  requirements: UserRequirements;
  recommendations: RecommendationCard[];
}> {
  // Layer 1: Parse intent
  const requirements = await parseIntent(userMessage);

  // Layer 2+3: Gather candidates (parallel search)
  const { restaurants, semanticSignals } = await gatherCandidates(requirements);

  // Layer 4+5+6: Rank and explain
  const recommendations = await rankAndExplain(
    requirements,
    restaurants,
    semanticSignals,
    conversationHistory
  );

  // Add OpenTable search URLs
  const withOpenTable = recommendations.map((card) => ({
    ...card,
    opentable_url: card.restaurant?.name
      ? `https://www.opentable.com/s?term=${encodeURIComponent(card.restaurant.name)}&metroId=4&covers=${requirements.party_size ?? 2}`
      : undefined,
  }));

  return { requirements, recommendations: withOpenTable };
}
