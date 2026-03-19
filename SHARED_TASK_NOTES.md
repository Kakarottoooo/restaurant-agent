# Shared Task Notes

## Status
Phase 9 complete. Build passes cleanly. All PLAN.md phases (1–9) done.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component
- Map Leaflet icon creation uses `L.divIcon` with inline HTML (SSR-safe via dynamic import with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders map or list branches
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate
- middleware renamed to `proxy.ts` (Next.js 16 convention)

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C`, `--card: #242424`, `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6`, `--text-secondary: #8A8070`, `--gold: #C9A84C`

## Phase 9 features (implemented this iteration)

### Credit Card Agent Architecture
- `CategoryType` now includes `"credit_card"` (lib/types.ts)
- New types: `CreditCard`, `SpendingProfile`, `CreditCardIntent`, `CreditCardRecommendationCard` in `lib/types.ts`
- Static card database: `data/credit-cards.json` — 35 cards covering Chase, Amex, Citi, Capital One, Discover, Wells Fargo, Bank of America, US Bank, Bilt, Fidelity
- Computation engine: `lib/creditCardEngine.ts` — marginal value algorithm (portfolio delta approach)
- Intent detection in `detectCategory()` — credit card keywords checked before flight/hotel to avoid collision
- `parseCreditCardIntent()` in `lib/agent.ts` — extracts spending_profile, existing_cards, reward_preference via MiniMax
- `runCreditCardPipeline()` in `lib/agent.ts` — calls engine, returns top-5 cards
- `runAgent()` updated: new `creditCardRecommendations` field in return type; `CreditCardIntent` added to requirements union
- API route sends `creditCardRecommendations` in SSE `complete` event
- `useChat.ts` handles `credit_card` category, stores in `allCreditCardCards` state
- `CreditCardCard.tsx` component — shows rank, issuer color, annual fee, net gain, signup bonus, category breakdown, watch-out notes (expandable)
- `page.tsx` renders credit card results with disclaimer footer

### Marginal Value Algorithm
- Computes current portfolio's annual net benefit (rewards − fees)
- For each candidate card: computes new portfolio benefit after adding it
- `marginal_value` = new_benefit − current_benefit (net of new card's annual fee)
- `category_breakdown` shows only categories where candidate improves over current best rate
- `signup_bonus_value` = bonus_points × point_value (shown separately, never merged into annual benefit)
- Results sorted by marginal_value descending, top 5 returned

### Data Notes
- All 35 cards have `last_verified: "2026-02-01"` displayed in UI
- Rates are conservative estimates from publicly known data
- No external APIs for card data — fully static, manually maintained
- High-fee card credits (Amex Platinum $695, Venture X $395) mentioned in `notes[]` only

## To activate flight search
Add `SERPAPI_KEY` to `.env.local` (same key used for hotel search).

## To activate hotel search
Add `SERPAPI_KEY` to `.env.local` (register at https://serpapi.com — 250 free searches/month).

## To activate Clerk/accounts
1. Create project at https://clerk.com
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Provision Vercel Postgres (or Neon) and add `POSTGRES_URL`
4. Run SQL in `lib/schema.sql` to create tables

## Remaining work
All PLAN.md phases (1–9) complete. Future backlog: Itinerary Builder, community reviews, points redemption linkage between flight/hotel and credit card flows.
