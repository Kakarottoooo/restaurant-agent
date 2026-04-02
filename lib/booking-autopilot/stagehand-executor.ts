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

  const stagehand = new Stagehand({
    env: useCloud ? "BROWSERBASE" : "LOCAL",
    ...(useCloud && {
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    }),
    model: {
      provider: "anthropic",
      name: "claude-sonnet-4-6",
      clientOptions: { apiKey: process.env.ANTHROPIC_API_KEY },
    },
    verbose: 0,
    disablePino: true,
  });

  try {
    await stagehand.init();
    const page = stagehand.page;

    // Navigate to the starting URL
    await page.goto(input.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Build the agent instruction
    const instruction = buildInstruction(input);

    // Run the agent
    const agent = stagehand.agent({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      instructions: `You are a booking assistant helping a user complete a reservation.
Follow the task exactly. Navigate the site, fill in all provided information.
CRITICAL: Stop immediately when you reach ANY payment page, credit card form,
or checkout confirmation that requires payment details. Do NOT enter payment info.
Take a screenshot just before stopping.`,
    });

    const result = await agent.execute({
      instruction,
      maxSteps: 25,
    });

    const currentUrl = page.url();
    const screenshotBuffer = await page.screenshot({ type: "png" });
    const screenshotBase64 = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

    const sessionUrl = useCloud ? stagehand.browserbaseSessionURL : undefined;

    // Determine outcome
    const hitPaymentUrl = isPaymentUrl(currentUrl);
    const agentStopped =
      result.message?.toLowerCase().includes("payment") ||
      result.message?.toLowerCase().includes("credit card") ||
      result.message?.toLowerCase().includes("stopped") ||
      !result.completed;

    if (hitPaymentUrl || agentStopped) {
      return {
        status: "paused_payment",
        screenshotBase64,
        handoffUrl: currentUrl,
        sessionUrl,
        summary: result.message || "Reached payment page — ready for you to complete.",
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
  // If a custom task is provided, inject profile details into it
  const profileBlock = `
User details to fill in forms:
- Full name: ${input.profile.first_name} ${input.profile.last_name}
- Email: ${input.profile.email}
- Phone: ${input.profile.phone}

STOP before entering any payment or credit card information.`.trim();

  return `${input.task}\n\n${profileBlock}`;
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
