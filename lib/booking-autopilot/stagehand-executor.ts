/**
 * stagehand-executor.ts
 *
 * Universal AI-driven browser executor.
 * Uses Stagehand + Claude vision to navigate any booking website and fill forms.
 * Replaces the hardcoded opentable.ts / booking-com.ts / kayak-flights.ts scripts.
 *
 * Production: runs on Browserbase (cloud browser, bot evasion, no Vercel timeout).
 * Development: runs on local Playwright (no API key required).
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type { BrowserTaskInput, BrowserTaskResult } from "./types";
import { writeAgentLog } from "../db";

/** URL patterns that indicate we've reached a payment/checkout page. */
const PAYMENT_URL_PATTERNS = [
  "/checkout",
  "/payment",
  "/billing",
  "/reserve/confirm",
  "/book/confirm",
  "/finalize",
  "/pay",
  "/purchase",
];

/** Keywords in page content that suggest a payment gate. */
const PAYMENT_KEYWORDS = [
  "credit card",
  "card number",
  "cvv",
  "expiry",
  "expiration",
  "payment method",
  "card details",
  "billing information",
  "pay now",
  "complete purchase",
  "confirm and pay",
];

function isPaymentUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return PAYMENT_URL_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Run a booking task on any website using AI vision.
 *
 * The agent navigates the site, fills all known fields (name / email / phone /
 * dates / party size), and stops before entering payment information.
 * Returns a screenshot and the handoff URL so the user can complete payment.
 */
export async function runBrowserTask(
  input: BrowserTaskInput
): Promise<BrowserTaskResult> {
  const useCloud =
    !!(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID);

  // Resolve model name — Stagehand v3 uses "provider/model" format
  const modelName = input.agentModel?.model ?? "openai/gpt-4o-2024-08-06";

  // Resolve API key from user-supplied config or env fallback
  const modelApiKey = input.agentModel?.apiKey
    ?? (modelName.startsWith("google/") || modelName.includes("gemini")
        ? (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY)
        : modelName.startsWith("anthropic/") || modelName.includes("claude")
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY);

  // Stagehand reads credentials from env vars (providerEnvVarMap), NOT from the
  // model config object. Inject the resolved key into the correct env var so
  // both constructor-level (act/observe) and agent-level calls can find it.
  if (modelApiKey) {
    if (modelName.startsWith("google/") || modelName.includes("gemini")) {
      process.env.GEMINI_API_KEY = modelApiKey;
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = modelApiKey;
    } else if (modelName.startsWith("anthropic/") || modelName.includes("claude")) {
      process.env.ANTHROPIC_API_KEY = modelApiKey;
    } else {
      process.env.OPENAI_API_KEY = modelApiKey;
    }
  }

  const stagehand = new Stagehand({
    env: useCloud ? "BROWSERBASE" : "LOCAL",
    ...(useCloud && {
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    }),
    model: modelName,  // just the string — Stagehand reads key from env vars above
    verbose: 0,
    disablePino: true,
  });

  try {
    await stagehand.init();
    // v3 API: get active page from context (resolvePage is private)
    const page = stagehand.context.activePage() ?? await stagehand.context.newPage();

    // Navigate to the starting URL
    await page.goto(input.startUrl, { waitUntil: "domcontentloaded", timeoutMs: 30_000 });

    // Build the agent instruction
    const instruction = buildInstruction(input);

    // Agent uses the same model string — key is already in process.env
    const agent = stagehand.agent({
      model: modelName,
      systemPrompt: `You are a booking assistant completing a reservation on behalf of a user.

YOUR JOB:
1. Navigate to the booking page and select the requested dates/options.
2. Fill in ALL guest information fields (full name, email, phone, billing address) using the details provided.
3. Fill in the CREDIT CARD NUMBER and EXPIRY DATE if provided — these are safe to enter.
4. STOP immediately before entering the CVV / security code field, OR before clicking any final "Pay Now", "Confirm Payment", or "Complete Purchase" button.
5. Report what page you stopped at and the current URL.

IMPORTANT DISTINCTIONS:
- Guest info forms (name, email, phone, address) → FILL THEM IN and continue
- Date / room / seat / party-size selection → SELECT and continue
- Credit card NUMBER and EXPIRY DATE → FILL THEM IN and continue
- CVV / security code field → STOP HERE, do not fill
- Final payment confirmation button ("Pay Now", "Confirm Payment", "Complete Purchase") → STOP HERE, do not click

CALENDAR & DATE PICKERS:
- Click the check-in date first, then the check-out date directly in the calendar grid
- If the first click opens the calendar, click the exact date cell number
- After both dates are selected, look for "Book now" / "Reserve" / "Check availability" and click it
- NEVER report dates as selected unless you can clearly see them shown as chosen on the page

BROWSER ERRORS — IGNORE THESE, KEEP GOING:
- reCAPTCHA errors ("Invalid domain", "Invalid site key", reCAPTCHA failed to load) → IGNORE, fill the form fields anyway
- CORS errors, network errors, console errors → IGNORE, they do not block you from typing into fields
- Only stop for a VISIBLE on-screen CAPTCHA challenge (image grid, checkbox, slider) that blocks submission
- JavaScript console errors are invisible to the user and do NOT stop you from filling text inputs

The user will enter the CVV and click the final payment button themselves. Your job is to fill everything up to that point.`,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await agent.execute({ instruction, maxSteps: 40 }) as any;

    const currentUrl = page.url();
    const screenshotBuffer = await page.screenshot({ type: "png" });
    const screenshotBase64 = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

    const sessionUrl = useCloud ? stagehand.browserbaseSessionURL : undefined;

    // Verify the agent made real progress by checking page content
    let pageText = "";
    try {
      pageText = await page.evaluate(() =>
        (document.body?.innerText ?? "").toLowerCase().slice(0, 3000)
      ) as string;
    } catch { /* ignore — best-effort */ }

    // Detect stuck at listing/search page (dates not selected, no booking progress)
    const stuckAtListing =
      (pageText.includes("select dates to continue") ||
       pageText.includes("select check-in and check-out") ||
       pageText.includes("enter your dates") ||
       pageText.includes("add dates for prices") ||
       (pageText.includes("book now") && pageText.includes("select dates"))) &&
      !pageText.includes("your reservation") &&
      !pageText.includes("review your booking") &&
      !pageText.includes("confirm and pay") &&
      !pageText.includes("request to book");

    if (stuckAtListing) {
      return {
        status: "error",
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: "Agent couldn't select the dates — the calendar UI was too complex. Open the link to complete the booking yourself.",
        error: "Stuck at date selection — no booking progress detected",
      };
    }

    // Detect: reached checkout page but form fields are still empty (agent stopped early)
    const msg = (result.message ?? "").toLowerCase();
    const hitPaymentUrl = isPaymentUrl(currentUrl);

    const agentMentionsCaptchaBlock =
      msg.includes("recaptcha") ||
      msg.includes("captcha") ||
      msg.includes("cloudflare");

    // If agent is on a checkout page but says it was blocked by captcha AND
    // form fields look empty → escalate to error so user can see the real state
    const onCheckoutWithEmptyForm =
      hitPaymentUrl &&
      agentMentionsCaptchaBlock &&
      !result.completed &&
      (pageText.includes("enter your first name") ||
       pageText.includes("enter your last name") ||
       pageText.includes("enter your email") ||
       (pageText.includes("first name") && pageText.includes("last name") && pageText.includes("email") && !pageText.includes("@")));

    if (onCheckoutWithEmptyForm) {
      return {
        status: "paused_payment",  // still send user to the page — they're 1 step away
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: "Agent reached the guest info form but was blocked by a reCAPTCHA error from filling it automatically. Open the link — the dates are pre-selected, just fill your name, email and phone.",
      };
    }

    // Agent stopped before CVV/pay button (has filled card number+expiry already)
    const hitPaymentGate =
      hitPaymentUrl ||
      msg.includes("cvv") ||
      msg.includes("security code") ||
      msg.includes("pay now") ||
      msg.includes("confirm payment") ||
      msg.includes("complete purchase") ||
      msg.includes("payment card") ||
      // Legacy: agent stopped at card entry page before filling anything
      (msg.includes("credit card") && !msg.includes("filled")) ||
      (msg.includes("card number") && !msg.includes("filled"));

    if (hitPaymentGate) {
      return {
        status: "paused_payment",
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: result.message || "Reached payment page — ready for you to complete.",
      };
    }

    // Agent stopped because it needs guest info from the user
    const needsGuestInfo =
      msg.includes("personal detail") ||
      msg.includes("guest detail") ||
      msg.includes("guest information") ||
      msg.includes("contact information") ||
      msg.includes("no guest") ||
      (!result.completed && msg.includes("form"));

    if (needsGuestInfo) {
      return {
        status: "needs_login",   // reuses the "needs intervention" flow in tasks UI
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: result.message || "Agent reached the guest info form but has no profile data. Please add your details in Preferences → My Profile.",
        error: "No guest profile — add your name, email and phone in Preferences → My Profile, then retry.",
      };
    }

    // Check for no availability
    const noAvailability =
      result.message?.toLowerCase().includes("no availability") ||
      result.message?.toLowerCase().includes("not available") ||
      result.message?.toLowerCase().includes("sold out") ||
      result.message?.toLowerCase().includes("fully booked");

    if (noAvailability) {
      return {
        status: "no_availability",
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: result.message || "No availability found.",
      };
    }

    // Needs login
    const needsLogin =
      result.message?.toLowerCase().includes("sign in") ||
      result.message?.toLowerCase().includes("log in") ||
      result.message?.toLowerCase().includes("create account") ||
      currentUrl.toLowerCase().includes("login") ||
      currentUrl.toLowerCase().includes("signin");

    if (needsLogin) {
      return {
        status: "needs_login",
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: "The site requires a login. Open the link to sign in and continue.",
      };
    }

    return {
      status: result.completed ? "completed" : "paused_payment",
      screenshotBase64,
      handoffUrl: currentUrl,
      sessionUrl,
      summary: result.message || "Task completed.",
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    // Write to persistent agent log for debugging
    await writeAgentLog({
      session_id: input.jobId ?? "",
      job_id: input.jobId ?? null,
      level: "error",
      source: "stagehand-executor",
      message: error,
      details: {
        startUrl: input.startUrl,
        task: input.task.slice(0, 500),
        stepIndex: input.stepIndex,
        stack: stack?.slice(0, 1000),
      },
    });

    // Captcha detection
    if (
      error.toLowerCase().includes("captcha") ||
      error.toLowerCase().includes("cloudflare") ||
      error.toLowerCase().includes("blocked")
    ) {
      return {
        status: "captcha",
        handoffUrl: input.startUrl,
        summary: "The site blocked the agent. Open the link to continue manually.",
        error,
      };
    }

    return {
      status: "error",
      handoffUrl: input.startUrl,
      summary: "An unexpected error occurred.",
      error,
    };
  } finally {
    await stagehand.close().catch(() => {});
  }
}

// ── Task instruction builders ────────────────────────────────────────────────

function buildInstruction(input: BrowserTaskInput): string {
  const p = input.profile;
  const hasProfile = !!(p.first_name || p.last_name || p.email || p.phone);

  if (hasProfile) {
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ");
    const addressParts = [
      p.address_line1 && `Street: ${p.address_line1}`,
      p.city && `City: ${p.city}`,
      p.state && `State: ${p.state}`,
      p.zip && `ZIP: ${p.zip}`,
      p.country && `Country: ${p.country}`,
    ].filter(Boolean);
    const cardParts = [
      p.card_name && `Cardholder name: ${p.card_name}`,
      p.card_number && `Card number: ${p.card_number}`,
      p.card_expiry && `Expiry date: ${p.card_expiry}`,
    ].filter(Boolean);

    return `${input.task}

Guest details — fill these into ALL guest/contact information fields you encounter:
- Full name: ${fullName}
- Email: ${p.email}
- Phone: ${p.phone}
${addressParts.length ? `\nBilling address:\n${addressParts.map(a => `- ${a}`).join("\n")}` : ""}
${cardParts.length ? `\nPayment card (fill number and expiry, then STOP before CVV):\n${cardParts.map(c => `- ${c}`).join("\n")}` : ""}

Fill ALL guest info and billing address fields. Fill card number and expiry date if present.
STOP before the CVV / security code field and before any final "Pay Now" / "Confirm Payment" button.`;
  }

  // No profile — navigate as far as possible then stop and list what's needed
  return `${input.task}

No guest details provided. Navigate and select dates/room options. When you reach a guest information form (name, email, phone), stop and clearly list every field the form is asking for so the user knows what to provide.`;
}

/** Build a natural-language task for restaurant booking. */
export function buildRestaurantTask(params: {
  restaurantName: string;
  city: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  covers: number;
  profile: import("./types").BookingProfile;
}): Pick<BrowserTaskInput, "task" | "profile"> {
  return {
    profile: params.profile,
    task: `Find ${params.restaurantName} restaurant in ${params.city} and book a table for ${params.covers} people on ${params.date} at ${params.time}. Select the closest available time slot if the exact time is unavailable. Fill in the guest information form completely.`,
  };
}

/** Build a natural-language task for hotel booking. */
export function buildHotelTask(params: {
  hotelName: string;
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
  profile: import("./types").BookingProfile;
}): Pick<BrowserTaskInput, "task" | "profile"> {
  return {
    profile: params.profile,
    task: `Find ${params.hotelName} hotel in ${params.city} and book the cheapest available room for ${params.adults} adult(s), checking in ${params.checkin} and checking out ${params.checkout}. Fill in the guest information completely.`,
  };
}

/** Build a natural-language task for flight booking. */
export function buildFlightTask(params: {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
  preferNonstop: boolean;
  profile: import("./types").BookingProfile;
}): Pick<BrowserTaskInput, "task" | "profile"> {
  return {
    profile: params.profile,
    task: `Find the cheapest ${params.preferNonstop ? "non-stop " : ""}flight from ${params.origin} to ${params.destination} on ${params.date} for ${params.passengers} passenger(s). Select the best option and proceed to the passenger details form. Fill in all required information.`,
  };
}
