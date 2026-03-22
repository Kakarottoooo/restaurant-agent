# TODOS

## Phase 4 — Real-time Availability + Identity + Push

### 4b-1: Real-time restaurant availability
**Priority:** P0
**What:** When generating a `date_night` plan, synchronously fetch real available time slots for the primary restaurant and display them inline — "20:00 · 2 seats available". Currently we only provide an OpenTable deep link; the user doesn't know if there's actually a table.
**Why:** "I tried to book and there was no table" is the most common failure mode. Showing real availability transforms a recommendation into a confirmed option. Eliminates the user's biggest remaining anxiety.
**Pros:** Closes the last gap between recommendation and action. High trust signal — if we say "20:00 is open", it's open.
**Cons:** OpenTable and Resy don't have a free public availability API. Options: (1) OpenTable widget embed (free, limited control), (2) Resy API (waitlist-based partner access), (3) SevenRooms (enterprise), (4) browser automation / Puppeteer for scraping (fragile, ToS risk). Most realistic near-term path: OpenTable availability widget or iframe embed per restaurant when `opentable_url` is known.
**Context:** `PrimaryPlanCard` already renders the "Check availability on OpenTable" link (3c-2). Upgrade: if we can get a restaurant's OpenTable `rid` (restaurant ID) from the Google Places data or OpenTable search API, we can embed their availability picker widget directly in the card (`<script src="https://www.opentable.com/widget/reservation/loader?rid=...">` or REST endpoint). Fall back to deep link if widget fails. Store `opentable_rid` on `RecommendationCard` if found.
**Depends on:** OpenTable partner API access OR widget embed approach.

---

---

## Execution Layer / Learning Loop

### Learning loop activation
**Priority:** P2
**What:** Set `ENABLE_SCORE_ADJUSTMENTS=true` after ≥30 days AND ≥100 `plan_outcomes` rows.
**Why:** Converts accumulated outcome signals into smarter venue rankings.
**Pros:** Folio gets measurably better over time.
**Cons:** Risk of promoting noise if enabled too early.
**Context:** SQL query implemented in `lib/scenario2.ts` `getScoreAdjustments()`. Query JOINs `decision_plans + plan_outcomes`, extracts stable venue IDs via `evidence_card_id`, computes recency-weighted (30-day decay) signed approval rates, requires ≥3 outcomes per venue. Enable by setting `ENABLE_SCORE_ADJUSTMENTS=true` in env. Monitor ranking quality after enabling.
**Depends on:** ≥30 days of live user data after v0.2.2.0. Earliest activation: ~2026-04-22.

---

## Phase 5 — New Scenarios (EngineConfig expansion)

### 5a-1: Gift recommendation OS
**Priority:** P2
**What:** "给我妈买生日礼物，她喜欢园艺，预算 150 美元" → 3 个礼物包：安全选 / 最走心 / 最有创意。每个包含：具体商品 + 购买链接 + 为什么适合 + 为什么不选另外两个。
**Why:** 礼物选择是高焦虑决策场景，和 date_night / weekend_trip 同等结构：有预算、有对象偏好、有场景约束、需要理由。
**Pros:** EngineConfig 模式已存在，新场景成本极低。商品搜索可复用 SerpAPI (shopping search)。无需新 DB 表。
**Cons:** 商品数据质量参差不齐；Amazon/商家 URL 有 affiliate 合规问题需注意。
**Context:** 新建 `lib/agent/scenario-configs/gift.ts` EngineConfig + `lib/agent/parse/gift.ts` 意图解析。数据源：SerpAPI shopping API。 评分维度：偏好匹配度 + 独特性 + 实用性 + 价位合理性。
**Completed:** v0.2.20.0 (2026-03-22)

---

---

---

## Phase 3a — Decision Compression (highest leverage)

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
**Completed (partial):** v0.2.15.0 (2026-03-22) — simpler version shipped: "Check availability on OpenTable" secondary action added to all date_night plan options when no direct `opentable_url` is known. Pre-fills restaurant name + covers from intent.party_size. Full real-time availability polling deferred to phase 3d.

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
**Completed:** v0.2.16.0 (2026-03-22) — `user_preferences` table + `upsertUserPreference` / `getUserPreferences` in `lib/db.ts`. `analyzeMultilingualQuery` accepts `userPreferences` and injects them as `constraints_hint` entries for both English fast-path and non-English MiniMax path. `POST /api/feedback-prompts` maps `too_noisy → noise_sensitivity:high`, `too_expensive → budget_sensitivity:high`, `too_far → distance_tolerance:low` and upserts after each feedback event. `ChatRequestSchema` now accepts `session_id`; `runAgent` loads preferences from DB and passes to NLU. 7 new tests in `nlu.test.ts`.

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

### Phase 3.1: Review semantic signal extraction
**Completed:** v0.2.22.0 (2026-03-22) — `fetchReviewSignals()` in `lib/tools.ts` extracts structured signals (noise_level, wait_time, date_suitability, service_pace, notable_dishes, red_flags, best_for, review_confidence) from real reviews. Google reviews used when available; Tavily (Yelp/Reddit/TripAdvisor) fetched for the rest. MiniMax parses the raw text into `ReviewSignals`. Injected before `rankAndExplain`. `RecommendationCard` shows "Real reviews say" block with noise icon, wait time, dishes, red flags, and up to 2 Google review quotes.

---

### Phase 3.2: Structured scoring framework
**Completed:** v0.2.22.0 (2026-03-22) — `computeWeightedScore()` replaces free-form AI scores. 5 dimensions: scene_match (30%), budget_match (25%), review_quality (20%), location_convenience (15%), preference_match (10%), minus red_flag_penalty. AI fills dimension scores; system computes `weighted_total` and re-sorts. Custom weights injectable. `RecommendationCard` shows collapsible score breakdown panel. Full fallback path also uses same scorer.

---

### 5a-3: Fitness / wellness session OS
**Completed:** v0.2.21.0 (2026-03-22) — `fitness` scenario live. Google Places as v1 data source. Intent parser covers 12 activity types (yoga + 8 styles, pilates, spin, HIIT, CrossFit, boxing, dance, meditation, barre, swimming, running, martial arts) + day/time/skill/budget/neighborhood extraction. Three-tier studio selection (Top rated / Most popular / Best value). ClassPass primary CTA + Mindbody + Maps secondary links. Budget filters $$$ studios when budget < $20/class. City center coordinates resolved from CITIES config to prevent SF bias. Full bilingual (EN/ZH). 24 tests covering parser and planner.

---

### 5a-2: Concert / event ticket OS
**Completed:** v0.2.19.0 (2026-03-22) — `concert_event` scenario live. Ticketmaster Discovery API client (`lib/ticketmaster.ts`). Intent parser extracts artist name via proper-noun regex or falls back to genre keywords. Custom planner builds DecisionPlan with up to 3 events (Top pick / Most exciting / Hidden gem), direct buy-ticket links, venue map links, price ranges, and bilingual copy. Supports concerts, festivals, theater, sports, comedy. 17 tests covering API client, intent parser, and planner.

---

### 4b-2: User accounts + cross-device preference sync
**Completed:** v0.2.18.0 (2026-03-22) — `user_id TEXT` column added to `user_preferences` with partial unique index `(user_id, preference_key) WHERE user_id IS NOT NULL`. `getUserPreferences(sessionId, userId?)` queries by `user_id` when provided. `upsertUserPreference(...)` uses the user-keyed index when `userId` is set. `mergeSessionPreferences(sessionId, userId)` stamps `user_id` on all session rows on sign-in. `POST /api/user/preferences/merge` (Clerk `auth()` server-side) calls merge. `ClerkSync.tsx` fires the merge once per sign-in (fire-and-forget, idempotent). `useChat` now sends `session_id` + `user_id` in every request. `runAgent` passes `userId` to `getUserPreferences`.

---

### 4b-3: Active push notifications
**Completed:** v0.2.18.0 (2026-03-22) — `user_notifications` table with `push_endpoint TEXT UNIQUE` + `push_subscription JSONB`. `web-push` npm package integrated. `lib/push.ts` wraps `webpush.sendNotification` with VAPID keys from env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). `GET /api/notifications/subscribe` returns the VAPID public key; `POST /api/notifications/subscribe` stores the subscription. Service worker (`public/sw.js`) handles `push` and `notificationclick` events. Price-check cron (`/api/cron/price-check`) calls `sendPushNotification` for all subscriptions linked to the session when a price drop ≥ threshold is detected. "Watch price" ActionRail button calls `subscribeToPushNotifications` before registering the watch — requests browser permission + stores the subscription.

---

### 3a-3: Weekend Trip unified package assembly
**Completed:** v0.2.7.0 (2026-03-22)
`runWeekendTripPlanner()` assembles 3 unified trip packages (stable/value/experience), each combining one flight + one hotel + estimated total + best credit card. `buildWeekendTripTimingNote()` parses `arrival_time` (HH:MM), computes gap vs 15:00 check-in, generates early/late-night/clean-handoff notes. `buildWeekendTripRisks()` adds warnings for early arrival (>3h gap), tight window (<2h gap), and late-night (≥22:00) arrivals. 6 tests in `scenario2.test.ts`.

### 4a-1: Decision language upgrade (PrimaryPlanCard)
**Completed:** v0.2.17.0 (2026-03-22)
`PrimaryPlanCard` detects `confidence === "high"` and switches to green border + "✓ Selected for you" label. `ScenarioBrief` shows "Your plan" (gold) for high-confidence plans. Confidence badge: green + checkmark for high, amber for medium, grey for low. `ScenarioPlanView` collapses backups by default when confidence is high, with a toggle showing "Show alternatives (N)".

### 3b-3b: Date Night multi-venue chaining (evening package)
**Completed:** v0.2.17.0 (2026-03-22)
`searchAfterDinnerVenue()` in `lib/tools.ts` queries Google Places for a cocktail bar / wine bar / dessert café within 1km of the primary restaurant. Walk time calculated via haversine at 80 m/min. `PlanOption.after_dinner_option?: AfterDinnerVenue` field added (stored on option so it survives backup promotion). Backup plans get no venue. Skips search for `follow_up_preference === "walk"` or `"none"`. `PrimaryPlanCard` renders "Then →" section with venue name, walk time, vibe, and Google Maps link (bilingual: EN + ZH). 4 new tests.

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
