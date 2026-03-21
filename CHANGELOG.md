# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
