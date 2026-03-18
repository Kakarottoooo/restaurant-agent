# Shared Task Notes

## Status
**Phase 1 (UI Redesign) and Phase 2 (GPS) are complete.**

## What was done this iteration
- **Fonts**: `layout.tsx` now loads Playfair Display + DM Sans from Google Fonts
- **CSS variables**: `globals.css` defines `--gold`, `--bg`, `--card`, `--card-2`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border`, `--amber`; auto-switches for dark mode via `@media (prefers-color-scheme: dark)`
- **Brand rename**: App is now "Folio." — Playfair Display 18px, gold period
- **Header**: 52px, city selector capsule with gold border, "Powered by Claude", Near Me badge
- **User bubble**: Right-aligned, dark brown fill (`var(--text-primary)`), `18px 18px 4px 18px` border-radius
- **Filter chips**: Gold active state, `border-radius: 20px`, `0.5px solid var(--border)` default
- **4-step loading progress**: Animated progress bars with gold fill, step labels that pulse while active
- **Degraded empty state**: Shown when filters produce no matches, with clear filter buttons
- **Restaurant cards**: Playfair name, rank badge, gold divider, "Why it fits" (F9F6EF + gold left border), "Watch out" (FDF6EC + amber left border), "Skip if" (no box), Reserve → button (gold fill)
- **GPS search**: "Use My Location" option in city selector; uses `navigator.geolocation`; passes `gpsCoords` to API; `agent.ts` uses coords as search center
- **PWA**: `public/manifest.json` + `public/sw.js` (basic offline caching); SW registered in `page.tsx` useEffect

## Remaining work per PLAN.md
1. **Map view redesign** (PLAN.md §1.6): Full-screen map + bottom horizontal scrollable thumbnail cards; flyTo on slide; gold border on selected card/pin. Current map is functional but not restyled.
2. **PWA icons**: `public/icon-192.png` and `public/icon-512.png` need to be created (manifest references them)

## Architecture notes
- All colors used via CSS custom properties (`var(--gold)` etc.) — no hard-coded hex in components except for dark-mode-agnostic amber boxes in card
- `gpsCoords` flows: `page.tsx` state → POST body → `route.ts` → `runAgent(cityId, gpsCoords)` → `gatherCandidates(cityId, gpsCoords)` → `googlePlacesSearch({ cityCenter: gpsCoords })`
- `--font-playfair` and `--font-dm-sans` CSS variables set by Next.js font loader in `layout.tsx`
