"use client";

import { useEffect } from "react";

const FOLIO_CACHE_PREFIX = "folio-";

function isFolioRegistration(registration: ServiceWorkerRegistration) {
  return registration.active?.scriptURL.includes("/sw.js") ?? false;
}

async function clearFolioCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const cacheKeys = await window.caches.keys();
  await Promise.all(
    cacheKeys
      .filter((key) => key.startsWith(FOLIO_CACHE_PREFIX))
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
              .filter(isFolioRegistration)
              .map((registration) => registration.unregister())
          )
        )
        .catch(() => {});

      clearFolioCaches().catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
