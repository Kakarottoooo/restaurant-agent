# Booking Autopilot Plan

Goal: after the agent selects a restaurant/hotel/flight, the system navigates the booking
site, fills in all known fields, and hands a ready-to-confirm page to the user.
User action required: tap "Confirm" (and enter payment on checkout).

---

## Why This Is Now Feasible

- **Restaurants (OpenTable, Resy)**: minimal bot detection, stable DOM, short form
- **Hotels (Booking.com)**: Cloudflare present but lenient on residential IPs; form is straightforward
- **Flights (Kayak)**: stays as Kayak filtered-list for now — airlines have aggressive bot detection

---

## Architecture

```
Plan approved
    │
    ▼
User taps "Book for me →"
    │
    ▼
POST /api/booking-autopilot
  { type, venue_id, date, time, covers, user_profile }
    │
    ▼
Playwright session (server-side)
  ① Navigate to booking page
  ② Fill known fields (date / time / covers / name / email / phone)
  ③ Stop before payment — take screenshot
    │
    ▼
Return { screenshot_url, handoff_url, status }
    │
    ▼
Frontend shows screenshot + "Open to confirm →" button
    │
    ▼
User opens handoff_url in their browser
(session is warm — they land on the confirmation step)
```

---

## Phase 1 — Restaurant Autopilot (OpenTable)

**Target**: OpenTable restaurant pages with known `restaurant_id`.

**Input we already have from SerpAPI / Google Maps**:
- `restaurant.url` — often the Google Maps / Yelp URL, not OpenTable
- `restaurant.name` + `city` — enough to search OpenTable

**Flow**:
1. `GET https://www.opentable.com/s?term={name}&covers={n}&dateTime={date}T{time}:00`
2. Find and click the restaurant card (match by name)
3. Select the target time slot (closest to requested time)
4. Click "Find a Table"
5. Stop at the "Enter your info" page — screenshot and return URL

**User profile fields to pre-fill**:
```typescript
interface BookingProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // stored encrypted in user preferences
}
```

**New API route**: `app/api/booking-autopilot/restaurant/route.ts`

```typescript
POST /api/booking-autopilot/restaurant
Body: {
  restaurant_name: string;
  city: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  covers: number;
  user_profile?: BookingProfile;
}
Response: {
  status: "ready" | "no_availability" | "error";
  screenshot_url: string;   // base64 or uploaded to /tmp
  handoff_url: string;      // URL where user can complete booking
  selected_time: string;    // actual time slot found
}
```

**Implementation**: `lib/booking-autopilot/opentable.ts`
Uses `playwright` (already available or `npm i playwright`).

---

## Phase 2 — Hotel Autopilot (Booking.com)

**Flow**:
1. Navigate to our existing `buildBookingComUrl(...)` — already pre-fills city/dates/guests
2. Find and click the specific hotel by name
3. Select room type (cheapest available, or closest to preference)
4. Click through to "Enter your details"
5. Stop — screenshot + return handoff URL

Booking.com keeps URLs stateful via query params, so handoff URL is the results page URL
with the hotel pre-selected. User clicks "Reserve" to complete.

---

## Phase 3 — Resy Integration (alternative restaurant path)

Resy has tighter bot detection but also has a public API (used by Chase concierge).
If we can get API access: skip Playwright entirely, call Resy API directly to check
availability, then deep-link to `resy.com/cities/{city}/venues/{slug}?date=&seats=`.

---

## UI Changes

### Current flow
```
[Flight: BNA→LAX on Kayak →]   [Hotel: Westin on Booking.com →]   [Restaurant: Nobu →]
```

### New flow
```
[✈ Open Kayak →]    [🏨 Book Westin →]    [🍽 Book Nobu →]
                         ↓ click                ↓ click
                    [Autopilot modal]       [Autopilot modal]
                    ┌─────────────────┐    ┌─────────────────┐
                    │ 🤖 Filling form…│    │ 🤖 Filling form…│
                    │ [screenshot]    │    │ [screenshot]     │
                    │                 │    │                  │
                    │ [Open to book →]│    │ [Open to book →] │
                    └─────────────────┘    └─────────────────┘
```

Modal component: `components/BookingAutopilotModal.tsx`
- Shows animated "navigating..." state while API call is in flight
- Shows screenshot once ready
- "Open to book →" opens `handoff_url` in a new tab

---

## File Plan

```
lib/
  booking-autopilot/
    opentable.ts        ← Phase 1: Playwright flow for OpenTable
    booking-com.ts      ← Phase 2: Playwright flow for Booking.com
    types.ts            ← AutopilotRequest / AutopilotResult types

app/api/
  booking-autopilot/
    restaurant/route.ts ← POST handler calling opentable.ts
    hotel/route.ts      ← POST handler calling booking-com.ts

components/
  BookingAutopilotModal.tsx  ← UI modal with screenshot + handoff button
```

---

## Risk / Mitigations

| Risk | Mitigation |
|------|-----------|
| OpenTable changes DOM | Use `aria-label` / text selectors, not CSS paths |
| Playwright cold-start latency (~2s) | Show "navigating..." animation immediately |
| No availability at requested time | Return nearest available slots for user to pick |
| Booking.com Cloudflare block | Fall back to our existing `buildBookingComUrl` deep link |
| User closes modal before opening handoff | URL is returned and can be retried |

---

## What We Are NOT Doing

- Completing payment (requires payment card — out of scope, security risk)
- Storing login credentials for booking sites
- Automating flight booking (bot detection too aggressive on airlines)
- Running Playwright in a serverless edge function (needs persistent Node.js runtime)

---

## Next Steps

1. `npm install playwright && npx playwright install chromium`
2. Build `lib/booking-autopilot/opentable.ts` first (lowest friction)
3. Build the API route + modal UI
4. Test with a real Nashville restaurant on OpenTable
5. Repeat for Booking.com hotels
