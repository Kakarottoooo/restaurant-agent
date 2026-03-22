# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.9.0] - 2026-03-22

### Added
- **Credit card trip callout** (`trip_card_callout` on `DecisionPlan`): weekend_trip and city_trip plans now surface a one-line credit card recommendation — "Pay with Chase Sapphire Preferred ($95/yr) — earns 3x on travel and dining · sign-up bonus worth ~$750" — surfaced as a subtle strip below the primary plan card in `ScenarioPlanView`
- **`getBestCardForTrip`** + **`buildTripCardCallout`** (`lib/agent/planners/trip-card.ts`): new helpers that build a travel spending profile from trip costs (flight + hotel spread over 3 months), call `recommendCreditCards` with travel reward preference, and format a concise callout string in English or Chinese
- **14 new tests**: 10 unit tests for `getBestCardForTrip`/`buildTripCardCallout` in `trip-card.test.ts` + 4 integration tests in `scenario2.test.ts` verifying `trip_card_callout` presence and language on `weekend_trip` and `city_trip` plans

## [0.2.8.0] - 2026-03-22

### Added
- **Add to Calendar action** (`event_datetime`, `event_location` on `DecisionPlan`): all three planners (date_night, weekend_trip, city_trip) now populate a structured event datetime and location when date is known — enabling `.ics` export and calendar deep links
- **ICS calendar route** (`GET /api/plan/[id]/calendar`): returns a standards-compliant RFC 5545 `.ics` file with floating local time — works with Google Calendar, Apple Calendar, and Outlook
- **Share page calendar download** (`SharedPlanView.tsx`): "Add to Calendar (.ics)" download button appears on the share page when `event_datetime` is set, letting plan recipients save the event to any calendar app
- **City trip Google Calendar link**: `buildPlanOptionFromPackage` now adds a "Add to calendar" secondary action (Google Calendar deep link) for each city_trip option when `startDate` is known — links to hotel check-in event
- **15 new tests**: 8 tests in `scenario2.test.ts` covering `event_datetime`/`event_location` for all three scenario types + 7 tests in `plan-calendar.test.ts` covering the ICS route (404, 422, content-type, body structure, DTSTART, Content-Disposition)

## [0.2.7.0] - 2026-03-22

### Added
- **Pre-filled booking deep links** (`lib/agent/planners/booking-links.ts`): new URL builders for Google Hotels, Booking.com, Google Flights, and OpenTable — all landing on filtered results pages with dates, guests, and city pre-filled. Weekend trip planner now generates a Booking.com hotel URL and Google Flights deep link (`#flt=JFK.ORD.YYYY-MM-DD`) from parsed intent data; falls back to existing `booking_link` when intent lacks dates
- **Check-in gap feasibility** (`buildWeekendTripTimingNote`, `buildWeekendTripRisks`): `arrival_time` is now parsed (HH:MM) and compared against the standard 15:00 hotel check-in time — timing notes now read "5h before check-in" or "room should be ready on landing"; risk flags added for early arrival (>3h gap), tight window (<2h gap), and late-night (≥22:00) arrivals
- **29 new tests**: 14 unit tests for `booking-links.ts` URL builders + 15 integration tests covering check-in gap timing notes, risk flags, and pre-filled URL generation in `runWeekendTripPlanner`

## [0.2.6.0] - 2026-03-22

### Added
- **Comparative tradeoff summary** (`tradeoff_summary`): all 4 scenario planners (date_night, weekend_trip, city_trip, big_purchase) now generate a 1–2 sentence plan-level summary explaining why the primary is the default pick and what each backup trades off — rendered between the primary card and the backup section in `ScenarioPlanView`
- **Phase 3 TODOS**: added comprehensive Phase 3 implementation backlog (3a Decision Compression → 3b Execution Layer → 3c Monitoring → 3d Learning Loop) to TODOS.md

### Fixed
- **Planner-engine `tradeoff_summary` passthrough** (`lib/agent/planner-engine`): added `tradeoff_summary` to `EngineConfig` so city_trip config can supply its own comparative text

## [0.2.5.0] - 2026-03-22

### Added
- **ActionRail mobile scroll**: pill row now scrolls horizontally on mobile with a right-edge fade gradient hint — all actions stay reachable without wrapping
- **SSE stream timeout**: agent requests now time out after 45 seconds server-side; a client-side 50-second stall watchdog cancels hung streams with a clear retry message

### Fixed
- Fixed test fixtures for `MultilingualQueryContext` and `LaptopRecommendationCard` to match their interface shapes

## [0.2.4.0] - 2026-03-22

### Added
- **Big Purchase OS** (`big_purchase` scenario): routes laptop, headphone, and smartphone queries through a new decision planner that produces one clear primary recommendation + up to 2 backup alternatives — no more comparing specs across 10 cards
- **Execution Deep Links** (`open_link` PlanAction type): surfaces Amazon purchase links and other secondary actions (Maps, Calendar, hotel/flight booking) from all scenario planners into the ActionRail as clickable buttons — first link gets solid gold background, others get gold outline
- **`parseBigPurchaseIntent`** + **`runBigPurchasePlanner`**: new planners in `lib/agent/planners/big-purchase.ts` that extract product category, budget, OS preference, and use case from natural language, then build a `DecisionPlan` reusing existing laptop/headphone/smartphone pipelines
- **`mapLinksToOpenLinkActions`** utility (`lib/agent/planners/utils.ts`): shared helper that converts `PlanLinkAction[]` to `PlanAction[type="open_link"][]` with outcome tracking
- **BackupPlanCard tradeoff rendering**: when `tradeoff_reason` is set, it replaces the label; `tradeoff_detail` replaces the summary — backup cards now explain the trade-off instead of showing a generic "Backup 1" label
- **20 new tests** covering `detectScenarioFromMessage` big_purchase detection, `parseBigPurchaseIntent`, and `runBigPurchasePlanner` across null/valid/budget/category/language/tradeoff scenarios

### Changed
- **ActionRail** now owns execution deep links exclusively — `PrimaryPlanCard` no longer renders `secondary_actions`, preventing duplicate link rendering
- `detectScenarioFromMessage`: big_purchase detection added at lowest priority (after city_trip, weekend_trip, date_night), triggered by product category keyword + budget signal or purchase intent verb

## [0.2.3.0] - 2026-03-22

### Added
- **Share page** (`/plan/[id]`): read-only plan view for sharing with a partner — renders primary plan, backup options, and a "This works for me" approval button
- **Partner approval API** (`POST /api/plan/[id]/outcome`): records `partner_approved` outcome to `plan_outcomes` table; GET variant supports calendar deep-link outcomes (`?type=went`)
- **Plan save/fetch API** (`POST /api/plan/save`, `GET /api/plan/[id]`): persists `DecisionPlan` to `decision_plans` table; share action in the main UI saves plan and copies shareable URL
- **Refinement lineage** (`parent_plan_id`): when you refine a plan, Folio now tracks which plan it came from — enabling full refinement chains and future analysis of whether refining led to better outcomes
- **Venue intelligence** (`getScoreAdjustments`): real user outcomes now power a recency-weighted venue ranking model (30-day decay); activate with `ENABLE_SCORE_ADJUSTMENTS=true` once ≥30 days + ≥100 outcomes have been recorded

### Fixed
- **Test type errors**: fixed pre-existing TypeScript errors in `getScoreAdjustments.test.ts` (`"group_dinner"` → `"big_purchase"`), `scenario2.test.ts` (`"vibrant"` → `"mixed"`, missing `scenario_goal`), and `plan-outcome.test.ts` (QueryResult mock types)

## [0.2.2.0] - 2026-03-22

### Added
- **City trip scenario** (`city_trip`): new scenario that builds 3 tiered packages (Upscale / Trendy / Local vibe) combining hotel + restaurant + bar recommendations for multi-night city visits — ask things like "3 nights in Tokyo, want great food and nightlife"
- **Modular planner engine** (`lib/agent/planner-engine/`): generic tiered-package engine that can power any trip scenario; replaces per-scenario boilerplate with configuration — new scenarios now only need an `EngineConfig` factory instead of 400+ lines of custom code
- **City trip NLU detection**: `detectScenarioFromMessage` now recognizes city trip queries (destination + hotel + activities) and routes to the `city_trip` planner; includes priority logic to prefer `weekend_trip` when flight signals are present
- **City trip clarification flow**: when the agent needs more info (missing destination, dates, etc.), users now see a clear "I need one or two more details" message instead of silent fallthrough
- **City Trip analytics filter tab**: internal analytics dashboard now has a City Trip filter alongside Date Night, Weekend Trip, and Big Purchase

### Fixed
- **Analytics scenario filter** (`lib/scenarioEvents.ts`): `city_trip` was missing from `VALID_SCENARIOS` set — analytics queries filtered by city_trip scenario returned nothing silently; now included

## [0.2.1.1] - 2026-03-21

### Fixed
- **Telemetry scenario validation** (`app/api/telemetry/route.ts`): scenario events were written to DB without server-side validation of the `scenario` field — any client could insert arbitrary strings, silently corrupting `GROUP BY scenario` analytics queries; now validated against `VALID_SCENARIO_TYPES` allowlist before insert

## [0.2.1.0] - 2026-03-21

### Added
- **Agent sub-module split** (`lib/agent/`): extracted parsers, pipelines, and planners into 21 focused modules (`parse/`, `pipelines/`, `planners/`, `composer/`) — `lib/agent.ts` is now a thin orchestrator
- **ScenarioPlanView component** (`components/ScenarioPlanView.tsx`): consolidated scenario plan rendering (ScenarioBrief + PrimaryPlanCard + BackupPlanCard + ActionRail + ScenarioEvidencePanel) into one composable component

### Fixed
- **DB singleton reset on transient failure** (`lib/db.ts`): `ensureScenarioEventsTable` cached rejected Promises permanently — now resets on failure so the next call retries
- **Weekend trip detection false positive** (`lib/scenario2.ts`): hotel-only or flight-only queries ("find a hotel this weekend") no longer trigger the trip-package flow — requires BOTH flight AND hotel signals
- **Near Me mode departure city** (`lib/agent.ts`): passed `"your current location"` as flight departure instead of the real city name — weekend trip flight search now uses `city.fullName`
- **Stale scenario brief after backup promotion** (`app/hooks/useChat.ts`): `swapDecisionPlanOption` spread stale `scenario_brief`, `risks`, and `evidence_items` from the original primary plan — now reset on swap
- **SW navigation caching** (`public/sw.js`): all navigation responses were cached under `"/"`, overwriting the app shell with any page response — now only caches root navigations
- **Duplicate trip packages in limited inventory** (`lib/scenario2.ts`): `runWeekendTripPlanner` deduplicated flight+hotel combos before building backup plans — no more identical packages with different labels
- **Analytics access control** (`lib/scenarioEvents.ts`): when `INTERNAL_ANALYTICS_USER_IDS` env var was unset, any signed-in user could access raw analytics — now denies all access when allowlist is empty
- **Vitest picking up .claude/ worktrees** (`vitest.config.ts`): added exclude for `**/.claude/**` to prevent gstack internal tests and worktree snapshots from being included in test runs

### Changed
- **app/page.tsx**: replaced 5 individual scenario component imports with `ScenarioPlanView`

## [0.2.0.0] - 2026-03-21

### Added
- **Scenario decision engine** (`lib/scenario2.ts`, 1439L): `detectScenario`, `detectScenarioFromMessage`, `parseScenarioIntent`, `runScenarioPlanner` (date_night), `runWeekendTripPlanner` — full SSE-streaming scenario pipeline
- **Weekend trip planner**: 3-option DecisionPlan (stable/value/experience) from parallel hotel + flight searches
- **Date night planner**: `DecisionPlan` with backup options from restaurant search + scoring
- **NLU layer** (`lib/nlu.ts`): `analyzeMultilingualQuery` with MiniMax-backed multilingual support and English fast-path (skips API for pure English queries)
- **MiniMax client** (`lib/minimax.ts`): shared chat helper with configurable timeout (30s default, 60s for hotel ranking)
- **Internal analytics** (`app/api/internal/scenario-events/`, `lib/scenarioEvents.ts`): `GET /api/internal/scenario-events` with query parsing, days/limit clamping, Clerk-gated access
- **Internal analytics UI** (`app/internal/scenario-events/`): Clerk-gated analytics dashboard page
- **Scenario components**: `ActionRail`, `PrimaryPlanCard`, `BackupPlanCard`, `ScenarioBrief`, `ScenarioEvidencePanel`
- **Telemetry** (`app/api/telemetry/`): `plan_approved`, `option_swap`, `action_rail_click` events with DB persistence
- **TODOS.md**: P2 backlog items for `lib/agent.ts` split and `ScenarioPlanView` extraction
- **90 tests** across 5 test files covering all new code paths

### Changed
- `app/api/chat/route.ts`: SSE pipeline branches on `resultMode` — `scenario_plan` routes to scenario engine, `category_cards` preserves existing pipeline
- `app/page.tsx`: renders `ScenarioBrief + PrimaryPlanCard + ActionRail` for scenario_plan mode alongside existing card list
- `lib/agent.ts`: `parseIntent` now respects `scenario_hint` from NLU context; `detectCategory` uses `category_hint` fast-path
- `lib/types.ts`: added `DecisionPlan`, `PlanOption`, `ActionItem`, `ScenarioContext`, `WeekendTripIntent`, `DateNightIntent`, `FlightRecommendationCard`, `HotelRecommendationCard`

### Fixed
- **MiniMax timeout** (`lib/minimax.ts`): global timeout raised 8s→30s; hotel ranking uses 60s to prevent pipeline hangs
- **False weekend_trip detection** (`lib/scenario2.ts`): "round trip flights" and "business trip hotel" queries now correctly route as `flight`/`hotel`, not `weekend_trip` (regression ISSUE-002)
- **Open analytics in production** (`lib/scenarioEvents.ts`): `requireInternalAnalyticsAccess` now returns 403 in production when Clerk is not configured (security fix, ISSUE-002-security)
- **English NLU latency** (`lib/nlu.ts`): English queries skip MiniMax call entirely — ~300ms saved per query (ISSUE-004)
