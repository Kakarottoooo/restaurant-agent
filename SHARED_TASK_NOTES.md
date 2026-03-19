# Shared Task Notes

## Status
Phase 10 complete. Build passes cleanly. All PLAN.md phases (1–10) done.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- middleware renamed to `proxy.ts` (Next.js 16 convention)

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 10 features (implemented this iteration)

### Laptop Recommendation Agent Architecture
- `CategoryType` now includes `"laptop"` (lib/types.ts)
- New types: `LaptopIntent`, `LaptopDevice`, `LaptopSKU`, `LaptopSignalValue`, `LaptopPortSelection`, `LaptopSignalBreakdownItem`, `LaptopRecommendationCard`, `LaptopUseCase` in `lib/types.ts`
- Static device database: `data/laptops.json` — 20 devices covering Apple, Lenovo, Dell, ASUS, HP, LG, Framework, Razer, Microsoft, Samsung, Acer
- Scoring engine: `lib/laptopEngine.ts` — weighted signal scoring using 7 use cases × 8 signal dimensions matrix
- Intent detection in `detectCategory()` — laptop keywords checked before flight/hotel to avoid collision
- `parseLaptopIntent()` in `lib/agent.ts` — extracts use_cases, budget, OS preference, portability_priority, display_size_preference via MiniMax
- `runLaptopPipeline()` in `lib/agent.ts` — calls engine, returns top-5 laptops
- `runAgent()` updated: new `laptopRecommendations` field in return type; `LaptopIntent` added to requirements union
- API route sends `laptopRecommendations` and `missing_laptop_use_case` in SSE `complete` event
- `useChat.ts` handles `laptop` category, stores in `allLaptopCards` state
- `LaptopCard.tsx` component — shows rank, brand color, score, price/SKU, signal breakdown bars, why it fits, watch out notes (expandable), raw quotes (expandable per signal)
- `page.tsx` renders laptop results with disclaimer footer

### Scoring Algorithm
- 7 use cases: light_productivity, software_dev, video_editing, 3d_creative, gaming, data_science, business_travel
- 8 signal dimensions: battery, thermal (thermal+fan avg), keyboard (keyboard+trackpad avg), display (quality+brightness avg), build, ports, weight, value
- Weight matrix from PLAN.md hardcoded in `laptopEngine.ts`
- CPU/GPU benchmark bonus applied for compute-heavy use cases
- Portability priority: if "critical", applies weight bonus to weight score
- Top 5 returned, with SKU recommendation (higher RAM for heavy workloads, mid-tier for light)
- Fallback: if no devices pass filter, relaxes budget constraint by 20%

### Data Notes
- All 20 devices have `last_verified: "2026-02-01"` displayed in UI
- Signals based on public reviews from Wirecutter, NotebookCheck, The Verge, iFixit
- No external APIs — fully static, manually maintained
- `raw_quote` stored per signal — expandable in UI for transparency
- `data_staleness_warning: true` shown when review data > 18 months old

## To activate flight search
Add `SERPAPI_KEY` to `.env.local` (same key used for hotel search).

## To activate hotel search
Add `SERPAPI_KEY` to `.env.local` (register at https://serpapi.com — 250 free searches/month).

## To activate Clerk/accounts
1. Create project at https://clerk.com
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Provision Vercel Postgres (or Neon) and add `POSTGRES_URL`
4. Run SQL in `lib/schema.sql` to create tables

## Remaining work
All PLAN.md phases (1–10) complete.

Future backlog:
- Itinerary Builder (combine flights + hotels + restaurants)
- Community reviews integration
- Points redemption linkage between flight/hotel and credit card flows
- Expand laptop database with more devices and fresher signal data
- Add smartphone / headphones recommendation (PLAN.md Phase 10 extension architecture already designed)
- Real-time price fetching for laptops (Amazon PA API or Keepa)
