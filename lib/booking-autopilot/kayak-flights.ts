/**
 * Kayak flight autopilot.
 *
 * Navigates Kayak search results, selects the best flight per the user's
 * preferences (cheapest non-stop by default; respects cabin class), and
 * returns a screenshot + the URL at the flight detail/booking step.
 *
 * Default selection logic (matches "what a normal person would pick"):
 *   1. Non-stop flights only (if any exist)
 *   2. Cheapest price among those
 *   3. If no non-stop, cheapest with fewest stops
 *
 * Override via preferredAirline (e.g. "Delta") or cabinClass.
 */
import { chromium } from "playwright";
import type { AutopilotResult } from "./types";
import { buildKayakFlightsUrl } from "../agent/planners/booking-links";
import { injectCookies } from "./cookie-store";

export interface FlightAutopilotRequest {
  origin: string;       // IATA code, e.g. "BNA"
  dest: string;         // IATA code, e.g. "LAX"
  date: string;         // YYYY-MM-DD
  returnDate?: string;  // YYYY-MM-DD — omit for one-way
  passengers?: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  preferNonstop?: boolean;       // default true
  preferredAirline?: string;     // e.g. "Delta" — match is loose (includes)
}

export async function runKayakFlightAutopilot(
  req: FlightAutopilotRequest
): Promise<AutopilotResult> {
  const kayakUrl = buildKayakFlightsUrl({
    origin: req.origin,
    dest: req.dest,
    date: req.date,
    returnDate: req.returnDate,
    passengers: req.passengers ?? 1,
    cabinClass: req.cabinClass ?? "economy",
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });
  // Inject saved cookies — Kayak + Expedia so OTA redirect lands logged in
  await injectCookies(context, ["kayak", "expedia"]);
  const page = await context.newPage();

  try {
    // ── Step 1: Load Kayak search results ────────────────────────────────────
    await page.goto(kayakUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Kayak is a heavy SPA — wait for results to appear
    // The results list has [data-resultid] or role="listitem" elements
    await page.waitForSelector(
      "[data-resultid], [class*='resultInner'], [class*='FlightResultItem']",
      { timeout: 20000 }
    ).catch(() => {}); // don't throw — screenshot even if no results

    await page.waitForTimeout(2000); // let lazy-loaded prices settle

    // Dismiss any cookie / notification overlays
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // ── Step 2: Sort by cheapest (if not already) ─────────────────────────────
    // Kayak's "Cheapest" sort tab / button
    const cheapestBtn = page.locator(
      "button:has-text('Cheapest'), [data-content='cheapest'], a:has-text('Cheapest')"
    ).first();
    const cheapestVisible = await cheapestBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (cheapestVisible) {
      await cheapestBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    // ── Step 3: Apply non-stop filter if preferred ────────────────────────────
    const wantNonstop = req.preferNonstop !== false; // default true
    if (wantNonstop) {
      // Kayak's nonstop filter label varies: "Nonstop", "Non-stop", "Direct"
      const nonstopFilter = page.locator(
        "label:has-text('Nonstop'), label:has-text('Non-stop'), label:has-text('Direct only'), button:has-text('Nonstop')"
      ).first();
      const filterVisible = await nonstopFilter.isVisible({ timeout: 2000 }).catch(() => false);
      if (filterVisible) {
        await nonstopFilter.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    // ── Step 4: Find the best result row ─────────────────────────────────────
    // Result rows: [data-resultid] elements on Kayak
    const resultRows = await page.locator("[data-resultid]").all();

    let bestRow = null;
    let bestPrice = Infinity;

    for (const row of resultRows.slice(0, 10)) {
      // Skip sponsored / ad results
      const isAd = await row.locator("[class*='sponsored'], [class*='Sponsored']").count();
      if (isAd > 0) continue;

      // Parse price
      const priceText = await row.locator("[class*='price'], [class*='Price']").first().textContent().catch(() => "");
      const price = parseFloat((priceText ?? "").replace(/[^0-9.]/g, ""));

      // Filter by airline preference
      if (req.preferredAirline) {
        const airlineText = await row.textContent().catch(() => "");
        if (!airlineText?.toLowerCase().includes(req.preferredAirline.toLowerCase())) continue;
      }

      if (!isNaN(price) && price < bestPrice) {
        bestPrice = price;
        bestRow = row;
      }
    }

    // Fall back to first visible row if price parsing failed
    if (!bestRow && resultRows.length > 0) {
      bestRow = resultRows[0];
    }

    if (!bestRow) {
      const screenshot = await page.screenshot({ type: "png" });
      return {
        status: "no_availability",
        screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
        handoff_url: kayakUrl,
        error: "No flight results found on Kayak",
      };
    }

    // ── Step 5: Expand the best row to reveal booking links ──────────────────
    // Kayak "Select" expands an in-page panel — it does NOT navigate.
    // After the panel opens, the actual booking links appear inside the row.
    await bestRow.click({ force: true, timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500); // let the expansion panel render

    // ── Step 6: Extract the booking link from the expanded panel ──────────────
    // After expansion Kayak shows "Book with [airline/OTA]" anchors.
    // These are usually <a href="/book/flight?..."> or full OTA URLs.
    let bookingUrl: string | null = null;

    // Try within the expanded row first (most targeted)
    const rowHrefs = await bestRow.locator(
      "a[href*='/book/flight'], a[href*='kayak.com/book'], a[href*='/booking/'], a[href*='expedia'], a[href*='priceline'], a[href*='southwest.com'], a[href*='united.com'], a[href*='delta.com'], a[href*='aa.com'], a[href*='spirit.com'], a[href*='frontier.com']"
    ).all();
    for (const a of rowHrefs) {
      const href = await a.getAttribute("href").catch(() => null);
      if (href) { bookingUrl = href; break; }
    }

    // Fallback: any /book/flight link anywhere on the page (appeared after click)
    if (!bookingUrl) {
      const anyBookLinks = await page.locator("a[href*='/book/flight'], a[href*='kayak.com/book']").all();
      for (const a of anyBookLinks) {
        const href = await a.getAttribute("href").catch(() => null);
        if (href) { bookingUrl = href; break; }
      }
    }

    if (bookingUrl) {
      const fullUrl = bookingUrl.startsWith("http")
        ? bookingUrl
        : `https://www.kayak.com${bookingUrl}`;
      await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1500);
    }
    // If no booking link found, we stay on the results page — the screenshot will
    // show the expanded panel, which still lets the user confirm and proceed.

    // ── Step 7: Screenshot + return ──────────────────────────────────────────
    const screenshot = await page.screenshot({ type: "png", fullPage: false });

    return {
      status: "ready",
      screenshot_base64: `data:image/png;base64,${screenshot.toString("base64")}`,
      handoff_url: page.url(),
      selected_time: bestPrice !== Infinity ? `$${Math.round(bestPrice)}` : undefined,
    };
  } catch (err) {
    const screenshot = await page.screenshot({ type: "png" }).catch(() => null);
    return {
      status: "error",
      screenshot_base64: screenshot
        ? `data:image/png;base64,${screenshot.toString("base64")}`
        : undefined,
      handoff_url: kayakUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await browser.close();
  }
}
