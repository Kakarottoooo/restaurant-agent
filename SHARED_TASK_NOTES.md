# Shared Task Notes

## Status
near_location feature fully implemented. Build passes.

## Architecture notes
- `FlyToController` is a render-null react-leaflet child component; it calls `map.flyTo()` in a `useEffect` keyed on `[trigger, lat, lng]` where `trigger` is the `selectedIndex`
- Map Leaflet icon creation uses `L.divIcon` with inline HTML; `L` is loaded in `useEffect` (SSR-safe since MapView is dynamically imported with `ssr: false`)
- `isMapMode` flag in `page.tsx` conditionally renders either the full-width map branch or the scrollable list branch — they are siblings under `<main>`, not nested
- Icon script: `scripts/generate-icons.mjs` — run with `node scripts/generate-icons.mjs` to regenerate
- Filter chips are hidden in map mode (visible only in list mode) to save vertical space

## Color theme (dark mode tokens in app/globals.css)
- `--bg: #1C1C1C` (deep charcoal, not pure black)
- `--card: #242424`
- `--card-2: #2A2A2A`
- `--text-primary: #F0EAD6` (warm off-white)
- `--text-secondary: #8A8070`
- `--gold: #C9A84C` (accent, unchanged)

## near_location feature (implemented this iteration)
- **UI**: City `<select>` replaced with a custom input+dropdown in the header
  - Input placeholder: "Near where? (e.g. Union Square)"
  - Shows city label / "◎ Near Me" / typed location when unfocused
  - On focus: dropdown opens with "Use My Location" + filterable city list
  - On Enter or blur (not clicking dropdown item): typed text → `nearLocation` state
  - `locationSuppressBlur` ref prevents double-processing when clicking dropdown items
- **API flow**: `nearLocation` → `/api/chat` → `runAgent` → `gatherCandidates`
- **Geocoding**: `lib/tools.ts` `geocodeLocation()` uses Google Geocoding API (same key as Places)
- **Search bias**: `googlePlacesSearch` uses 5km radius when `nearLocationCoords` provided (vs 20km default)
- **Distance**: Haversine in tools.ts; results sorted by proximity; `restaurant.distance` in meters
- **Cards**: `RecommendationCard` shows "X.X mi from [label]" badge when distance + nearLocationLabel set
- **parseIntent**: also extracts `near_location` from message text; UI value takes priority

## Remaining work
No known remaining work. Future backlog: Itinerary Builder, User accounts, Preference Profile, Community reviews — explicitly post-MVP.
