"use client";

import { useEffect } from "react";

const ONEGENT_CACHE_PREFIX = "onegent-";

function isOnegentRegistration(registration: ServiceWorkerRegistration) {
  return registration.active?.scriptURL.includes("/sw.js") ?? false;
}

async function clearOnegentCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const cacheKeys = await window.caches.keys();
  await Promise.all(
    cacheKeys
      .filter((key) => key.startsWith(ONEGENT_CACHE_PREFIX))
      .map((key) => window.caches.delete(key))
  );
}

export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter(isOnegentRegistration)
              .map((registration) => registration.unregister())
          )
        )
        .catch(() => {});

      clearOnegentCaches().catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
