/**
 * Pre-filled deep link URL builders for booking actions.
 *
 * Each builder accepts optional structured fields (dates, guests, city)
 * from parsed intent and returns a URL that lands on a filtered results
 * page — not a generic homepage.
 */

/** Parse "YYYY-MM-DD" into year/month/day parts for query params. */
function parseDateParts(
  date: string
): { year: string; month: string; day: string } | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    year: m[1],
    month: String(parseInt(m[2], 10)),
    day: String(parseInt(m[3], 10)),
  };
}

export interface GoogleHotelsOpts {
  hotelName?: string;
  city: string;
  checkin?: string; // YYYY-MM-DD
  checkout?: string; // YYYY-MM-DD
  adults?: number;
}

/**
 * Build a Google Hotels search URL pre-filled with city, dates, and guests.
 * Format: /travel/hotels?q={query}&dates={checkin}/{checkout}&adults={n}
 */
export function buildGoogleHotelsUrl(opts: GoogleHotelsOpts): string {
  const q = opts.hotelName
    ? `${opts.hotelName} ${opts.city}`
    : `hotels in ${opts.city}`;
  const params: Record<string, string> = { q };
  if (opts.checkin && opts.checkout) {
    params.dates = `${opts.checkin}/${opts.checkout}`;
  } else if (opts.checkin) {
    params.dates = opts.checkin;
  }
  if (opts.adults) params.adults = String(opts.adults);
  return `https://www.google.com/travel/hotels?${new URLSearchParams(params).toString()}`;
}

export interface BookingComOpts {
  city: string;
  checkin?: string; // YYYY-MM-DD
  checkout?: string; // YYYY-MM-DD
  adults?: number;
}

/**
 * Build a Booking.com search URL pre-filled with city, checkin/checkout
 * dates, and number of adults.
 */
export function buildBookingComUrl(opts: BookingComOpts): string {
  const params: Record<string, string> = { ss: opts.city };
  if (opts.checkin) {
    const d = parseDateParts(opts.checkin);
    if (d) {
      params.checkin_year = d.year;
      params.checkin_month = d.month;
      params.checkin_monthday = d.day;
    }
  }
  if (opts.checkout) {
    const d = parseDateParts(opts.checkout);
    if (d) {
      params.checkout_year = d.year;
      params.checkout_month = d.month;
      params.checkout_monthday = d.day;
    }
  }
  if (opts.adults) params.group_adults = String(opts.adults);
  return `https://www.booking.com/search.html?${new URLSearchParams(params).toString()}`;
}

export interface GoogleFlightsOpts {
  origin: string; // IATA airport code or city name
  dest: string; // IATA airport code or city name
  date?: string; // YYYY-MM-DD (outbound)
  returnDate?: string; // YYYY-MM-DD (return leg)
}

/**
 * Build a Google Flights deep link pre-filled with origin, destination, and dates.
 * Uses the fragment-based format: #flt={legs};c:USD;e:1;sd:1;t:f
 */
export function buildGoogleFlightsUrl(opts: GoogleFlightsOpts): string {
  if (opts.date) {
    const leg1 = `${opts.origin}.${opts.dest}.${opts.date}`;
    const leg2 = opts.returnDate
      ? `${opts.dest}.${opts.origin}.${opts.returnDate}`
      : "";
    const flt = [leg1, leg2].filter(Boolean).join("*");
    return `https://www.google.com/flights?hl=en#flt=${flt};c:USD;e:1;sd:1;t:f`;
  }
  // Fallback when no date: plain search query
  const q = `Flights from ${opts.origin} to ${opts.dest}`;
  return `https://www.google.com/travel/flights?${new URLSearchParams({ q }).toString()}`;
}

export interface OpenTableOpts {
  restaurantName?: string;
  city?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h)
  covers?: number;
}

/**
 * Build an OpenTable search URL pre-filled with date, time, covers, and
 * restaurant or city as a search term.
 */
export function buildOpenTableUrl(opts: OpenTableOpts): string {
  const params: Record<string, string> = {};
  if (opts.covers) params.covers = String(opts.covers);
  if (opts.date) {
    const timeStr = opts.time ?? "19:00";
    params.dateTime = `${opts.date}T${timeStr}:00`;
  }
  const term = opts.restaurantName ?? opts.city ?? "";
  if (term) params.term = term;
  return `https://www.opentable.com/s?${new URLSearchParams(params).toString()}`;
}
