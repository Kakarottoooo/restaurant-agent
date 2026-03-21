# TODOS

## Agent / Backend

### Split lib/agent.ts into sub-modules (PLAN1.md refactor)
**Priority:** P2
**What:** Split `lib/agent.ts` (currently 2467 lines) into the directory structure PLAN1.md proposed: `agent/pipelines/`, `agent/planners/`, `agent/category.ts`, `agent/parse/`, `agent/composer/`.
**Why:** `agent.ts` now runs every category pipeline, the scenario planner, NLU, hotel/flight/restaurant scoring, weekend trip logic, and date night logic. Each new scenario makes the file harder to navigate and test in isolation.
**Pros:** Each pipeline becomes independently readable and testable; onboarding a new category doesn't require reading 2400 lines.
**Cons:** Large refactor (~3-4 hours CC); must maintain exact same exports and behavior to avoid regressions.
**Context:** PLAN1.md explicitly planned this split. It was deferred when the scenario feature landed. The file was ~1300L before scenarios; it's now 2467L. The next major feature (e.g., `big_purchase` scenario) will push it past 3000L.
**Depends on:** No prerequisites. Can be done as a pure structural refactor (no behavioral changes). Write tests first if coverage is low on any pipelines being moved.

---

## Frontend / UI

### Extract scenario render path from page.tsx into ScenarioPlanView component
**Priority:** P2
**What:** Pull the `resultMode === "scenario_plan"` render block (~lines 1638–1800 in `app/page.tsx`) into a dedicated `<ScenarioPlanView plan={decisionPlan} onAction={...} />` component.
**Why:** `app/page.tsx` is 2185 lines. The scenario block is deeply nested inside the existing card render tree, making it hard to reason about the two render modes independently.
**Pros:** Easier to test the scenario UI in isolation; clearer separation between scenario_plan and category_cards render paths.
**Cons:** Minor refactor; props threading needed for callbacks (trackDecisionPlanEvent, swapDecisionPlanOption).
**Context:** The scenario feature is new. Extracting once it stabilizes (i.e., after 2-3 weeks of real usage) avoids premature abstraction on code that's still changing.
**Depends on:** Scenario feature must be stable (no active behavioral changes to the render path).

---

## Completed
