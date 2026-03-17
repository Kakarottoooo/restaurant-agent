import { Restaurant } from "./types";

// ─── Google Places API ────────────────────────────────────────────────────────

export async function googlePlacesSearch(params: {
  query: string;
  location?: string;
  maxResults?: number;
}): Promise<Restaurant[]> {
  const location = params.location ?? "San Francisco, CA";
  const textQuery = `${params.query} in ${location}`;

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
            center: { latitude: 37.7749, longitude: -122.4194 },
            radius: 20000,
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

  return (data.places ?? []).map((p: any) => ({
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

export async function tavilySearch(query: string): Promise<string> {
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

  if (!res.ok) return "";

  const data = await res.json();
  return (data.results ?? [])
    .map((r: any) => `${r.title}: ${r.content}`)
    .join("\n\n");
}
