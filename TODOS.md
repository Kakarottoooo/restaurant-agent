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

## Frontend / UI

## Completed

### SSE stream timeout for scenario planners
**Completed:** v0.2.5.0 (2026-03-22)
Server-side 45s `Promise.race` timeout wraps `runAgent()` in `app/api/chat/route.ts`. Client-side `AbortController` stall watchdog (50s) in `app/hooks/useChat.ts` cancels hung streams with a clear user-facing retry message.

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
