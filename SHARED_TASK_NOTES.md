# Shared Task Notes

## Status
Phase 8 complete. Build passes cleanly. All PLAN.md phases (1–8) done.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate
- middleware renamed to `proxy.ts` (Next.js 16 convention)

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 8 features (implemented this iteration)

### Three-category Intent Architecture
- `CategoryType = "restaurant" | "hotel" | "flight" | "unknown"`
- `FlightIntent extends BaseIntent` in `lib/types.ts`
- `Flight`, `FlightRecommendationCard` types in `lib/types.ts`
- `detectCategory()` in `lib/agent.ts` checks flight keywords before hotel keywords

### Flight Search Pipeline
- `searchFlights()` in `lib/tools.ts` — calls SerpApi `google_flights` engine
- Result grouping: direct×3, 1-stop×1, 2-stop×1 (or direct×5 if `prefer_direct`)
- `AIRPORT_COORDS` lookup table for 30 major US airports (for map arc rendering)
- `runFlightPipeline()` in `lib/agent.ts` — checks missing fields, calls searchFlights, builds cards
- Missing fields (departure/arrival/date) trigger a follow-up question to the user

### FlightCard UI (`components/FlightCard.tsx`)
- Rank badge, airline logo/icon, nonstop/1-stop/2-stop badge
- Departure time → arrival time with arc SVG + duration
- Layover city + duration shown if applicable
- Price + "Book on Google Flights →" deep link (pre-filled with airports + date)

### Map Mode for Flights
- `MapView` accepts `flightCards?: FlightRecommendationCard[]` prop
- Renders great-circle arc (dashed gold Polyline) between departure + arrival airports
- Departure marker: dark badge with IATA code; Arrival marker: gold badge with IATA code
- Bottom strip shows flight cards; selecting one updates the arc

### SSE Response
- `complete` event now includes `flightRecommendations` and `missing_flight_fields`
- `useChat.ts` tracks `allFlightCards: FlightRecommendationCard[]`

## To activate flight search
Add `SERPAPI_KEY` to `.env.local` (same key used for hotel search).
Without the key, flight queries return empty results gracefully with a message.

## To activate hotel search
Add `SERPAPI_KEY` to `.env.local` (register at https://serpapi.com — 250 free searches/month).
Without the key, hotel queries return empty results gracefully.

## To activate Clerk/accounts
1. Create project at https://clerk.com
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Provision Vercel Postgres (or Neon) and add `POSTGRES_URL`
4. Run SQL in `lib/schema.sql` to create tables

## Remaining work
All PLAN.md phases (1–8) complete. Future backlog: Itinerary Builder, community reviews.
