# Shared Task Notes

## Status
Phase 3 fully implemented and build passes. All PLAN.md phases complete.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- Filter chips are hidden in map mode
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 3 features (implemented this iteration)

### Phase 3.1 — Review Signal Extraction
- `ReviewSignals` interface in `lib/types.ts`, added to `Restaurant.review_signals?`
- `ReviewSignalsSchema` in `lib/schemas.ts`
- `fetchReviewSignals()` in `lib/tools.ts` — uses Tavily advanced search + MiniMax to extract structured signals for top 12 candidates
- `lib/agent.ts`: called between `gatherCandidates` and `rankAndExplain`; signals injected into restaurant objects and formatted in the ranking prompt
- `RecommendationCard.tsx`: "Real reviews say" section shows noise, wait, notable dishes, red flags

### Phase 3.2 — Structured Scoring Framework
- `ScoringDimensions` interface in `lib/types.ts`, `ScoringDimensionsSchema` in `lib/schemas.ts`
- `computeWeightedScore()` in `lib/agent.ts` with weights: scene_match 30%, budget_match 25%, review_quality 20%, location_convenience 15%, preference_match 10%
- `rankAndExplain` prompt now asks AI to fill 5-dimension scoring; system computes `weighted_total` and re-sorts
- `RecommendationCard.tsx`: collapsible dimension score bars (click "综合评分 X.X" to expand)

### Phase 3.3a — Session Preferences
- `SessionPreferences` interface in `lib/types.ts`
- `extractRefinements()` in `lib/agent.ts` (lightweight AI call)
- `useChat.ts`: client-side lightweight refinement detection (quiet/lively/cheaper/no chains)
- `sessionPreferences` passed to `/api/chat` and injected in both `parseIntent` and `rankAndExplain` prompts
- `ChatRequestSchema` updated to accept `sessionPreferences` and `profileContext`

### Phase 3.3b — Persistent Preferences
- `UserPreferenceProfile` interface in `lib/types.ts`
- `app/hooks/usePreferences.ts`: full hook with `updateProfile`, `learnFromFavorite`, `learnFromSearch`, `learnFromFeedback`, `resetProfile`; localStorage-backed
- `formatProfileForPrompt()` exported — formats profile as natural language for AI context
- `useFavorites.ts` updated to accept optional `learnFromFavorite` callback (called on add, not remove)
- `page.tsx`: preferences modal (⚙ button in header) with dietary restrictions, noise preference toggle, chains toggle, budget slider
- Profile context injected into `useChat` → `/api/chat` → `runAgent` → `parseIntent`

### Phase 3.3c — Feedback Loop
- `FeedbackRecord` interface in `lib/types.ts`
- `RecommendationCard.tsx`: "去了？分享体验" link at card bottom; 👍/👎 rating; issue multi-select; saves to localStorage `restaurant-feedback` (max 50)
- `usePreferences.ts`: `learnFromFeedback` auto-applies feedback to profile (e.g., "比描述的吵" → `noise_preference: "quiet"`)

## Remaining work
All PLAN.md phases complete. Future backlog: Itinerary Builder, User accounts, Community reviews.
