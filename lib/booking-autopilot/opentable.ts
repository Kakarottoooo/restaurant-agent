/**
 * OpenTable booking autopilot.
 *
 * Navigates OpenTable, selects the restaurant, picks the closest available
 * time slot to the requested time, and stops at the "Enter your info" page.
 * Returns a screenshot + the URL at that point so the user can complete booking.
 */
import { chromium } from "playwright";
import type { RestaurantAutopilotRequest, AutopilotResult } from "./types";
import { buildOpenTableUrl } from "../agent/planners/booking-links";
import { injectCookies } from "./cookie-store";

/** Convert HH:MM to total minutes from midnight for comparison. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export async function runOpenTableAutopilot(
  req: RestaurantAutopilotRequest
): Promise<AutopilotResult> {
  // Fallback URL in case automation fails — always has something to hand off
  const fallbackUrl = buildOpenTableUrl({
    restaurantName: req.restaurant_name,
    city: req.city,
    date: req.date,
    time: req.time,
    covers: req.covers,
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
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });
  // Inject saved OpenTable cookies so user lands on the confirm step already signed in
  await injectCookies(context, ["opentable"]);
  const page = await context.newPage();

  try {
    // ── Step 1: Search OpenTable for the restaurant ──────────────────────────
    const searchUrl = buildOpenTableUrl({
      restaurantName: req.restaurant_name,
      city: req.city,
      date: req.date,
      time: req.time,
      covers: req.covers,
    });
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    // ── Step 2: Find matching restaurant card ────────────────────────────────
    // OpenTable search results use data-test="search-result" or similar
    // We match by restaurant name (case-insensitive partial match)
    const restaurantLink = await page.locator("a").filter({
      hasText: new RegExp(req.restaurant_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    }).first();

    const linkVisible = await restaurantLink.isVisible().catch(() => false);

    if (!linkVisible) {
      // No match found — return fallback URL with screenshot of search results
      const screenshot = await page.screenshot({ type: "png" });
      return {
        status: "no_availability",
        screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
        handoff_url: fallbackUrl,
        error: `Could not find "${req.restaurant_name}" in OpenTable search results`,
      };
    }

    // Click through to the restaurant page
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }),
      restaurantLink.click(),
    ]);

    // ── Step 3: Find and select the closest available time slot ──────────────
    const requestedMinutes = toMinutes(req.time);

    // OpenTable time buttons are often aria-label="7:00 PM" style
    const timeButtons = await page.locator(
      "[data-test='time-button'], button[aria-label*=':'], a[aria-label*=':']"
    ).all();

    let bestButton = null;
    let bestDiff = Infinity;
    let selectedTime = "";

    for (const btn of timeButtons) {
      const label = await btn.getAttribute("aria-label") ?? await btn.textContent() ?? "";
      // Parse "7:00 PM" or "19:00" style labels
      const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) continue;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = (match[3] ?? "").toUpperCase();
      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      const diff = Math.abs(hours * 60 + minutes - requestedMinutes);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestButton = btn;
        selectedTime = label.trim();
      }
    }

    if (!bestButton) {
      const screenshot = await page.screenshot({ type: "png" });
      return {
        status: "no_availability",
        screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
        handoff_url: page.url(),
        error: "No available time slots found",
      };
    }

    await bestButton.click();
    await page.waitForLoadState("domcontentloaded");

    // ── Step 4: Pre-fill user info if provided ───────────────────────────────
    if (req.user_profile) {
      const { first_name, last_name, email, phone } = req.user_profile;
      await fillIfPresent(page, "[name='firstName'], [id*='first']", first_name);
      await fillIfPresent(page, "[name='lastName'], [id*='last']", last_name);
      await fillIfPresent(page, "[name='email'], [type='email']", email);
      await fillIfPresent(page, "[name='phone'], [type='tel']", phone);
    }

    // ── Step 5: Screenshot and return ────────────────────────────────────────
    await page.waitForTimeout(500); // let form settle
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    const handoffUrl = page.url();

    return {
      status: "ready",
      screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
      handoff_url: handoffUrl,
      selected_time: selectedTime,
    };
  } catch (err) {
    const screenshot = await page.screenshot({ type: "png" }).catch(() => null);
    return {
      status: "error",
      screenshot_base64: screenshot
        ? `data:image/png;base64,${screenshot.toString("base64")}`
        : undefined,
      handoff_url: fallbackUrl,
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
    // field not present on this page — skip silently
  }
}
