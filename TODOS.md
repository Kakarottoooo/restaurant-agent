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

## Agent / Backend

### SSE stream timeout for scenario planners
**Priority:** P2
**What:** When SerpAPI or MiniMax hangs, the SSE stream for date_night/weekend_trip/city_trip/big_purchase never completes — user sees an infinite spinner.
**Why:** Degrades UX silently; hard to debug in production.
**Pros:** Fixes a reliability gap across all 4 scenario planners.
**Cons:** Requires per-planner timeout + client-side timeout detection.
**Context:** Each planner makes SerpAPI + MiniMax calls via Promise.all(). If any call hangs past the AbortSignal timeout, the SSE stream is never closed. Client has no timeout. Fix: add AbortController with ~30s per planner and a final `data: [DONE]` flush in the catch handler; client should detect stalled stream after 45s.
**Depends on:** None.

---

## Frontend / UI

### ActionRail horizontal scroll on mobile
**Priority:** P3
**What:** On small viewports, switch ActionRail from flex-wrap to overflow-x: auto single scrollable row.
**Why:** 5-7 pills wrapping into 2-3 rows creates visual noise on mobile. Single row is more intentional.
**Pros:** Cleaner mobile UX. No content hidden.
**Cons:** Discoverable only if user swipes. No scroll hint — may need a fade gradient at the right edge.
**Context:** Deferred from Phase 2 (Big Purchase OS + Execution Deep Links). `ActionRail` is in `components/ActionRail.tsx`. Change: remove `flex-wrap`, add `overflow-x: auto`, `white-space: nowrap` to pill container. Add a right-edge fade gradient to hint at more content. Test at 375px with 7 buttons.
**Depends on:** Phase 2 ship (Big Purchase OS).

---

## Completed

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
