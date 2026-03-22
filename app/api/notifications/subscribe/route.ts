import { NextRequest, NextResponse } from "next/server";
import { upsertPushSubscription } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";

/**
 * POST /api/notifications/subscribe
 * Stores a Web Push subscription tied to the user's session (and optionally user_id).
 * Called from the browser after navigator.serviceWorker.pushManager.subscribe().
 *
 * GET /api/notifications/subscribe
 * Returns the VAPID public key so the client can subscribe.
 */

export async function GET() {
  if (!vapidPublicKey) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  return NextResponse.json({ vapidPublicKey });
}

export async function POST(req: NextRequest) {
  if (!vapidPublicKey) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const subscription = body?.subscription;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  const userId = typeof body?.user_id === "string" ? body.user_id : undefined;

  if (!sessionId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  await upsertPushSubscription(sessionId, subscription, userId);
  return NextResponse.json({ ok: true });
}
