# TODOS

## Execution Layer / Learning Loop

### Learning loop activation
**Priority:** P2
**What:** Set `ENABLE_SCORE_ADJUSTMENTS=true` after ≥30 days AND ≥100 `plan_outcomes` rows.
**Why:** Converts accumulated outcome signals into smarter venue rankings.
**Pros:** Folio gets measurably better over time.
**Cons:** Risk of promoting noise if enabled too early.
**Context:** SQL query implemented in `lib/scenario2.ts` `getScoreAdjustments()`. Query JOINs `decision_plans + plan_outcomes`, extracts stable venue IDs via `evidence_card_id`, computes recency-weighted (30-day decay) signed approval rates, requires ≥3 outcomes per venue. Enable by setting `ENABLE_SCORE_ADJUSTMENTS=true` in env. Monitor ranking quality after enabling.
**Depends on:** ≥30 days of live user data after v0.2.2.0.

---

---

## Phase 3a — Decision Compression (highest leverage)

### 3a-3: Weekend Trip unified package assembly
**Priority:** P0
**What:** Currently weekend_trip returns flight cards + hotel cards as separate lists. Final output must be 3 complete trip packages: Safest, Cheapest, Best Experience — each pre-combining one flight + one hotel + estimated total cost + which credit card earns most points + time-gap check (flight lands → hotel check-in feasible?).
**Why:** Users don't want to cross-reference 10 flights × 10 hotels. They want "here are 3 complete trips, pick one."
**Pros:** Transforms weekend_trip from "two category searches" into a genuine trip planner. Huge UX leap.
**Cons:** Combinatorial assembly is complex — need a pairing algorithm (best flight × best hotel by each optimization target). Total cost calculation requires summing flight + hotel + fees.
**Context:** `lib/agent/planners/weekend-trip.ts` currently runs parallel `runFlightPipeline()` + `runHotelPipeline()` and returns results independently. Add a `assembleWeekendPackages()` function that takes top-3 flights × top-3 hotels and assembles 3 packages: (1) lowest total price, (2) best flight + hotel combo score, (3) most flexible/refundable. Each package gets: `flight_summary`, `hotel_summary`, `total_estimated_cost`, `best_card_for_this_trip` (cross-ref credit card rewards), `check_in_gap_hours` (time between flight landing and hotel check-in). New type: `WeekendTripPackage`. `DecisionPlan.primary` becomes the safest package, `backups` are the other two.
**Depends on:** 3a-1.
**Completed (partial):** v0.2.7.0 (2026-03-22) — package assembly was already complete from v0.2.1.0. This version adds real `check_in_gap_hours` computation: `buildWeekendTripTimingNote()` now parses `arrival_time` (HH:MM), computes gap vs standard 15:00 check-in, and generates contextual notes (early/late-night/clean-handoff). `buildWeekendTripRisks()` adds warnings for early arrival (>3h gap), tight window (<2h gap), and late-night (≥22:00) scenarios.

---

## Phase 3b — Execution Layer (transforms from recommender to agent)

### 3b-1: Pre-filled deep links for booking actions
**Priority:** P0
**What:** ActionRail "Book Now" buttons must open booking pages with dates, guests, location, and filters pre-filled — not the homepage. User should land directly on a filtered results page or room selection, not start from scratch.
**Why:** The #1 friction after recommendation is "now I have to re-enter everything in the booking app." Eliminating this re-entry is the biggest single-step execution gain.
**Pros:** Massive friction reduction. Can be built without any API integration — just URL construction.
**Cons:** URL schemas for Booking.com, Google Flights, Google Hotels change occasionally. Need to maintain URL templates.
**Context:** Deep link URL patterns:
- Google Hotels: `https://www.google.com/travel/hotels?q={hotel_name}+{city}&dates={checkin}/{checkout}&adults={guests}`
- Google Flights: `https://www.google.com/flights?hl=en#flt={origin}.{dest}.{date};c:USD;e:1;sd:1;t:f`
- Booking.com: `https://www.booking.com/search.html?ss={city}&checkin_year={y}&checkin_month={m}&checkin_monthday={d}&checkout_year={y2}&checkout_month={m2}&checkout_monthday={d2}&group_adults={n}`
- OpenTable: `https://www.opentable.com/s/?dateTime={date}T{time}&covers={guests}&metroId={city_id}`
Current `open_link` actions in `lib/types.ts` have a `url: string` field. The planners already set static URLs. Update each planner to construct dynamic pre-filled URLs using the parsed intent fields (dates, guests, city, etc.) that are already in scope during plan generation.
**Depends on:** None. Planners already have all required fields in scope.
**Completed:** v0.2.7.0 (2026-03-22) — `lib/agent/planners/booking-links.ts` added with `buildGoogleHotelsUrl`, `buildBookingComUrl`, `buildGoogleFlightsUrl`, `buildOpenTableUrl`. Weekend trip planner now builds Booking.com pre-filled hotel URL and Google Flights deep link (#flt=...) when intent has `start_date` + city/route. Falls back to existing `booking_link` when intent lacks dates.

---

### 3b-2: Add to Calendar action
**Priority:** P1
**What:** ActionRail should include an "Add to Calendar" button for date_night and weekend_trip plans. Generates a `.ics` file or Google Calendar deep link with event title, date/time, location, and notes pre-filled from the plan.
**Why:** The plan is useless if the user forgets it. Calendar is the natural place for confirmed plans to live.
**Pros:** Zero API cost — pure URL/file generation. Works for any calendar app (Google, Apple, Outlook).
**Cons:** Date/time must be parsed from plan — requires structured `event_datetime` field in DecisionPlan.
**Context:** Google Calendar URL: `https://calendar.google.com/calendar/r/eventedit?text={title}&dates={start}/{end}&details={notes}&location={address}`. Apple/ICS: generate a `.ics` blob via a `/api/plan/[id]/calendar` route that returns `Content-Type: text/calendar`. Add `event_datetime?: string` (ISO 8601) and `event_location?: string` to `DecisionPlan` type. Planners should populate these when date/time is known. ActionRail renders "Add to Calendar" as a new `PlanAction` type: `add_to_calendar`.
**Depends on:** 3a-1.
**Completed:** v0.2.8.0 (2026-03-22) — `event_datetime` and `event_location` added to `DecisionPlan`. All three planners (date_night, weekend_trip, city_trip) populate these fields when date is known. `GET /api/plan/[id]/calendar` route returns a `.ics` file (RFC 5545, floating local time). Share page (`SharedPlanView.tsx`) shows "Add to Calendar (.ics)" download button when `event_datetime` is set. City_trip also gets a Google Calendar secondary action link in each plan option. 15 new tests across `scenario2.test.ts` and `plan-calendar.test.ts`.

---

### 3b-4: Trip brief generation
**Priority:** P2
**What:** "Export trip brief" generates a clean text/markdown summary of the entire plan: hotel name + address + check-in time, flight details, restaurant reservation, total budget, key risks, confirmation codes (if provided). Shareable as a single document.
**Why:** Users need one place to reference everything during the trip. Reduces "where did I save that recommendation?" anxiety.
**Pros:** Zero external API cost — pure text generation from existing plan data.
**Cons:** Formatting needs to be clean and mobile-readable.
**Context:** New route `GET /api/plan/[id]/brief` returns a markdown string assembled from `DecisionPlan` fields. ActionRail new action type: `export_brief` — opens the brief in a new tab or triggers download. Can also be sent via share URL.
**Depends on:** 3a-3 (weekend trip packages provide the richest brief content).
**Completed:** v0.2.10.0 (2026-03-22)

---

### 3b-5: Credit card cross-reference in trip planning
**Priority:** P1
**What:** When a weekend_trip or city_trip plan is finalized, automatically surface which credit card in the user's profile (or the top recommended card) earns the most points/cashback for this specific trip's spend mix (flights, hotels, dining).
**Why:** Users miss out on hundreds of dollars in rewards because they don't know which card to use for which purchase. This is a high-value "I didn't know I needed this" moment.
**Pros:** Directly ties the credit card category to real trip decisions — creates cross-category value.
**Cons:** Requires knowing the user's existing cards OR recommending one. Can default to recommending the best card for this trip if no profile exists.
**Context:** `lib/agent/pipelines/credit-card.ts` already scores cards by use case. Add a `getBestCardForTrip(tripSpend: {flight_usd, hotel_usd, dining_usd})` helper that scores top 3 cards and returns the winner + reason. Call this at the end of weekend_trip and city_trip assembly. Render as a small "💳 Best card for this trip: Chase Sapphire — 3x on travel" callout in the plan UI.
**Depends on:** 3a-3.
**Completed:** v0.2.9.0 (2026-03-22)

---

## Phase 3c — Monitoring Layer (creates real moat)

### 3c-2: Restaurant availability monitoring
**Priority:** P2
**What:** For date_night plans, monitor whether the primary recommended restaurant is bookable at the target time. If OpenTable/Resy shows no availability for the user's requested slot, proactively suggest the backup.
**Why:** "I tried to book and there was no table" is the most common failure mode for restaurant recommendations. The system should catch this before the user does.
**Pros:** Turns a static recommendation into a live, actionable one. High trust signal.
**Cons:** OpenTable/Resy don't have free availability APIs — may require browser automation or third-party services.
**Context:** Start with a simpler version: add an `availability_check_url` to the restaurant plan that deep-links directly to OpenTable/Resy search for that restaurant at that date/time. If the restaurant has a direct booking URL (from Google Places data), pre-fill it. Full availability polling is a phase 3d item.
**Depends on:** 3b-1 (pre-filled deep links).

---

### 3c-3: Post-experience feedback capture
**Priority:** P1
**What:** 24 hours after a plan's event date, send an in-app prompt: "How was [Restaurant Name]?" with structured options: ✅ Great / ⚠️ OK but [too noisy / too expensive / too far / bad service] / ❌ Didn't go. Capture structured reasons, not just thumbs up/down.
**Why:** "Went" is a weak signal. "Went and it was too noisy" is a strong signal that should immediately downweight that restaurant for future quiet-dinner requests. Structured feedback is the foundation of the learning loop.
**Pros:** Directly feeds the score adjustment system. Creates a feedback loop that compounds over time.
**Cons:** Requires a scheduler to send the prompt at the right time. UX must be frictionless (1-2 taps max).
**Context:** New DB table: `feedback_prompts (id, plan_id, user_session, scheduled_for, sent_at, responded_at, response_json)`. New cron route `GET /api/cron/feedback-prompts` checks for plans where `event_datetime` was 24h ago and no feedback exists. In-app: a dismissible card at the top of the chat feed saying "How was your dinner at X?" with 3-4 quick-tap options. Response stored in `plan_outcomes` with `outcome_type: "post_experience_feedback"` and structured `metadata`.
**Depends on:** 3b-2 (event_datetime in DecisionPlan enables scheduling).
**Completed:** v0.2.11.0 (2026-03-22)

---

## Phase 3d — Learning Loop Activation (activates when data exists)

### 3d-1: Preference weight correction from negative feedback
**Priority:** P2
**What:** When a user reports "too noisy", "too far", "too expensive" as structured feedback (from 3c-3), update that user's implicit preference profile. On next request, the NLU layer injects these learned constraints: "this user historically finds restaurants too noisy — weight ambient noise signal higher."
**Why:** The system gets smarter per-user without the user having to re-specify preferences every time.
**Pros:** Creates compounding personalization. Hard to replicate without the outcome data.
**Cons:** Requires per-user preference store. Session-based users (no login) need a stable device ID.
**Context:** New table `user_preferences (session_id, preference_key, preference_value, confidence, updated_at)`. Keys: `noise_sensitivity`, `distance_tolerance_km`, `budget_sensitivity`, `cuisine_diversity`. Updated after each structured feedback event. `runNLU()` in `lib/nlu.ts` accepts an optional `userPreferences` map and injects them into the NLU prompt as soft constraints.
**Depends on:** 3c-3 (structured feedback required to build preference signal).

---

### 3d-2: Enable score adjustments after data threshold
**Priority:** P2
**What:** Set `ENABLE_SCORE_ADJUSTMENTS=true` in production env after: ≥30 days since v0.2.2.0 AND ≥100 rows in `plan_outcomes`.
**Why:** `getScoreAdjustments()` is implemented and tested — it computes recency-weighted venue approval rates. Just needs enough data to be reliable.
**Pros:** Rankings automatically improve based on real user outcomes. Zero additional code.
**Cons:** Risk of noise if enabled too early (< 3 outcomes per venue doesn't trigger anyway, but overall pool quality matters).
**Context:** Query in `lib/scenario2.ts`. Check data threshold: `SELECT COUNT(*) FROM plan_outcomes WHERE created_at > NOW() - INTERVAL '30 days'`. Enable when count ≥ 100.
**Depends on:** ≥30 days of live data after v0.2.2.0 (2026-03-22). Earliest activation: ~2026-04-22.

---

## Agent / Backend

## Frontend / UI

## Completed

### SSE stream timeout for scenario planners
**Completed:** v0.2.5.0 (2026-03-22)
Server-side 45s `Promise.race` timeout wraps `runAgent()` in `app/api/chat/route.ts`. Client-side `AbortController` stall watchdog (50s) in `app/hooks/useChat.ts` cancels hung streams with a clear user-facing retry message.

### 3c-1: Price drop alert for saved plans
**Completed:** v0.2.14.0 (2026-03-22)
`price_watches` table + `POST /api/plan/[id]/price-watch` (register) + `GET /api/cron/price-check` (daily SerpAPI re-query, records `price_drop_alert` in `plan_outcomes` when drop ≥10%). `watch_price` ActionRail action on weekend_trip and city_trip. 12 new tests.

### 3b-3: Send plan to friends (group voting)
**Completed:** v0.2.13.0 (2026-03-22)
`plan_votes` table with unique `(plan_id, voter_session)` index. `POST /api/plan/[id]/vote` upserts a vote; `GET` returns tally by option_id. Share page renders vote UI (all options + vote buttons + live progress bars) when `?vote=true` is present. `send_for_vote` ActionRail action (all 4 planners) saves the plan with `vote_mode: true` and copies `?vote=true` URL to clipboard. 7 new tests.

### 3a-1: Collapse all scenario outputs to 1+2 format
**Completed:** v0.2.12.0 (2026-03-22)
Added `show_more_available?: boolean` to `DecisionPlan` in `lib/types.ts`. All 4 planners (date_night, weekend_trip, city_trip/modular engine, big_purchase) already capped backups at 2; now each sets the flag — `true` when the underlying pool had >2 extras (date_night if >3 total, big_purchase if >3 total; weekend_trip and modular engine always `false` since they build exactly 3 packages). `ScenarioPlanView` renders a subtle invite below the backup grid when `show_more_available=true`. 2 new tests.

### 3a-2: Comparative tradeoff_summary at plan level
**Completed:** v0.2.6.0 (2026-03-22)
Added `tradeoff_summary?: string` to `DecisionPlan` in `lib/types.ts`. All 4 planners (date_night, weekend_trip via `buildWeekendTripTradeoffSummary`, city_trip via `EngineConfig`, big_purchase via IIFE) now generate comparative text explaining why the primary is the default and what each backup trades. Rendered in `ScenarioPlanView` between primary card and backup section. 5 new tests added.

### ActionRail horizontal scroll on mobile
**Completed:** v0.2.5.0 (2026-03-22)
`components/ActionRail.tsx` switched to `flexWrap: "nowrap"` + `overflowX: "auto"` single scrollable row. Right-edge fade gradient added as scroll hint. Scrollbar hidden cross-browser via `.hide-scrollbar` CSS class + inline styles.

### Interactive share page + partner approval (execution layer)
**Completed:** v0.2.3.0 (2026-03-22)
`app/plan/[id]/page.tsx` + `SharedPlanView.tsx` render plans read-only. Partner approval button fires `POST /api/plan/[id]/outcome` with `outcome_type: "partner_approved"`. GET handler supports calendar deep links. `decision_plans` and `plan_outcomes` tables ensured on startup.

### Refine flow + parent_plan_id lineage tracking
**Completed:** v0.2.3.0 (2026-03-22)
Refine button calls `chat.sendMessage(prompt)` to re-run the full planner pipeline. `refinedFromPlanIdRef` in `page.tsx` captures the source plan ID; passed as `parent_plan_id` to `POST /api/plan/save`. `decision_plans` table has `parent_plan_id TEXT` column (via `ALTER TABLE ADD COLUMN IF NOT EXISTS`).

### Extract scenario render path from page.tsx into ScenarioPlanView component
**Completed:** v0.2.1.0 (2026-03-21)

### Split lib/agent.ts into sub-modules (PLAN1.md refactor)
Split 2467-line `lib/agent.ts` into 22 files under `lib/agent/`: `composer/scoring.ts`, `category.ts`, `parse/{restaurant,hotel,flight,credit-card,subscription,smartphone,headphone,laptop,weekend-trip,index}.ts`, `pipelines/{credit-card,laptop,smartphone,headphone,hotel,flight,restaurant,utils}.ts`, `planners/{weekend-trip,date-night}.ts`. Main `lib/agent.ts` is now 404 lines (orchestrator + re-exports). All exports preserved. Tests pass.
