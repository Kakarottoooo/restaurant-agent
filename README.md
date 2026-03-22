# Folio.

AI-powered decision engine for dining, travel, and lifestyle. Tell it what you're planning in natural language — occasion, budget, vibe, dates — and it returns a curated plan with personalized options and direct booking links.

## How it works

Two modes depending on your query:

### Category cards (restaurant, hotel, flight, laptop)
Three-layer AI pipeline:
1. **Intent parsing** (MiniMax) — extracts structured requirements from your message
2. **Parallel data gathering** — Google Places / SerpAPI for real data + Tavily editorial context, run concurrently
3. **Ranking & explanation** (MiniMax) — scores candidates and generates personalized explanations, watch-outs, and "skip if" notes

### Scenario plan (date_night, weekend_trip, city_trip)
Scenario decision engine (`lib/scenario2.ts`):
1. **NLU analysis** (`lib/nlu.ts`) — multilingual query understanding; English fast-path skips the API (~300ms saved)
2. **Scenario detection** — routes to `date_night`, `weekend_trip`, or `city_trip` planner
3. **Plan generation** — produces a `DecisionPlan` with primary + ranked backup options; weekend_trip runs parallel hotel + flight searches; city_trip runs parallel hotel + restaurant + bar searches and produces 3 tiered packages (Upscale / Trendy / Local vibe)
4. **Modular planner engine** (`lib/agent/planner-engine/`) — generic tiered-package engine shared by all trip scenarios; new scenarios only need an `EngineConfig` factory
5. **SSE streaming** — streams plan chunks to the client in real time

## Features

- Natural language search with automatic scenario detection (date night, weekend trip, city trip, category search)
- Multilingual support — Chinese queries return Chinese results via MiniMax NLU
- 27 US cities + GPS-based "Near Me" mode + custom landmark search
- List view and full-screen interactive map view
- Filter chips by price and cuisine
- Scenario plan UI: `ScenarioPlanView` (consolidates `ScenarioBrief` + `PrimaryPlanCard` + `BackupPlanCard` + `ActionRail` + evidence panel) with booking links
- Share plans via a persistent URL (`/plan/[id]`) — partner sees a read-only view and can click "This works for me" to confirm (records `partner_approved` outcome for the learning loop)
- Save favorites (localStorage)
- Dark mode (system preference)
- PWA-installable with offline support
- Internal analytics dashboard (`/internal/scenario-events`, Clerk-gated)

## Prerequisites

- Node.js 20+
- API keys for:
  - `MINIMAX_API_KEY` — MiniMax platform
  - `GOOGLE_PLACES_API_KEY` — Google Cloud Console (Places API + Geocoding API enabled)
  - `TAVILY_API_KEY` — Tavily
  - `SERPAPI_API_KEY` — SerpAPI (hotel + flight search)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — Clerk (optional; enables internal analytics auth)
  - `POSTGRES_URL` (or `DATABASE_URL`) — Neon PostgreSQL (required for share page, plan outcomes, and learning loop)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.local.example .env.local
# Fill in your API keys in .env.local

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (also versions the service worker) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests with Vitest |
| `npm run test:coverage` | Run tests with coverage report |

## Project structure

```
app/
  api/
    chat/route.ts                    # SSE endpoint — scenario vs category routing
    telemetry/route.ts               # plan_approved, option_swap, action_rail_click events
    internal/scenario-events/        # Analytics API (GET, Clerk-gated)
    plan/
      save/route.ts                  # POST — persist DecisionPlan to decision_plans table
      [id]/route.ts                  # GET — fetch plan by ID (cached 24h)
      [id]/outcome/route.ts          # POST/GET — record outcome (went, partner_approved, etc.)
  internal/scenario-events/          # Analytics UI (Clerk-gated)
  plan/[id]/                         # Shared plan view (read-only, partner approval button)
  hooks/
    useChat.ts          # AI pipeline state, sendMessage, scenario/category SSE handling
    useLocation.ts      # City selection, GPS, near-location, SW registration
    useFavorites.ts     # Favorites with localStorage persistence
  contexts/
    ChunkErrorRecovery.tsx    # SSE error recovery context
    ServiceWorkerManager.tsx  # SW lifecycle management
  page.tsx              # Root UI — renders category_cards or scenario_plan mode
  globals.css           # Design tokens, dark mode, animations
  layout.tsx            # Fonts, metadata, service worker registration

lib/
  agent.ts              # Thin orchestrator — routes to sub-modules, runs restaurant pipeline inline
  agent/
    parse/              # Intent parsers per category (restaurant, hotel, flight, credit-card, city-trip, …)
    pipelines/          # Category pipelines (hotel, flight, credit-card, laptop, smartphone, headphone)
    planners/           # Scenario planners (weekend-trip, date-night, city-trip)
    planner-engine/     # Generic modular planner engine (selectors, plan-option-builder, types)
    scenario-configs/   # EngineConfig factories per scenario (city-trip, …)
    composer/           # Scoring + refinement helpers
  scenario2.ts          # Scenario decision engine (detectScenario, runScenarioPlanner, runWeekendTripPlanner, runCityTripPlanner, getScoreAdjustments)
  nlu.ts                # Multilingual query analysis (MiniMax + English fast-path)
  minimax.ts            # Shared MiniMax chat helper with configurable timeout
  scenarioEvents.ts     # Internal analytics query parsing + Clerk access guard
  scenario.ts           # Scenario type definitions
  tools.ts              # Google Places, SerpAPI, Tavily, Geocoding API wrappers
  schemas.ts            # Zod schemas for request/response validation
  types.ts              # TypeScript interfaces (DecisionPlan, ScenarioContext, etc.)
  db.ts                 # Neon DB helpers (scenario_events, decision_plans, plan_outcomes tables)
  cities.ts             # 27 US cities config
  outputCopy.ts         # Output language copy helpers

components/
  ScenarioPlanView.tsx     # Scenario plan composite (Brief + Primary + Backups + ActionRail + Evidence)
  ScenarioBrief.tsx        # Query summary card for scenario_plan mode
  PrimaryPlanCard.tsx      # Primary plan display with swap + approve actions
  BackupPlanCard.tsx       # Backup option cards
  ActionRail.tsx           # Plan action buttons (share, refine, swap backup, approve)
  ScenarioEvidencePanel.tsx # Supporting evidence panel
  RecommendationCard.tsx   # Category card (restaurant, hotel, flight, laptop)
  MapView.tsx              # Leaflet map with interactive markers

public/
  sw.js                 # Service worker (cache name versioned on build)
  manifest.json         # PWA manifest

scripts/
  inject-sw-version.mjs  # Postbuild: injects BUILD_ID into sw.js cache name
  generate-icons.mjs     # Generates PWA icons (192px, 512px)
```

## Deployment

Deploy to Vercel — it's a standard Next.js app. Set the environment variables in your project settings.

**Note:** The rate limiter in `app/api/chat/route.ts` is in-memory (10 req/min per IP). For multi-replica deployments, replace it with `@upstash/ratelimit` backed by Redis.

## Known limitations

- No user accounts — favorites are stored in localStorage only
- Restaurant and hotel data sourced from Google Places + SerpAPI (US coverage best)
- Tavily search enrichment is additive and non-fatal; recommendations still work without it
- Restaurant and hotel data is US-centric; international city_trip searches depend on SerpAPI coverage for the destination
