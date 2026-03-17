# Shared Task Notes

## Status
**Phase 3 is complete.** All 5 features have been implemented and build passes.

## What was done
- **OpenTable URLs**: Generated per-restaurant in `lib/agent.ts` using `https://www.opentable.com/s?term=NAME&metroId=4&covers=N`
- **Filter chips**: Price ($/$$/$$$/$$$$) and cuisine chips in `app/page.tsx`; filter `visibleCards` client-side
- **Map view**: `components/MapView.tsx` using react-leaflet + OpenStreetMap; toggled via List/Map buttons
- **Favorites**: Heart button on each card saves to `localStorage` under key `restaurant-favorites`
- **Share via URL**: Search query stored in `?q=` param; Share button copies URL; auto-searches on load if `?q=` present

## Next steps
Phase 3 is fully done per PLAN.md. No further work needed unless new requirements are added.

## Notes for future iterations
- `Restaurant` type now includes `lat`, `lng`, `description` fields (extracted from Google Places API)
- `react-leaflet` + `leaflet` + `@types/leaflet` have been added to dependencies
- Leaflet marker icons are loaded from CDN (unpkg) to avoid webpack issues with Next.js
