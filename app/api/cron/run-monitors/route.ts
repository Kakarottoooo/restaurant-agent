/**
 * GET /api/cron/run-monitors
 *
 * Vercel Cron — runs every 3 hours. Evaluates all active monitors whose
 * next_check_at is in the past. For triggered monitors, sends a push
 * notification to the session's subscribers.
 *
 * This is what makes Onegent "always on" — after a booking job completes,
 * the agent continues watching for:
 *   - New availability on failed restaurant/hotel/flight steps
 *   - Reservation cancellations or link expiry
 *   - Weather changes at the destination
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveMonitorsDue,
  updateMonitor,
  getPushSubscriptionsBySession,
} from "@/lib/db";
import { evaluateMonitor } from "@/lib/monitors";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const MONITOR_EMOJI: Record<string, string> = {
  availability_watch: "🔔",
  reservation_check:  "📋",
  weather_alert:      "⛅",
};

export async function GET(req: NextRequest) {
  // Validate cron secret
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monitors = await getActiveMonitorsDue();
  const now = new Date().toISOString();

  let checked = 0;
  let triggered = 0;
  const errors: string[] = [];

  for (const monitor of monitors) {
    try {
      const result = await evaluateMonitor(monitor, BASE_URL);
      checked++;

      if (result.triggered) {
        triggered++;

        // Update DB: triggered status + data
        await updateMonitor(monitor.id, {
          status: "triggered",
          last_checked_at: now,
          next_check_at: result.nextCheckAt,
          triggered_at: now,
          trigger_data: result.data ?? null,
          trigger_message: result.message ?? null,
        });

        // Send push notification
        try {
          const subscriptions = await getPushSubscriptionsBySession(monitor.session_id);
          const emoji = MONITOR_EMOJI[monitor.type] ?? "📡";
          const title = `${emoji} ${monitor.step_emoji} ${monitor.step_label}`;
          const body = result.message ?? "Agent detected a change in your booking.";

          await Promise.allSettled(
            subscriptions.map((sub) =>
              sendPushNotification(
                sub.push_subscription as PushSubscription,
                { title, body, url: "/tasks" }
              )
            )
          );
        } catch { /* push never blocks */ }
      } else {
        // Still watching — update last_checked and next_check
        await updateMonitor(monitor.id, {
          last_checked_at: now,
          next_check_at: result.nextCheckAt,
        });
      }
    } catch (err) {
      errors.push(`${monitor.id}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    triggered,
    errors: errors.length > 0 ? errors : undefined,
  });
}
