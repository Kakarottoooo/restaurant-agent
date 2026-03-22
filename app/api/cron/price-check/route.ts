import { NextRequest, NextResponse } from "next/server";
import { ensurePriceWatchesTable, ensurePlanOutcomesTable, getPushSubscriptionsBySession, sql } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";

interface PriceWatch {
  id: number;
  plan_id: string;
  session_id: string;
  item_type: string;
  item_key: string;
  item_label: string;
  last_known_price: string;
  threshold_pct: string;
  search_params: Record<string, string> | null;
}

/**
 * GET /api/cron/price-check
 * Cron-only route (requires CRON_SECRET header).
 * For each active price_watch, re-queries SerpAPI and records a price_drop_alert
 * in plan_outcomes if the price dropped beyond threshold_pct.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.SERPAPI_KEY;

  await ensurePriceWatchesTable();
  await ensurePlanOutcomesTable();

  // Only check watches that haven't been checked in the last 20 hours
  const watchesResult = await sql<PriceWatch>`
    SELECT id, plan_id, session_id, item_type, item_key, item_label, last_known_price, threshold_pct, search_params
    FROM price_watches
    WHERE last_checked_at IS NULL
       OR last_checked_at < NOW() AT TIME ZONE 'UTC' - INTERVAL '20 hours'
    ORDER BY last_checked_at ASC NULLS FIRST
    LIMIT 50
  `;

  const watches = watchesResult.rows;
  let checked = 0;
  let drops = 0;
  let skipped = 0;

  for (const watch of watches) {
    // Mark checked regardless of outcome
    await sql`
      UPDATE price_watches SET last_checked_at = NOW() WHERE id = ${watch.id}
    `;
    checked++;

    if (!apiKey || !watch.search_params) {
      skipped++;
      continue;
    }

    try {
      const currentPrice = await fetchCurrentPrice(
        watch.item_type as "hotel" | "flight",
        watch.search_params,
        apiKey
      );

      if (currentPrice === null) {
        skipped++;
        continue;
      }

      const lastPrice = parseFloat(watch.last_known_price);
      const threshold = parseFloat(watch.threshold_pct) / 100;
      const dropPct = (lastPrice - currentPrice) / lastPrice;

      if (dropPct >= threshold) {
        // Record the price drop alert
        await sql`
          INSERT INTO plan_outcomes (plan_id, session_id, outcome_type, metadata)
          VALUES (
            ${watch.plan_id},
            ${watch.session_id},
            'price_drop_alert',
            ${JSON.stringify({
              item_type: watch.item_type,
              item_key: watch.item_key,
              item_label: watch.item_label,
              previous_price: lastPrice,
              current_price: currentPrice,
              drop_pct: Math.round(dropPct * 100),
            })}
          )
        `;
        // Update the stored price
        await sql`
          UPDATE price_watches SET last_known_price = ${currentPrice} WHERE id = ${watch.id}
        `;
        drops++;

        // Send push notification to subscribed users for this session
        const subs = await getPushSubscriptionsBySession(watch.session_id).catch(() => []);
        const dropPercent = Math.round(dropPct * 100);
        for (const sub of subs) {
          sendPushNotification(sub.push_subscription as PushSubscription, {
            title: `Price drop: ${watch.item_label}`,
            body: `Down ${dropPercent}% — now $${currentPrice} (was $${lastPrice})`,
            url: `/plan/${watch.plan_id}`,
          }).catch(() => {}); // fire-and-forget; expired subscriptions silently ignored
        }
      } else if (currentPrice < lastPrice) {
        // Smaller drop — just update the stored price silently
        await sql`
          UPDATE price_watches SET last_known_price = ${currentPrice} WHERE id = ${watch.id}
        `;
      }
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, checked, drops, skipped });
}

async function fetchCurrentPrice(
  itemType: "hotel" | "flight",
  searchParams: Record<string, string>,
  apiKey: string
): Promise<number | null> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("currency", "USD");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  if (itemType === "hotel") {
    url.searchParams.set("engine", "google_hotels");
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = await res.json();
    const hotels: Array<{ name: string; rate_per_night?: { lowest?: string } }> =
      data.properties ?? [];
    const target = searchParams.q ?? "";
    const match = hotels.find((h) => h.name && target && h.name.toLowerCase().includes(target.toLowerCase()));
    const best = match ?? hotels[0];
    if (!best) return null;
    const raw = best.rate_per_night?.lowest ?? "";
    const price = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return isNaN(price) ? null : price;
  } else {
    // flight
    url.searchParams.set("engine", "google_flights");
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = await res.json();
    const allFlights: Array<{ price?: number }> = [
      ...((data.best_flights as Array<{ price?: number }>) ?? []),
      ...((data.other_flights as Array<{ price?: number }>) ?? []),
    ];
    const prices = allFlights.map((f) => f.price ?? 0).filter((p) => p > 0);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }
}
