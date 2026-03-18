import { Restaurant } from "./types";

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
