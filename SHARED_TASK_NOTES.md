# Shared Task Notes

## Status
All PLAN.md items complete. Color theme updated (dark mode backgrounds lightened from near-black).

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

## Remaining work
No known remaining work. All PLAN.md items implemented. Future backlog: Itinerary Builder, User accounts, Preference Profile, Community reviews — explicitly post-MVP.
