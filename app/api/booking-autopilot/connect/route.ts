/**
 * Booking autopilot connect endpoint.
 *
 * Opens a VISIBLE (headed) Playwright browser window on the local machine.
 * User logs in to the service normally.
 * After login is detected (or timeout), cookies are saved to disk.
 * Future autopilot runs inject those cookies → no login prompt.
 *
 * Only works when the server runs locally (dev mode).
 * The browser window opens on the same machine as the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import {
  SERVICE_META,
  saveCookies,
  SERVICES,
  type ServiceName,
} from "../../../../lib/booking-autopilot/cookie-store";

// Allow up to 3 minutes for the user to log in
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const service = body.service as ServiceName;

  if (!service || !SERVICES.includes(service)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  const meta = SERVICE_META[service];

  const browser = await chromium.launch({
    headless: false, // USER MUST SEE THIS WINDOW
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: null, // use the maximized window size
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  // Hide automation signals so login works normally
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    await page.goto(meta.loginUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Wait up to 2.5 minutes for the signed-in selector to appear
    // (user logs in manually in the opened window)
    await page.waitForSelector(meta.signedInSelector, { timeout: 150000 }).catch(() => {
      // Timeout is OK — save whatever cookies we have
      // User may have logged in but selector doesn't match exactly
    });

    // Extra wait to let session cookies settle after redirect
    await page.waitForTimeout(2000);

    const cookies = await context.cookies();
    saveCookies(service, cookies);

    return NextResponse.json({
      success: true,
      cookieCount: cookies.length,
      service,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const service = body.service as ServiceName;
  if (!service || !SERVICES.includes(service)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }
  const { clearCookies } = await import("../../../../lib/booking-autopilot/cookie-store");
  clearCookies(service);
  return NextResponse.json({ success: true });
}
