# Folio.

AI-powered restaurant recommendation app. Tell it what you're looking for in natural language — occasion, budget, vibe — and it returns curated picks with personalized "why it fits" explanations.

## How it works

Three-layer AI pipeline on every search:

1. **Intent parsing** (MiniMax) — extracts structured requirements from your message (cuisine, budget, atmosphere, occasion, location)
2. **Parallel data gathering** — Google Places API for real restaurant data + Tavily web search for editorial context, run concurrently
3. **Ranking & explanation** (MiniMax) — scores candidates against your requirements and generates personalized explanations, watch-outs, and "skip if" notes

## Features

- Natural language search with multi-turn refinement
- 27 US cities + GPS-based "Near Me" mode + custom landmark search
- List view and full-screen interactive map view
- Filter chips by price and cuisine
- Share results via URL
- Save favorites (localStorage)
- Dark mode (system preference)
- PWA-installable with offline support

## Prerequisites

- Node.js 20+
- API keys for:
  - `MINIMAX_API_KEY` — MiniMax platform
  - `GOOGLE_PLACES_API_KEY` — Google Cloud Console (Places API + Geocoding API enabled)
  - `TAVILY_API_KEY` — Tavily

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.local.example .env.local
# Fill in your API keys in .env.local

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (also versions the service worker) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests with Vitest |
| `npm run test:coverage` | Run tests with coverage report |

## Project structure

```
app/
  api/chat/route.ts     # API endpoint — rate limiting, Zod validation, agent call
  hooks/
    useChat.ts          # AI pipeline state, sendMessage, filter chips
    useLocation.ts      # City selection, GPS, near-location, SW registration
    useFavorites.ts     # Favorites with localStorage persistence
  page.tsx              # Root UI (rendering only, ~300 lines)
  globals.css           # Design tokens, dark mode, animations
  layout.tsx            # Fonts, metadata

lib/
  agent.ts              # 3-layer AI pipeline (parseIntent → gatherCandidates → rankAndExplain)
  tools.ts              # Google Places, Tavily, Geocoding API wrappers
  schemas.ts            # Zod schemas for request validation and AI response validation
  types.ts              # TypeScript interfaces
  cities.ts             # 27 US cities config

components/
  RecommendationCard.tsx  # Restaurant card with image, explanations, reserve link
  MapView.tsx             # Leaflet map with interactive markers and thumbnail strip

public/
  sw.js                 # Service worker (cache name versioned on build)
  manifest.json         # PWA manifest

scripts/
  inject-sw-version.mjs  # Postbuild: injects BUILD_ID into sw.js cache name
  generate-icons.mjs     # Generates PWA icons (192px, 512px)
```

## Deployment

Deploy to Vercel — it's a standard Next.js app. Set the three environment variables in your project settings.

**Note:** The rate limiter in `app/api/chat/route.ts` is in-memory (10 req/min per IP). For multi-replica deployments, replace it with `@upstash/ratelimit` backed by Redis.

## Known limitations

- No user accounts — favorites are stored in localStorage only
- English-language searches only
- Restaurant data sourced from Google Places (US coverage best)
- Tavily search enrichment is additive and non-fatal; recommendations still work without it
