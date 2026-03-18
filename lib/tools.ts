import { Restaurant, ReviewSignals, GoogleReview, Hotel } from "./types";

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
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName,places.websiteUri,places.photos,places.regularOpeningHours,places.editorialSummary,places.location,places.reviews",
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
  const results: Restaurant[] = (data.places ?? []).map((p: any) => {
    // Map Google Places v1 reviews to GoogleReview[]
    const google_reviews: GoogleReview[] | undefined = p.reviews
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.reviews.map((rv: any) => ({
          author_name: rv.authorAttribution?.displayName ?? "Anonymous",
          rating: rv.rating ?? 0,
          relative_time_description: rv.relativePublishTimeDescription ?? "",
          text: rv.text?.text ?? "",
        })).filter((rv: GoogleReview) => rv.text.length > 0)
      : undefined;

    return {
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
      google_reviews,
    };
  });

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

/**
 * Builds review text for a single restaurant from its Google reviews.
 * Returns null if insufficient reviews (< 2).
 */
function formatGoogleReviews(restaurant: Restaurant): string | null {
  const reviews = restaurant.google_reviews;
  if (!reviews || reviews.length < 2) return null;
  return reviews
    .map(
      (rv, i) =>
        `[Review ${i + 1} - ${rv.rating} stars - "${rv.relative_time_description}"]\n"${rv.text}"`
    )
    .join("\n\n");
}

export async function fetchReviewSignals(
  restaurants: Restaurant[],
  query: string,
  cityFullName: string
): Promise<Map<string, ReviewSignals>> {
  if (restaurants.length === 0) return new Map();

  const candidates = restaurants.slice(0, 12);
  const MINIMAX_API_URL = "https://api.minimaxi.chat/v1/chat/completions";

  const systemPrompt = `You are extracting review signals for restaurants from real user reviews. For each restaurant in the input, analyze the provided review text and extract structured signals. Return a JSON object where keys are exact restaurant names and values match the ReviewSignals schema. If a signal cannot be determined from the text, use "unknown" for noise_level, empty string for wait_time/service_pace, 5 for date_suitability, and [] for arrays. Only report signals that have clear evidence in the text. Be conservative: weight negative signals more when they appear in multiple reviews.

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

  // Separate restaurants into those with Google reviews vs. those needing Tavily fallback
  const withGoogleReviews: Restaurant[] = [];
  const needsTavily: Restaurant[] = [];

  for (const r of candidates) {
    const formatted = formatGoogleReviews(r);
    if (formatted) {
      withGoogleReviews.push(r);
    } else {
      needsTavily.push(r);
    }
  }

  // Build combined review content for the AI prompt
  let combinedReviewText = "";

  // Add Google reviews for restaurants that have them
  if (withGoogleReviews.length > 0) {
    combinedReviewText += withGoogleReviews
      .map((r) => {
        const reviewsFormatted = formatGoogleReviews(r);
        return `=== ${r.name} (Google Maps reviews) ===\n${reviewsFormatted}`;
      })
      .join("\n\n");
  }

  // Fetch Tavily reviews for restaurants without Google reviews
  if (needsTavily.length > 0) {
    try {
      const names = needsTavily.map((r) => r.name).join(", ");
      const searchQuery = `${names} reviews ${cityFullName} noise atmosphere experience site:reddit.com OR site:yelp.com`;
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: searchQuery,
          search_depth: "advanced",
          max_results: 8,
          include_domains: ["yelp.com", "tripadvisor.com", "reddit.com"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const tavilyText = (data.results ?? [])
          .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
          .join("\n\n");
        if (tavilyText) {
          combinedReviewText += (combinedReviewText ? "\n\n" : "") +
            `=== Additional review data (Yelp/Reddit) ===\n${tavilyText}`;
        }
      }
    } catch {
      // non-fatal
    }
  }

  if (!combinedReviewText) return new Map();

  const restaurantList = candidates.map((r) => r.name).join(", ");

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

Review content:
${combinedReviewText.slice(0, 10000)}

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

// ─── Phase 7.2: Hotel Search via SerpApi ─────────────────────────────────────

export async function searchHotels(params: {
  location: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  hotel_class?: number;
  maxResults?: number;
}): Promise<Hotel[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("SERPAPI_KEY not set, returning empty hotel results");
    return [];
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const checkIn = params.check_in ?? formatDate(tomorrow);
  const checkOut = params.check_out ?? formatDate(dayAfter);

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_hotels");
  url.searchParams.set("q", `hotels in ${params.location}`);
  url.searchParams.set("check_in_date", checkIn);
  url.searchParams.set("check_out_date", checkOut);
  url.searchParams.set("adults", String(params.guests ?? 2));
  if (params.hotel_class) {
    url.searchParams.set("hotel_class", String(params.hotel_class));
  }
  url.searchParams.set("currency", "USD");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("SerpApi hotel search failed:", res.status);
      return [];
    }
    const data = await res.json();
    const properties: Array<Record<string, unknown>> = data.properties ?? [];

    return properties.slice(0, params.maxResults ?? 20).map((p, i): Hotel => {
      const prices = p.rate_per_night as Record<string, unknown> | undefined;
      const pricePerNight = prices?.extracted_lowest
        ? Number(prices.extracted_lowest)
        : 0;

      const nights =
        params.check_in && params.check_out
          ? Math.max(
              1,
              Math.round(
                (new Date(params.check_out).getTime() -
                  new Date(params.check_in).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 1;

      const amenities: string[] = Array.isArray(p.amenities)
        ? (p.amenities as string[]).slice(0, 8)
        : [];

      return {
        id: String(p.property_token ?? `hotel-${i}`),
        name: String(p.name ?? "Unknown Hotel"),
        star_rating: Number(p.hotel_class ?? 3),
        price_per_night: pricePerNight,
        total_price: Math.round(pricePerNight * nights),
        rating: Number(p.overall_rating ?? 0),
        review_count: Number(p.reviews ?? 0),
        address: String(p.location ?? ""),
        neighborhood: String(p.neighborhood ?? ""),
        distance_to_center: String(p.distance ?? ""),
        amenities,
        thumbnail: String(
          (p.images as Array<Record<string, string>> | undefined)?.[0]
            ?.thumbnail ?? ""
        ),
        booking_link: String(p.link ?? `https://www.google.com/travel/hotels`),
        description: String(p.description ?? ""),
        lat: (p.gps_coordinates as Record<string, number> | undefined)?.latitude,
        lng: (p.gps_coordinates as Record<string, number> | undefined)?.longitude,
      };
    });
  } catch (err) {
    console.warn("searchHotels error:", err);
    return [];
  }
}
