"use client";

/**
 * Request push notification permission and register a Web Push subscription.
 * Stores the subscription server-side at /api/notifications/subscribe.
 *
 * Returns true on success, false if push isn't supported, keys aren't configured,
 * or the user denies permission.
 */
export async function subscribeToPushNotifications(
  sessionId: string,
  userId?: string | null
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  // Fetch the VAPID public key — 503 means push isn't configured on this deployment
  const keyRes = await fetch("/api/notifications/subscribe").catch(() => null);
  if (!keyRes?.ok) return false;
  const { vapidPublicKey } = await keyRes.json();
  if (!vapidPublicKey) return false;

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  // Get the active service worker registration
  const reg = await navigator.serviceWorker.ready;

  // Get existing or create new push subscription
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  // Store server-side
  const sub = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      subscription: sub,
      user_id: userId ?? undefined,
    }),
  });

  return true;
}

/** Convert a URL-safe base64 VAPID key to an ArrayBuffer for the push manager. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer;
}
