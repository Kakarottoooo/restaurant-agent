# Folio.

AI-powered decision engine for dining, travel, and lifestyle. Tell it what you're planning in natural language — occasion, budget, vibe, dates — and it returns a curated plan with personalized options and direct booking links.

## How it works

Two modes depending on your query:

### Category cards (restaurant, hotel, flight, laptop)
Three-layer AI pipeline:
1. **Intent parsing** (MiniMax) — extracts structured requirements from your message
2. **Parallel data gathering** — Google Places / SerpAPI for real data + Tavily editorial context, run concurrently
3. **Ranking & explanation** (MiniMax) — scores candidates and generates personalized explanations, watch-outs, and "skip if" notes

### Scenario plan (date_night, weekend_trip, city_trip, big_purchase)
Scenario decision engine (`lib/scenario2.ts`):
1. **NLU analysis** (`lib/nlu.ts`) — multilingual query understanding; English fast-path skips the API (~300ms saved)
2. **Scenario detection** — routes to `date_night`, `weekend_trip`, `city_trip`, `big_purchase`, or `concert_event` planner
3. **Plan generation** — produces a `DecisionPlan` with primary + ranked backup options + a plan-level `tradeoff_summary` (1–2 sentences explaining why the primary is the default and what each backup trades off); weekend_trip runs parallel hotel + flight searches; city_trip runs parallel hotel + restaurant + bar searches and produces 3 tiered packages (Upscale / Trendy / Local vibe); big_purchase routes to the appropriate device pipeline (laptop/headphone/smartphone) and returns 1 clear pick + up to 2 backup alternatives with price-delta tradeoff labels
4. **Modular planner engine** (`lib/agent/planner-engine/`) — generic tiered-package engine shared by all trip scenarios; new scenarios only need an `EngineConfig` factory
5. **SSE streaming** — streams plan chunks to the client in real time

## Features

- Natural language search with automatic scenario detection (date night, weekend trip, city trip, big purchase, concert/event, category search)
- Multilingual support — Chinese queries return Chinese results via MiniMax NLU
- 27 US cities + GPS-based "Near Me" mode + custom landmark search
- List view and full-screen interactive map view
- Filter chips by price and cuisine
- Scenario plan UI: `ScenarioPlanView` (consolidates `ScenarioBrief` + `PrimaryPlanCard` + `BackupPlanCard` + `ActionRail` + evidence panel) with booking links
- Share plans via a persistent URL (`/plan/[id]`) — partner sees a read-only view and can click "This works for me" to confirm (records `partner_approved` outcome for the learning loop)
- **Group voting** — share a plan in vote mode (`?vote=true`); friends tap their preferred option and see live vote tallies
- **Add to Calendar** — download a `.ics` file or open a Google Calendar event pre-filled with event date, time, and location
- **Price drop alerts** — "Watch prices" registers a SerpAPI price watch; daily cron notifies when price drops ≥10%
- **Post-experience feedback** — 24h after an event, a dismissible prompt asks "How was it?" with structured options (Great / OK but [too noisy / too expensive / too far] / Didn't go)
- **Preference learning** — negative feedback updates a per-session `user_preferences` store; next request automatically injects learned constraints into restaurant scoring
- **Trip brief export** — "Export brief" generates a clean markdown summary (hotel, flight, dining, budget, risks)
- **Date Night multi-venue chaining** — for `date_night` queries, automatically appends an after-dinner venue (cocktail bar / wine bar / dessert café) within 1km of the primary restaurant, with walk time and vibe description
- **Decision language** — high-confidence plans display "✓ Selected for you" with a green badge; backup options collapse by default so users approve rather than compare
- **User accounts + cross-device preference sync** — Clerk sign-in merges session preferences into the user account; learned constraints follow you across devices
- **Push notifications** — "Watch prices" requests browser permission and delivers a Web Push notification when the price drops, even when the app is closed
- **Concert & event ticket OS** — "find me a Taylor Swift concert in NYC" returns up to 3 events from Ticketmaster with direct buy-ticket links, venue info, price ranges, and Google Maps links; supports concerts, festivals, theater, sports, and comedy
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
  - `SERPAPI_KEY` — SerpAPI (hotel + flight search + price watches)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — Clerk (optional; enables internal analytics auth and cross-device preference sync)
  - `POSTGRES_URL` (or `DATABASE_URL`) — Neon PostgreSQL (required for share page, plan outcomes, and learning loop)
  - `CRON_SECRET` — shared secret for cron routes (`/api/cron/feedback-prompts`, `/api/cron/price-check`); set in Vercel Cron config
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — Web Push VAPID key pair (optional; enables push notifications for price drops)
  - `TICKETMASTER_API_KEY` + `TICKETMASTER_SECRET` — Ticketmaster Discovery API (optional; required for `concert_event` scenario)

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
      [id]/calendar/route.ts         # GET — download .ics calendar file for the plan event
      [id]/brief/route.ts            # GET — export trip brief as markdown
      [id]/vote/route.ts             # POST/GET — group voting (upsert vote, tally)
      [id]/price-watch/route.ts      # POST — register a price watch for this plan
    feedback-prompts/route.ts        # GET (pending prompts) / POST (submit feedback response)
    notifications/
      subscribe/route.ts             # GET (VAPID public key) / POST (store push subscription)
    user/
      preferences/merge/route.ts    # POST — merge session preferences into user account on sign-in
    cron/
      feedback-prompts/route.ts      # GET — daily cron: create prompts for plans 20–28h ago
      price-check/route.ts           # GET — daily cron: re-query SerpAPI, record price drops; fires push notifications on confirmed drops
  internal/scenario-events/          # Analytics UI (Clerk-gated)
  plan/[id]/                         # Shared plan view (read-only, partner approval button)
  hooks/
    useChat.ts          # AI pipeline state, sendMessage, scenario/category SSE handling
    useLocation.ts      # City selection, GPS, near-location, SW registration
    useFavorites.ts     # Favorites with localStorage persistence
    usePushSubscribe.ts # Web Push subscription — requests permission, stores subscription server-side
  contexts/
    ChunkErrorRecovery.tsx    # SSE error recovery context
    ServiceWorkerManager.tsx  # SW lifecycle management
  page.tsx              # Root UI — renders category_cards or scenario_plan mode
  globals.css           # Design tokens, dark mode, animations
  layout.tsx            # Fonts, metadata, service worker registration

lib/
  agent.ts              # Thin orchestrator — routes to sub-modules, runs restaurant pipeline inline
  agent/
    parse/              # Intent parsers per category (restaurant, hotel, flight, credit-card, city-trip, concert-event, …)
    pipelines/          # Category pipelines (hotel, flight, credit-card, laptop, smartphone, headphone)
    planners/           # Scenario planners (weekend-trip, date-night, city-trip, big-purchase, concert-event) + shared utils
    planner-engine/     # Generic modular planner engine (selectors, plan-option-builder, types)
    scenario-configs/   # EngineConfig factories per scenario (city-trip, …)
    composer/           # Scoring + refinement helpers
  scenario2.ts          # Scenario decision engine (detectScenario, runScenarioPlanner, runWeekendTripPlanner, runCityTripPlanner, getScoreAdjustments)
  nlu.ts                # Multilingual query analysis (MiniMax + English fast-path + learned preference injection)
  minimax.ts            # Shared MiniMax chat helper with configurable timeout
  scenarioEvents.ts     # Internal analytics query parsing + Clerk access guard
  scenario.ts           # Scenario type definitions
  tools.ts              # Google Places, SerpAPI, Tavily, Geocoding API wrappers
  schemas.ts            # Zod schemas for request/response validation
  types.ts              # TypeScript interfaces (DecisionPlan, ScenarioContext, etc.)
  db.ts                 # Neon DB helpers (8 tables: scenario_events, decision_plans, plan_outcomes, feedback_prompts, plan_votes, price_watches, user_preferences, user_notifications)
  push.ts               # Web Push helper — wraps web-push with VAPID setup, expired-subscription handling
  ticketmaster.ts       # Ticketmaster Discovery API client — event search, venue/price/genre parsing
  cities.ts             # 27 US cities config
  outputCopy.ts         # Output language copy helpers

components/
  ScenarioPlanView.tsx     # Scenario plan composite (Brief + Primary + Backups + ActionRail + Evidence)
  ScenarioBrief.tsx        # Query summary card for scenario_plan mode
  PrimaryPlanCard.tsx      # Primary plan display with swap + approve actions
  BackupPlanCard.tsx       # Backup option cards
  ActionRail.tsx           # Plan action buttons (share, vote, watch price, export brief, calendar, refine, open_link)
  FeedbackPromptCard.tsx   # Post-experience feedback prompt (dismissible card, 3-option rating)
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

- Favorites are stored in localStorage only (no server-side favorites sync — user accounts sync learned preferences only, not saved places)
- Push notifications require browser permission and a configured VAPID key pair; they fall back silently if either is missing
- Restaurant and hotel data sourced from Google Places + SerpAPI (US coverage best)
- Tavily search enrichment is additive and non-fatal; recommendations still work without it
- Restaurant and hotel data is US-centric; international city_trip searches depend on SerpAPI coverage for the destination
