# Shared Task Notes

## Status
All 5 phases complete. Build passes cleanly.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate
- middleware renamed to `proxy.ts` (Next.js 16 convention)

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 5 features (implemented this iteration)

### Phase 5.1 — Real Review Signals
- `GoogleReview` interface in `lib/types.ts`; `google_reviews?: GoogleReview[]` on `Restaurant`
- `googlePlacesSearch` now includes `places.reviews` in FieldMask → maps to `google_reviews[]`
- `fetchReviewSignals` in `lib/tools.ts`: uses Google reviews (when ≥2 available) as primary source, Tavily (reddit/yelp) as fallback for restaurants with fewer reviews
- `RecommendationCard.tsx`: "Real reviews say" now shows "Google Maps" badge + original quote excerpts (max 2) with author and time attribution

### Phase 5.2 — Voice Input
- `app/hooks/useVoiceInput.ts`: custom hook wrapping Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`)
- Auto-detects language (zh-CN for Chinese browsers, en-US otherwise)
- Returns `isSupported` flag — mic button hidden when browser doesn't support it
- `page.tsx`: mic button added to input bar; gold pulse animation when listening; auto-sends on result
- Input placeholder switches to "正在聆听..." while listening

### Phase 5.3 — User Account System (Clerk)
- `@clerk/nextjs` + `@vercel/postgres` installed
- Auth architecture: `AuthContext` (safe context, never throws) + `ClerkSync` (bridges Clerk state to context, only rendered inside ClerkProvider)
- `clerkEnabled` check in `layout.tsx` — only wraps with ClerkProvider when real keys are configured
- Env vars needed: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `POSTGRES_URL`
- DB schema in `lib/schema.sql`, init in `lib/db.ts`
- API routes: `app/api/user/profile/route.ts`, `app/api/user/favorites/route.ts`, `app/api/user/feedback/route.ts`
- `useAuth` hook in `app/hooks/useAuth.ts` — reads from AuthContext, includes `migrateLocalDataToCloud()`
- `usePreferences` + `useFavorites`: dual-track mode — localStorage when not signed in, cloud sync when signed in
- Header: shows "登录" button when anonymous; avatar + dropdown when signed in
- Upgrade prompt toast: appears after 3rd favorite when not signed in
- Data migration: on sign-in, automatically uploads localStorage data to cloud

## Remaining work
All PLAN.md phases (1–5) complete. Future backlog: Itinerary Builder, community reviews.

## To activate Clerk/accounts
1. Create project at https://clerk.com
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Provision Vercel Postgres (or Neon) and add `POSTGRES_URL`
4. Run SQL in `lib/schema.sql` to create tables
