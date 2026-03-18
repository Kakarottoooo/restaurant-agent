# Shared Task Notes

## Status
Phase 7 complete. Build passes cleanly. All PLAN.md phases (1–7) done.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate
- middleware renamed to `proxy.ts` (Next.js 16 convention)

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 7 features (implemented this iteration)

### Phase 7.1 — Two-layer Intent Architecture
- `CategoryType`, `BaseIntent`, `RestaurantIntent`, `HotelIntent`, `ParsedIntent` in `lib/types.ts`
- `detectCategory()` in `lib/agent.ts` — keyword-based hotel detection (instant, no AI call)
- `parseRestaurantIntent()` — renamed from old `parseIntent`, unexported
- `parseHotelIntent()` — AI-driven extraction of check_in/check_out/nights/guests/star_rating/amenities
- New exported `parseIntent()` dispatches to restaurant or hotel branch
- `runAgent()` routes hotel intents to `runHotelPipeline()` before the restaurant pipeline

### Phase 7.2 — Hotel Search Pipeline
- `Hotel`, `HotelRecommendationCard` types in `lib/types.ts`
- `searchHotels()` in `lib/tools.ts` — calls SerpApi `google_hotels` engine
- `HOTEL_DEFAULT_WEIGHTS` in `lib/agent.ts` (budget_match 30%, scene_match 25%, review_quality 20%, location_convenience 20%, preference_match 5%)
- `runHotelPipeline()` in `lib/agent.ts` — search → pre-filter → AI rank/explain
- `runAgent()` returns `{ category, recommendations, hotelRecommendations, suggested_refinements }`
- `/api/chat/route.ts` SSE `complete` event now includes `category` and `hotelRecommendations`

### Phase 7.3 — Date Range Picker
- `components/DateRangePicker.tsx` — mobile-friendly bottom-sheet with native date inputs
- Auto-advances check-out when check-in is changed past it
- Shows nights summary before confirming
- Shown in chat when `resultCategory === "hotel"`

### Phase 7.4 — Homepage Examples Updated
- Example 1: `"Romantic dinner for two, ~$80/person, quiet, no chains, Manhattan"`
- Example 2: `"4-star hotel in Chicago downtown, $200/night, check in Friday, 2 nights, business trip"`

### Phase 7.5 — Hotel Card UI
- `components/HotelCard.tsx` — hotel placeholder SVG, rank badge, star rating, price, Why it fits, Watch out, amenity chips, Map + Book buttons
- `page.tsx` renders `HotelCard` when `chat.resultCategory === "hotel"`
- `useChat.ts` tracks `allHotelCards: HotelRecommendationCard[]` and `resultCategory: CategoryType`
- `Message` type updated with `hotelCards?` and `category?` fields

## To activate hotel search
Add `SERPAPI_KEY` to `.env.local` (register at https://serpapi.com — 250 free searches/month).
Without the key, hotel queries return empty results gracefully.

## Remaining work
All PLAN.md phases (1–7) complete. Future backlog: Itinerary Builder, community reviews.

## To activate Clerk/accounts
1. Create project at https://clerk.com
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Provision Vercel Postgres (or Neon) and add `POSTGRES_URL`
4. Run SQL in `lib/schema.sql` to create tables
