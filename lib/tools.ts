import { Restaurant, ReviewSignals } from "./types";

// ─── Geocoding ────────────────────────────────────────────────────────────────

export async function geocodeLocation(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
  } catch {
    return null;
  }
}

// ─── Haversine distance (meters) ─────────────────────────────────────────────

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Google Places API ────────────────────────────────────────────────────────

export async function googlePlacesSearch(params: {
  query: string;
  location?: string;
  cityCenter?: { lat: number; lng: number };
  nearLocationCoords?: { lat: number; lng: number };
  maxResults?: number;
}): Promise<Restaurant[]> {
  const location = params.location ?? "San Francisco, CA";
  const textQuery = `${params.query} in ${location}`;
  const center =
    params.nearLocationCoords ??
    params.cityCenter ?? { lat: 37.7749, lng: -122.4194 };
  const radius = params.nearLocationCoords ? 5000 : 20000;

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName,places.websiteUri,places.photos,places.regularOpeningHours,places.editorialSummary,places.location",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: params.maxResults ?? 20,
        locationBias: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places search failed: ${err}`);
  }

  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: Restaurant[] = (data.places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text ?? "",
    cuisine: p.primaryTypeDisplayName?.text ?? "Restaurant",
    price: priceLevelToSymbol(p.priceLevel),
    rating: p.rating ?? 0,
    review_count: p.userRatingCount ?? 0,
    address: p.formattedAddress ?? "",
    url: p.websiteUri,
    image_url: p.photos?.[0]
      ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=400&key=${process.env.GOOGLE_PLACES_API_KEY}`
      : undefined,
    is_closed: false,
    description: p.editorialSummary?.text,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  }));

  // If nearLocationCoords provided, calculate distances and sort by proximity
  if (params.nearLocationCoords) {
    const { lat: tLat, lng: tLng } = params.nearLocationCoords;
    for (const r of results) {
      if (r.lat !== undefined && r.lng !== undefined) {
        r.distance = haversineDistance(tLat, tLng, r.lat, r.lng);
      }
    }
    results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  return results;
}

// ─── Review Signal Extraction ─────────────────────────────────────────────────

export async function fetchReviewSignals(
  restaurants: Restaurant[],
  query: string,
  cityFullName: string
): Promise<Map<string, ReviewSignals>> {
  if (restaurants.length === 0) return new Map();

  const names = restaurants
    .slice(0, 12)
    .map((r) => r.name)
    .join(", ");
  const searchQuery = `${names} reviews ${cityFullName} noise atmosphere date experience`;

  // Fetch review content from Tavily with advanced depth
  let reviewText = "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 10,
        include_domains: [
          "yelp.com",
          "tripadvisor.com",
          "reddit.com",
          "google.com",
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      reviewText = (data.results ?? [])
        .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
        .join("\n\n");
    }
  } catch {
    // non-fatal
  }

  if (!reviewText) return new Map();

  // Use MiniMax to extract structured signals
  const MINIMAX_API_URL = "https://api.minimaxi.chat/v1/chat/completions";
  const restaurantList = restaurants
    .slice(0, 12)
    .map((r) => r.name)
    .join(", ");

  const systemPrompt = `You are extracting review signals for restaurants. For each restaurant mentioned below, analyze the provided review text and extract structured signals. Return a JSON object where keys are exact restaurant names and values match the ReviewSignals schema. If a signal cannot be determined from the text, use "unknown" for noise_level/wait_time/service_pace, 5 for date_suitability, and [] for arrays. Only report signals that have clear evidence in the text.

ReviewSignals schema:
{
  "noise_level": "quiet" | "moderate" | "loud" | "unknown",
  "wait_time": string,
  "date_suitability": number (1-10),
  "service_pace": string,
  "notable_dishes": string[],
  "red_flags": string[],
  "best_for": string[],
  "review_confidence": "high" | "medium" | "low"
}`;

  try {
    const res = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: "MiniMax-Text-01",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Restaurants to analyze: ${restaurantList}

Review text:
${reviewText.slice(0, 8000)}

User query context: "${query}"

Return ONLY a JSON object with restaurant names as keys and ReviewSignals as values.`,
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) return new Map();

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return new Map();

    const parsed = JSON.parse(jsonMatch[0]);
    const result = new Map<string, ReviewSignals>();
    for (const [name, signals] of Object.entries(parsed)) {
      result.set(name, signals as ReviewSignals);
    }
    return result;
  } catch {
    return new Map();
  }
}

function priceLevelToSymbol(level?: string): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "$",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level ?? ""] ?? "$$";
}

// ─── Tavily ──────────────────────────────────────────────────────────────────

export async function tavilySearch(
  query: string
): Promise<{ results: string; failed: boolean }> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!res.ok) {
    console.warn(`Tavily search failed (${res.status})`);
    return { results: "", failed: true };
  }

  const data = await res.json();
  const results = (data.results ?? [])
    .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
    .join("\n\n");
  return { results, failed: false };
}
