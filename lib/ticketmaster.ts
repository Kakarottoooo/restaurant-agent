import { TicketmasterEvent } from "./types";

const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

export interface TicketmasterSearchParams {
  keyword?: string;
  city?: string;
  startDateTime?: string; // ISO 8601 e.g. "2026-04-12T00:00:00Z"
  endDateTime?: string;
  classificationName?: string; // "Music" | "Sports" | "Arts & Theatre" | "Comedy"
  size?: number;
}

interface TmVenue {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
}

interface TmEvent {
  id?: string;
  name?: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  _embedded?: { venues?: TmVenue[] };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  classifications?: Array<{ genre?: { name?: string }; subGenre?: { name?: string } }>;
  images?: Array<{ url?: string; width?: number; ratio?: string }>;
}

function parseTmEvent(event: TmEvent, fallbackCity: string): TicketmasterEvent | null {
  if (!event.name || !event.url) return null;

  const venue = event._embedded?.venues?.[0];
  const venueName = venue?.name ?? "Venue TBD";
  const venueAddress = [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(", ");
  const city = venue?.city?.name ?? fallbackCity;

  const date = event.dates?.start?.localDate ?? "";
  const time = event.dates?.start?.localTime?.slice(0, 5); // "20:00"

  const price = event.priceRanges?.[0];
  const genre = event.classifications?.[0]?.genre?.name;

  // Pick largest image or first one
  const image =
    event.images?.find((img) => img.ratio === "16_9" && (img.width ?? 0) >= 640)?.url ??
    event.images?.[0]?.url;

  return {
    id: event.id ?? event.url,
    name: event.name,
    url: event.url,
    date,
    time,
    venue_name: venueName,
    venue_address: venueAddress,
    city,
    genre: genre && genre !== "Undefined" ? genre : undefined,
    price_min: price?.min,
    price_max: price?.max,
    image_url: image,
  };
}

export async function searchConcertEvents(
  params: TicketmasterSearchParams
): Promise<TicketmasterEvent[]> {
  const API_KEY = process.env.TICKETMASTER_API_KEY ?? "";
  if (!API_KEY) {
    console.warn("[ticketmaster] TICKETMASTER_API_KEY not set — returning empty results");
    return [];
  }

  const query = new URLSearchParams({
    apikey: API_KEY,
    size: String(params.size ?? 10),
  });
  if (params.keyword) query.set("keyword", params.keyword);
  if (params.city) query.set("city", params.city);
  if (params.startDateTime) query.set("startDateTime", params.startDateTime);
  if (params.endDateTime) query.set("endDateTime", params.endDateTime);
  if (params.classificationName) query.set("classificationName", params.classificationName);

  try {
    const res = await fetch(`${BASE_URL}?${query.toString()}`, {
      headers: { Accept: "application/json" },
      // Next.js fetch cache: revalidate every 10 minutes
      next: { revalidate: 600 },
    } as RequestInit);

    if (!res.ok) {
      console.warn(`[ticketmaster] API error ${res.status}: ${await res.text().catch(() => "")}`);
      return [];
    }

    const data = await res.json();
    const rawEvents: TmEvent[] = data?._embedded?.events ?? [];
    const fallbackCity = params.city ?? "";

    return rawEvents
      .map((e) => parseTmEvent(e, fallbackCity))
      .filter((e): e is TicketmasterEvent => e !== null && e.date !== "");
  } catch (err) {
    console.warn("[ticketmaster] fetch failed:", err);
    return [];
  }
}
