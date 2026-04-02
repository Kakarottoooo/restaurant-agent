/**
 * Booking.com hotel autopilot.
 *
 * Strategy:
 *   1. Try navigating directly to a hotel-specific Booking.com search using the
 *      hotel name as the search term (ss=<name>, not ss=<city>) — this returns
 *      a filtered list that's much easier to match.
 *   2. Find the hotel card using broad fuzzy matching on the most distinctive
 *      words in the name (strips generic words like "Hotel", "Inn", "Suites").
 *   3. Click through to the hotel page, click Reserve on the cheapest room.
 *   4. Pre-fill guest info if provided.
 *   5. Return screenshot + URL — user just hits Confirm.
 */
import { chromium } from "playwright";
import type { HotelAutopilotRequest, AutopilotResult } from "./types";
import { buildBookingComUrl } from "../agent/planners/booking-links";
import { injectCookies } from "./cookie-store";

/** Words too generic to use alone as a hotel name match signal. */
const GENERIC_HOTEL_WORDS = new Set([
  "hotel", "inn", "suites", "suite", "resort", "motel", "lodge", "hostel",
  "apartments", "apartment", "studios", "studio", "the", "a", "at", "by",
  "and", "&", "of", "rooms", "bed", "breakfast",
]);

/**
 * Extract the 2-3 most distinctive words from a hotel name.
 * "Hollywood Inn Suites Hotel" → ["Hollywood"]
 * "Westin Bonaventure Hotel" → ["Westin", "Bonaventure"]
 */
function distinctiveWords(name: string): string[] {
  return name
    .split(/[\s\-–—,/]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length >= 3 && !GENERIC_HOTEL_WORDS.has(w.toLowerCase()))
    .slice(0, 3);
}

/** Build a regex that matches if ALL distinctive words are present (order-insensitive). */
function buildFuzzyPattern(name: string): RegExp | null {
  const words = distinctiveWords(name);
  if (words.length === 0) return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  // Each word must appear somewhere in the element text
  const parts = words.map((w) => `(?=.*\\b${w}\\b)`);
  return new RegExp(parts.join(""), "i");
}

export async function runBookingComAutopilot(
  req: HotelAutopilotRequest
): Promise<AutopilotResult> {
  // City-based fallback URL (for handoff if we can't navigate further)
  const cityFallbackUrl = buildBookingComUrl({
    city: req.city,
    checkin: req.checkin,
    checkout: req.checkout,
    adults: req.adults,
  });

  // Hotel-name search URL — much more targeted than city search
  const hotelSearchUrl = buildBookingComUrl({
    city: req.hotel_name,   // Booking.com's ss= param accepts hotel names too
    checkin: req.checkin,
    checkout: req.checkout,
    adults: req.adults,
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  // Hide automation signals that trigger Booking.com bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });
  // Inject saved Booking.com session cookies so user lands already signed in
  await injectCookies(context, ["booking_com"]);

  const page = await context.newPage();

  try {
    // ── Step 1: Hotel-name search ─────────────────────────────────────────────
    await page.goto(hotelSearchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    // Let Booking.com's SPA finish rendering (it lazy-loads results)
    await page.waitForTimeout(3000);

    // Dismiss overlays: cookie banner, date picker, sign-in modal
    for (const dismissSel of [
      "button[data-testid='accept-cookie-button']",
      "button[aria-label='Dismiss sign-in info.']",
      "button[data-testid='header-sign-in-button-wrapper']",
    ]) {
      await page.locator(dismissSel).first().click({ timeout: 1500 }).catch(() => {});
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);

    // ── Step 2: Extract hotel URL via page.evaluate() ─────────────────────────
    // page.evaluate() runs inside the browser — bypasses Playwright locator API
    // limitations and works on the fully-rendered DOM including shadow DOM text.
    const fuzzyWords = distinctiveWords(req.hotel_name);
    const hotelHref = await page.evaluate((words: string[]) => {
      // Find all anchors that contain a hotel path
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(
        "a[href*='/hotel/'], a[href*='booking.com/hotel']"
      ));
      for (const a of anchors) {
        const text = (a.textContent ?? "").toLowerCase();
        // All distinctive words must appear in the anchor text
        if (words.length > 0 && words.every((w) => text.includes(w.toLowerCase()))) {
          return a.href;
        }
      }
      // Looser fallback: any anchor whose text contains at least one distinctive word
      // (catches cases where words are split across child elements)
      const allHotelAnchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(
        "a[href*='/hotel/']"
      ));
      for (const a of allHotelAnchors) {
        const parentText = (a.closest("[data-testid='property-card']")?.textContent ?? a.textContent ?? "").toLowerCase();
        if (words.some((w) => parentText.includes(w.toLowerCase()))) {
          return a.href;
        }
      }
      return null;
    }, fuzzyWords);

    if (!hotelHref) {
      const screenshot = await page.screenshot({ type: "png" });
      return {
        status: "no_availability",
        screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
        handoff_url: cityFallbackUrl,
        error: `Could not find "${req.hotel_name}" on Booking.com — try searching manually`,
      };
    }

    // ── Step 3: Navigate directly to hotel page via href ─────────────────────
    // page.evaluate returns a.href which is always absolute
    const fullHotelUrl = hotelHref.startsWith("http")
      ? hotelHref
      : `https://www.booking.com${hotelHref}`;
    await page.goto(fullHotelUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);
    // Dismiss overlays on hotel page too
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // ── Step 4: Click Reserve on the first/cheapest room ─────────────────────
    const reserveSelectors = [
      "[data-testid='reserve-button']",
      "button:has-text('Reserve')",
      "a:has-text('Reserve')",
      "button:has-text('Book now')",
      "a:has-text('Book now')",
    ];
    for (const sel of reserveSelectors) {
      const btn = page.locator(sel).first();
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
          btn.click(),
        ]);
        break;
      }
    }
    await page.waitForTimeout(800);

    // ── Step 5: Pre-fill guest details ───────────────────────────────────────
    if (req.user_profile) {
      const { first_name, last_name, email, phone } = req.user_profile;
      await fillIfPresent(page, "[name='firstname'], [id*='fname'], [placeholder*='First']", first_name);
      await fillIfPresent(page, "[name='lastname'], [id*='lname'], [placeholder*='Last']", last_name);
      await fillIfPresent(page, "[name='email'], [type='email']", email);
      await fillIfPresent(page, "[name='phone'], [type='tel']", phone);
    }

    await page.waitForTimeout(400);
    const screenshot = await page.screenshot({ type: "png", fullPage: false });

    return {
      status: "ready",
      screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
      handoff_url: page.url(),
    };
  } catch (err) {
    const screenshot = await page.screenshot({ type: "png" }).catch(() => null);
    return {
      status: "error",
      screenshot_base64: screenshot
        ? `data:image/png;base64,${screenshot.toString("base64")}`
        : undefined,
      handoff_url: cityFallbackUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await browser.close();
  }
}

async function fillIfPresent(
  page: import("playwright").Page,
  selector: string,
  value: string
): Promise<void> {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1000 })) {
      await el.fill(value);
    }
  } catch {
    // field not present — skip
  }
}
