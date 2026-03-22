import webpush, { PushSubscription } from "web-push";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:hello@onegent.one";

// Only configure web-push when real VAPID keys are set
const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC!, VAPID_PRIVATE!);
}

export const vapidPublicKey = VAPID_PUBLIC ?? null;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a Web Push notification to a stored subscription.
 * Silently no-ops when VAPID keys are not configured.
 * Returns true on success, false on failure (subscription gone / key mismatch).
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!pushEnabled) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    // 410 Gone = subscription expired; 404 = endpoint gone — caller should delete it
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 410 || status === 404) return false;
    throw err;
  }
}
