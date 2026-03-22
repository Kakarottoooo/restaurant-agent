# TODOS

## Agent / Backend

---

## Frontend / UI

---

## Completed

### Extract scenario render path from page.tsx into ScenarioPlanView component
**Completed:** v0.2.1.0 (2026-03-21)

### Split lib/agent.ts into sub-modules (PLAN1.md refactor)
Split 2467-line `lib/agent.ts` into 22 files under `lib/agent/`: `composer/scoring.ts`, `category.ts`, `parse/{restaurant,hotel,flight,credit-card,subscription,smartphone,headphone,laptop,weekend-trip,index}.ts`, `pipelines/{credit-card,laptop,smartphone,headphone,hotel,flight,restaurant,utils}.ts`, `planners/{weekend-trip,date-night}.ts`. Main `lib/agent.ts` is now 404 lines (orchestrator + re-exports). All exports preserved. Tests pass.
