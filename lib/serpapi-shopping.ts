export interface ShoppingSearchParams {
  query: string;
  maxResults?: number;
}

export interface ShoppingProduct {
  title: string;
  price?: number; // USD
  price_raw?: string; // e.g. "$49.99"
  source?: string; // retailer name
  link?: string;
  image_url?: string;
  rating?: number;
  reviews?: number;
  extensions?: string[]; // e.g. ["Free delivery", "4.5 stars"]
}

interface SerpApiShoppingResult {
  title?: string;
  price?: string;
  source?: string;
  link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  extensions?: string[];
}

function parsePrice(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

export async function searchShoppingProducts(
  params: ShoppingSearchParams
): Promise<ShoppingProduct[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("[serpapi-shopping] SERPAPI_KEY not set — returning empty results");
    return [];
  }

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", params.query);
  url.searchParams.set("num", String(params.maxResults ?? 10));
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    if (!res.ok) {
      console.warn(`[serpapi-shopping] API error ${res.status}: ${await res.text().catch(() => "")}`);
      return [];
    }

    const data = await res.json();
    const results: SerpApiShoppingResult[] = data?.shopping_results ?? [];

    return results
      .filter((r): r is SerpApiShoppingResult & { title: string } => Boolean(r.title))
      .map((r) => ({
        title: r.title,
        price: parsePrice(r.price),
        price_raw: r.price,
        source: r.source,
        link: r.link,
        image_url: r.thumbnail,
        rating: r.rating,
        reviews: r.reviews,
        extensions: r.extensions,
      }));
  } catch (err) {
    console.warn("[serpapi-shopping] fetch failed:", err);
    return [];
  }
}
