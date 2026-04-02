# Onegent

**Live:** [onegent.one](https://onegent.one/)

AI-powered decision engine for dining, travel, and lifestyle. Tell it what you're planning in natural language — occasion, budget, vibe, dates — and it returns a curated plan with personalized options and direct booking links.

## How it works

Two modes depending on your query:

### Category cards (restaurant, hotel, flight, laptop, smartphone, headphone, credit card)
Five-layer AI pipeline:
1. **Intent parsing** (MiniMax) — extracts structured requirements from your message
2. **Parallel data gathering** — Google Places / SerpAPI for real data + Tavily editorial context, run concurrently
3. **Review signal extraction** — MiniMax parses real user reviews (Google Maps + Yelp/Reddit via Tavily) into structured signals: noise level, wait time, date suitability score, service pace, notable dishes, red flags
4. **Structured scoring** — `computeWeightedScore()` ranks candidates on 5 weighted dimensions (scene match 30%, budget match 25%, review quality 20%, location convenience 15%, preference match 10%) minus red-flag penalty; system-computed rather than free-form AI guess
5. **Ranking & explanation** (MiniMax) — fills dimension scores, writes personalized explanations, watch-outs, and "skip if" notes; result re-sorted by `weighted_total`

### Scenario plan (date_night, weekend_trip, city_trip, big_purchase, concert_event, gift, fitness)
Scenario decision engine (`lib/scenario2.ts`):
1. **NLU analysis** (`lib/nlu.ts`) — multilingual query understanding; English fast-path skips the API (~300ms saved)
2. **Scenario detection** — routes to `date_night`, `weekend_trip`, `city_trip`, `big_purchase`, `concert_event`, `gift`, or `fitness` planner
3. **Plan generation** — produces a `DecisionPlan` with primary + ranked backup options + a plan-level `tradeoff_summary` explaining why the primary is the default and what each backup trades off
4. **Modular planner engine** (`lib/agent/planner-engine/`) — generic tiered-package engine shared by all trip scenarios; new scenarios only need an `EngineConfig` factory
5. **SSE streaming** — streams plan chunks to the client in real time

## Features

- Natural language search with automatic scenario detection (date night, weekend trip, city trip, big purchase, concert/event, gift, fitness, category search)
- Multilingual support — Chinese queries return Chinese results via MiniMax NLU
- 27 US cities + GPS-based "Near Me" mode + custom landmark search
- List view and full-screen interactive map view
- Filter chips by price and cuisine
- Scenario plan UI: primary plan + backup options + action rail with booking links
- Share plans via a persistent URL (`/plan/[id]`) — partner sees a read-only view and can click "This works for me" to confirm
- **Group voting** — share a plan in vote mode (`?vote=true`); friends tap their preferred option and see live vote tallies
- **Add to Calendar** — download a `.ics` file or open a Google Calendar event pre-filled with event date, time, and location
- **Price drop alerts** — "Watch prices" registers a SerpAPI price watch; daily cron notifies when price drops ≥10%
- **Post-experience feedback** — 24h after an event, a dismissible prompt asks "How was it?" with structured options (Great / OK but [too noisy / too expensive / too far] / Didn't go)
- **Session preference memory (3.3a)** — after each restaurant query, MiniMax extracts preference signals (noise, budget, chains, excluded cuisines) from the message and accumulates them in-session; injected into all subsequent ranking prompts
- **Persistent preference profile (3.3b)** — session preferences promote into a persistent `UserPreferenceProfile` (localStorage + cloud for signed-in users); survives across sessions so the system remembers "no chains" without the user repeating it
- **Preference learning** — negative feedback updates a per-session `user_preferences` store; next request automatically injects learned constraints into restaurant scoring
- **Trip brief export** — "Export brief" generates a clean markdown summary (hotel, flight, dining, budget, risks)
- **Date Night multi-venue chaining** — automatically appends an after-dinner venue (cocktail bar / wine bar / dessert café) within 1km of the primary restaurant, with walk time and vibe description
- **Decision language** — high-confidence plans display "✓ Selected for you" with a green badge; backup options collapse by default so users approve rather than compare
- **User accounts + cross-device preference sync** — Clerk sign-in merges session preferences into the user account; learned constraints follow you across devices
- **Push notifications** — "Watch prices" requests browser permission and delivers a Web Push notification when the price drops, even when the app is closed
- **Concert & event ticket OS** — returns up to 3 events from Ticketmaster with direct buy-ticket links, venue info, price ranges, and Google Maps links
- **Gift recommendation OS** — returns 3 curated options (Safe pick / Most thoughtful / Most creative) sourced from SerpAPI Google Shopping with direct purchase links
- **Fitness/wellness OS** — returns 3 studio options (Top rated / Most popular / Best value) sourced from Google Places with ClassPass + Mindbody + Google Maps booking links; covers yoga, pilates, spin, HIIT, CrossFit, boxing, barre, dance, meditation, swimming, running, martial arts
- **Structured scoring** — restaurant ranking uses 5 weighted dimensions computed deterministically; collapsible score breakdown panel on each card
- **Flight time-of-day filtering** — "no red-eye", "not after 9pm", "earliest 7am" parsed from natural language; departure window filtering applied post-SerpAPI with graceful fallback when all flights would be excluded
- **Credit card portfolio gap analysis** — "I have CSP and Amex Gold, what's missing?" triggers `portfolio_review` mode: computes effective earn rates per spending category across existing cards, scores remaining cards by gap-fill potential, annotates each with a "portfolio gap" explanation
- **Credit card signup bonus ranking** — "best welcome offer right now" triggers `signup_bonus` mode: scores cards by `SUB value × spend feasibility factor`, surfaces top 3 with bonus size, spend requirement, and timeframe
- **Module-level refine** — "keep the flights, just find a different hotel" re-runs only the swapped module and pins the rest; result saved as a new plan with `parent_plan_id` lineage
- **Venue quality degradation alert** — weekly cron re-checks Google Places ratings for venues with upcoming event dates; surfaces an amber warning banner on the share page when rating drops ≥0.3★
- **Fast-service restaurant mode** — "quick lunch, need to eat in 15 minutes" sets `service_pace_required: "fast"`; ranking prompt heavily favours low-wait venues and penalises slow-service restaurants
- **Honeymoon / anniversary hotel mode** — "celebrating our anniversary" sets `special_occasion`; ranking prompt boosts hotels with spa, ocean-view rooms, suites, couples packages, and romantic reputation
- **Family travel hotel mode** — "traveling with two kids" sets `has_children: true`; ranking prompt prioritises pool, kids club, connecting rooms, family dining, and theme-park proximity; penalises adult-only properties
- **Single-constraint refinement** — "cheaper" / "quieter" / "closer" after seeing results is detected in NLU and injected as a refinement constraint; last 4 conversation turns passed to MiniMax so the new query inherits location, cuisine, and party size from context
- **Inline feedback loop** — thumbs-up/down on any card fires `POST /api/feedback/inline`, mapping structured issues (too noisy, too expensive, slow service) to `user_preferences` updates so the next query reflects what you just told it
- Save favorites (localStorage)
- Dark mode (system preference)
- PWA-installable with offline support
- Internal analytics dashboard (`/internal/scenario-events`, Clerk-gated)
- **Autopilot booking** — one click books everything in the background; push notification when done
- **Decision Room** — shared two-party decision platform with voting and merge logic

## Autopilot Booking

Onegent can autonomously fill out booking forms across multiple platforms so you only have to pay.

### How it works

1. **Select a plan** — pick flights, hotel, and restaurant from the scenario plan view
2. **"Book everything →"** — fires a background job (up to 5 min) that runs a Playwright headless browser for each step
3. **Real-time task view** (`/trips`) — watch progress step-by-step; push notification on completion
4. **Open and pay** — click the pre-filled booking pages and confirm payment

### In-task decision making

The agent doesn't just execute — it makes autonomous local decisions when things go wrong:

| Problem | Agent response |
|---|---|
| Restaurant full at 7:00pm | Auto-tries 7:30pm → 6:30pm → 8:00pm → 6:00pm before giving up |
| Primary hotel unavailable | Switches to next-best alternative from the backup plan |
| Transient error | Retries up to 3× with 2s / 5s backoff |
| All options fail | Generates manual action items with direct booking links |

Every decision is logged with timestamp and outcome — the full agent decision log is visible in `/trips`.

### Failure recovery

- **Retry with backoff** — transient errors retried up to 3 times (2s, 5s delays)
- **Time fallbacks** — restaurant time slots: ±30, ±60, ±90 minutes from requested time
- **Fallback candidates** — backup hotels/restaurants from the plan's alternate options
- **Action items** — when all automation fails, surfaces manual booking links with clear "what to do next"

### Session persistence (cookie-based auth)

Log in to OTAs once in a visible browser session; cookies are saved and injected into future headless runs so the agent lands on authenticated pages:

```
POST /api/booking-autopilot/connect   # opens visible browser, waits for login, saves cookies
DELETE /api/booking-autopilot/connect # clears saved cookies for a service
GET  /api/booking-autopilot/status   # which services are currently connected
```

### Agent feedback loop

The system learns from every booking outcome:

| Signal | Captured when |
|---|---|
| **Accepted** | User clicks "Open →" on an agent-chosen booking |
| **Manual override** | User clicks "Book manually" action item |
| **Satisfaction** | 😊 / 👍 / 😕 widget shown after each completed trip |

The **Agent Insights** panel in `/trips` surfaces:
- Adjustment acceptance rate (how often you trust the agent's decisions)
- Provider success rates by platform (OpenTable, Booking.com, Kayak, Expedia)
- Which step types most often need manual intervention
- Venues where the agent's pick is most often rejected

Over time these signals feed back into ranking fallback candidates and improving decision strategy.

### Additional env vars (autopilot)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Base URL used by the job runner to call autopilot endpoints internally |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Optional: path to a custom Chromium binary |

---

## Prerequisites

- Node.js 20+
- API keys for:
  - `MINIMAX_API_KEY` — MiniMax platform
  - `GOOGLE_PLACES_API_KEY` — Google Cloud Console (Places API + Geocoding API enabled)
  - `TAVILY_API_KEY` — Tavily
  - `SERPAPI_KEY` — SerpAPI (hotel + flight search + price watches)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — Clerk (optional; enables internal analytics auth and cross-device preference sync)
  - `POSTGRES_URL` (or `DATABASE_URL`) — Neon PostgreSQL (required for share page, plan outcomes, and learning loop)
  - `CRON_SECRET` — shared secret for cron routes; set in Vercel Cron config
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
    session-preferences/extract/     # POST — AI-powered session preference extraction (3.3a)
    telemetry/route.ts               # plan_approved, option_swap, action_rail_click events
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
      profile/route.ts              # GET/PATCH — persistent preference profile (cloud sync)
      preferences/merge/route.ts    # POST — merge session preferences into user account on sign-in
    cron/
      feedback-prompts/route.ts      # GET — daily cron: create prompts for plans 20–28h ago
      price-check/route.ts           # GET — daily cron: re-query SerpAPI, record price drops; fires push notifications
      venue-health-check/route.ts    # GET — weekly cron: re-check Google Places ratings; records venue_quality_alert
  internal/scenario-events/          # Analytics UI (Clerk-gated)
  plan/[id]/                         # Shared plan view (read-only, partner approval button)
  hooks/
    useChat.ts          # AI pipeline state, sendMessage, scenario/category SSE handling
    usePreferences.ts   # Persistent preference profile (localStorage + cloud sync)
    useLocation.ts      # City selection, GPS, near-location, SW registration
    useFavorites.ts     # Favorites with localStorage persistence + preference signal learning
    usePushSubscribe.ts # Web Push subscription
  contexts/
    ChunkErrorRecovery.tsx    # SSE error recovery context
    ServiceWorkerManager.tsx  # SW lifecycle management
  page.tsx              # Root UI — renders category_cards or scenario_plan mode
  globals.css           # Design tokens, dark mode, animations
  layout.tsx            # Fonts, metadata, service worker registration

app/
  api/
    booking-autopilot/
      flight/route.ts            # Kayak autopilot — finds cheapest flight, returns pre-filled checkout URL
      hotel/route.ts             # Booking.com autopilot — navigates to hotel page, returns handoff URL
      restaurant/route.ts        # OpenTable autopilot — selects time slot, returns reservation URL
      connect/route.ts           # Cookie session management — opens visible browser for OTA login
      status/route.ts            # GET — which services have saved cookie sessions
    booking-jobs/
      route.ts                   # POST (create job) / GET (list by session)
      [id]/route.ts              # GET — poll job status + step progress
      [id]/start/route.ts        # POST — long-running job executor (maxDuration=300s, recovery logic)
    booking-feedback/
      route.ts                   # POST (log feedback event) / GET (aggregate stats)
  trips/page.tsx                 # My Trips task center — timeline, decision log, action items, insights

lib/
  booking-autopilot/
    kayak-flights.ts     # Playwright scraper — Kayak flight search + expanded booking panel
    booking-com.ts       # Playwright scraper — Booking.com hotel page (stealth mode + cookie injection)
    opentable.ts         # Playwright scraper — OpenTable time slot selection
    cookie-store.ts      # Cookie persistence — save/load/inject per-service browser cookies
    types.ts             # AutopilotResult, BookingJobStep shared types
  agent.ts              # Thin orchestrator — routes to sub-modules, runs restaurant pipeline inline
  agent/
    parse/              # Intent parsers per category (restaurant, hotel, flight, credit-card, city-trip, concert-event, gift, fitness, …)
    pipelines/          # Category pipelines (hotel, flight, credit-card, laptop, smartphone, headphone)
    planners/           # Scenario planners (weekend-trip, date-night, city-trip, big-purchase, concert-event, gift, fitness) + shared utils
    planner-engine/     # Generic modular planner engine (selectors, plan-option-builder, types)
    scenario-configs/   # EngineConfig factories per scenario (city-trip, …)
    composer/           # Scoring (computeWeightedScore) + session preference extraction (extractRefinements)
  scenario2.ts          # Scenario decision engine (detectScenario, planners, getScoreAdjustments)
  nlu.ts                # Multilingual query analysis (MiniMax + English fast-path + learned preference injection)
  minimax.ts            # Shared MiniMax chat helper with configurable timeout
  tools.ts              # Google Places, SerpAPI, Tavily, Geocoding API wrappers
  schemas.ts            # Zod schemas for request/response validation
  types.ts              # TypeScript interfaces (DecisionPlan, SessionPreferences, UserPreferenceProfile, etc.)
  db.ts                 # Neon DB helpers (11 tables: includes booking_jobs + agent_feedback)
  push.ts               # Web Push helper — wraps web-push with VAPID setup
  ticketmaster.ts       # Ticketmaster Discovery API client
  serpapi-shopping.ts   # SerpAPI Google Shopping client
  cities.ts             # 27 US cities config
  outputCopy.ts         # Output language copy helpers

components/
  AutopilotRunnerModal.tsx # Booking runner modal — live step progress, background job handoff
  ConnectAccountsModal.tsx # OTA account connection UI — login status, connect/disconnect per service
  ScenarioPlanView.tsx     # Scenario plan composite (Brief + Primary + Backups + ActionRail + Evidence)
  PrimaryPlanCard.tsx      # Primary plan display with swap + approve actions
  BackupPlanCard.tsx       # Backup option cards
  ActionRail.tsx           # Plan action buttons (share, vote, watch price, export brief, calendar, refine, open_link)
  FeedbackPromptCard.tsx   # Post-experience feedback prompt
  RecommendationCard.tsx   # Category card (restaurant, hotel, flight, laptop) with score breakdown
  MapView.tsx              # Leaflet map with interactive markers

public/
  sw.js                 # Service worker (cache name versioned on build)
  manifest.json         # PWA manifest
```

## Deployment

Deploy to Vercel — it's a standard Next.js app. Set the environment variables in your project settings.

**Note:** The rate limiter in `app/api/chat/route.ts` is in-memory (10 req/min per IP). For multi-replica deployments, replace it with `@upstash/ratelimit` backed by Redis.

## Database tables

| Table | Purpose |
|---|---|
| `preference_profiles` | Persistent per-user preference profiles |
| `favorites` | Saved restaurants/venues |
| `feedback` | Post-experience structured feedback |
| `scenario_events` | Telemetry (plan_approved, option_swap, action_rail_click, …) |
| `decision_plans` | Persisted DecisionPlan JSON for share URLs |
| `plan_outcomes` | Outcome tracking (went, partner_approved, …) |
| `plan_votes` | Group voting tallies |
| `price_watches` | Registered price drop alerts |
| `user_preferences` | Per-session and per-user learned preference constraints |
| `user_notifications` | Web Push subscriptions |
| `booking_jobs` | Autopilot job queue — status, steps, decision logs |
| `agent_feedback` | Feedback events — accepted/override/satisfaction per step |

## Known limitations

- Favorites are stored in localStorage only (no server-side favorites sync — user accounts sync learned preferences only, not saved places)
- Push notifications require browser permission and a configured VAPID key pair; they fall back silently if either is missing
- Restaurant and hotel data sourced from Google Places + SerpAPI (US coverage best)
- Tavily search enrichment is additive and non-fatal; recommendations still work without it
- Restaurant and hotel data is US-centric; international city_trip searches depend on SerpAPI coverage for the destination
