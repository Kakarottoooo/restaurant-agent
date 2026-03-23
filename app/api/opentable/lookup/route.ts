import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/opentable/lookup?name=...&city=...&covers=2
 *
 * Resolves an OpenTable restaurant `rid` (numeric restref) by scraping the
 * OpenTable search page for the given restaurant name + city.
 *
 * Returns { rid: number } on success or { rid: null } if not found.
 * The rid can be used to embed the OpenTable reservation widget:
 *   https://www.opentable.com/widget/reservation/loader?rid={rid}&...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const city = searchParams.get("city") ?? "";
  const covers = searchParams.get("covers") ?? "2";

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(`${name} ${city}`.trim());
    const searchUrl = `https://www.opentable.com/s?term=${query}&covers=${covers}`;

    const html = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.text());

    // OpenTable embeds all page data in a __NEXT_DATA__ script tag
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      return NextResponse.json({ rid: null });
    }

    const nextData = JSON.parse(match[1]);

    // Navigate to the restaurants array in the page props
    const restaurants: Array<{ restref?: number; name?: string; city?: string }> =
      nextData?.props?.pageProps?.initialData?.search?.results ?? [];

    if (!restaurants.length) {
      return NextResponse.json({ rid: null });
    }

    // Return the first result's restref as the rid
    const firstResult = restaurants[0];
    const rid = firstResult?.restref ?? null;

    return NextResponse.json({ rid: rid ?? null });
  } catch {
    return NextResponse.json({ rid: null });
  }
}
