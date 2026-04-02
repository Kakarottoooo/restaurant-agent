# Browser-Use Autopilot Plan

## Goal

Replace hardcoded Playwright scripts (OpenTable/Booking.com/Kayak only) with
AI-vision-driven browser automation that works on **any** booking website.

User experience: select a plan → agent navigates the web, fills every form,
stops at the payment page → pushes a notification → user taps "Pay" to finish.

---

## Why Stagehand

Instead of brittle CSS selectors that break when sites update their DOM, Stagehand
uses Claude's vision to read the page like a human and decide what to click/type.
One universal executor replaces three platform-specific scripts and generalises to
every restaurant, hotel, airline, or activity site in the world.

```
Old:  opentable.ts (181 lines) + booking-com.ts (230 lines) + kayak-flights.ts (209 lines)
      → 3 scripts, 620 lines, 3 sites only, breaks on DOM changes

New:  stagehand-executor.ts (1 executor, ~150 lines)
      → any site, AI-driven, self-healing
```

---

## Architecture

```
User approves plan
        │
        ▼
POST /api/booking-jobs  (existing — unchanged)
  creates BookingJob with steps[]
        │
        ▼
Job runner  (existing — lib/agent-runtime/runner.ts)
  iterates steps sequentially
        │
        ▼
  For each step:
  BrowserUseExecutor.run({
    startUrl,          ← search URL or direct booking URL
    task,              ← natural-language goal ("book table for 2 at Nobu, March 15 7pm")
    profile,           ← { name, email, phone } for form filling
    jobId, stepIndex,
  })
        │
        ├─ agent navigates, fills forms autonomously
        │
        ├─ detects payment page → PAUSE
        │     save screenshot to step
        │     set step.status = "awaiting_confirmation"
        │     set step.actionItem = { type: "confirm_payment", handoffUrl }
        │     push notification → user
        │
        └─ user taps notification → opens handoffUrl → pays → done
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| AI browser | **Stagehand** (`@browserbasehq/stagehand`) | TypeScript-native, uses Claude vision, wraps Playwright |
| Cloud browser | **Browserbase** | Runs in cloud, bot evasion, avoids Vercel timeout |
| Local dev | Stagehand local mode (Playwright) | No Browserbase key needed for dev |
| Model | `claude-sonnet-4-6` | Best balance of speed + vision accuracy |

---

## Phase 1 — Core Infrastructure  ✅ implement now

**Tasks:**
1. `npm install @browserbasehq/stagehand`
2. Add env vars: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`
3. Create `lib/booking-autopilot/stagehand-executor.ts` — universal executor
4. Create `app/api/booking-autopilot/universal/route.ts` — single API endpoint
5. Update `lib/db.ts` step status types to include `"awaiting_confirmation"`
6. Update `lib/booking-autopilot/types.ts` with new result shape

**Executor interface:**
```typescript
interface BrowserTaskInput {
  startUrl: string;           // where to start (search page or direct URL)
  task: string;               // natural language: "book table for 2 at Nobu..."
  profile: BookingProfile;    // name/email/phone for form filling
  jobId: string;
  stepIndex: number;
}

type BrowserTaskStatus =
  | "completed"              // fully done (rare — most sites require payment)
  | "paused_payment"         // reached payment page, waiting for user
  | "needs_login"            // site requires account login
  | "captcha"                // blocked by captcha
  | "no_availability"        // agent confirmed nothing available
  | "error"                  // unexpected failure

interface BrowserTaskResult {
  status: BrowserTaskStatus;
  screenshotBase64?: string;  // what the agent sees at pause point
  handoffUrl: string;         // URL for user to continue
  sessionUrl?: string;        // Browserbase live-view URL (debug)
  summary: string;            // human-readable: "Found 7:30pm slot, filled your info"
}
```

---

## Phase 2 — Replace Platform Scripts  ✅ implement now

Replace the three hardcoded scripts with calls to the universal executor:

| Old file | New approach |
|----------|-------------|
| `opentable.ts` | `executor.run({ startUrl: opentableSearchUrl, task: "..." })` |
| `booking-com.ts` | `executor.run({ startUrl: bookingComUrl, task: "..." })` |
| `kayak-flights.ts` | `executor.run({ startUrl: kayakUrl, task: "..." })` |

The old files are kept but marked deprecated. The skill system routes through
the universal executor instead.

**Task construction examples:**
```typescript
// Restaurant
task = `Find ${name} restaurant and book a table for ${covers} people
        on ${date} at ${time}. Fill in: ${profile.first_name} ${profile.last_name},
        email ${profile.email}, phone ${profile.phone}.
        Stop before entering payment information.`

// Hotel
task = `Find ${hotelName} hotel and select the cheapest available room
        for ${checkin} to ${checkout} for ${adults} adults.
        Fill guest details: ${profile.first_name} ${profile.last_name},
        email ${profile.email}. Stop before payment.`

// Flight
task = `Find the cheapest non-stop flight from ${origin} to ${dest}
        on ${date} for ${passengers} passenger(s). Select it and
        proceed to checkout. Stop before payment.`
```

---

## Phase 3 — Pause-at-Payment & Notify  ✅ implement now

The executor detects payment pages via:
1. `stagehand.extract()` — check for credit card fields / "payment" headings
2. URL patterns: `/checkout`, `/payment`, `/billing`, `/reserve/confirm`

On detection:
1. Take screenshot
2. Return `status: "paused_payment"`
3. Job runner sets `step.status = "awaiting_confirmation"`
4. Sets `step.actionItem = { type: "confirm_payment", label: "Complete payment", url }`
5. Push notification: "Your table at Nobu is ready — tap to pay"

---

## Phase 4 — Live Browser View (future)

Stream Browserbase session screenshots to the Tasks UI so users can watch
the agent work in real time.

- Browserbase provides a `sessionUrl` (debug viewer)
- Show as an iframe or screenshot poll in `app/tasks/page.tsx`
- Users can see exactly what the agent is doing

---

## New Files

```
lib/booking-autopilot/
  stagehand-executor.ts    ← universal AI browser executor  [Phase 1]
  types.ts                 ← updated types (BrowserTaskInput/Result)  [Phase 1]
  opentable.ts             ← kept, marked @deprecated  [Phase 2]
  booking-com.ts           ← kept, marked @deprecated  [Phase 2]
  kayak-flights.ts         ← kept, marked @deprecated  [Phase 2]

app/api/booking-autopilot/
  universal/route.ts       ← single POST endpoint for any site  [Phase 1]
  restaurant/route.ts      ← updated to call universal executor  [Phase 2]
  hotel/route.ts           ← updated to call universal executor  [Phase 2]
```

---

## Required Env Vars

```env
# Browserbase (cloud browser — required for production)
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=

# Already present
ANTHROPIC_API_KEY=         ← used by Stagehand for vision
```

Local dev works without Browserbase (Stagehand falls back to local Playwright).

---

## What We Are NOT Doing

- Completing payment (card details = security risk, always user's action)
- Storing site passwords (handoff URL keeps the session warm instead)
- Running on Vercel Edge (needs Node.js runtime — already on standard functions)
