"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WatchSubscription,
  SubscriptionMatch,
  WATCH_CATEGORY_META,
} from "@/lib/watchTypes";
import { SubscriptionIntent } from "@/lib/types";

const SUBS_KEY = "folio_subscriptions";
const SEEN_KEY = "folio_seen_product_ids";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode
  }
}

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<WatchSubscription[]>([]);
  const [newMatches, setNewMatches] = useState<SubscriptionMatch[]>([]);
  const [checked, setChecked] = useState(false);

  // Load subscriptions from localStorage on mount
  useEffect(() => {
    setSubscriptions(loadFromStorage<WatchSubscription[]>(SUBS_KEY, []));
  }, []);

  // Check for new matches once per page load
  useEffect(() => {
    if (checked) return;
    setChecked(true);

    const subs = loadFromStorage<WatchSubscription[]>(SUBS_KEY, []);
    if (subs.length === 0) return;

    const seenIds = loadFromStorage<string[]>(SEEN_KEY, []);

    fetch("/api/subscriptions/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptions: subs, seen_product_ids: seenIds }),
    })
      .then((r) => r.json())
      .then((data: { matches?: SubscriptionMatch[] }) => {
        const matches: SubscriptionMatch[] = data.matches ?? [];
        if (matches.length === 0) return;

        setNewMatches(matches);

        // Mark all matched products as seen so they don't re-notify
        const newSeenIds = matches.flatMap((m) => m.products.map((p) => p.id));
        saveToStorage(SEEN_KEY, [...seenIds, ...newSeenIds]);
      })
      .catch(() => {
        // silent — notification is best-effort
      });
  }, [checked]);

  const addSubscription = useCallback((intent: SubscriptionIntent): WatchSubscription | null => {
    if (!intent.watch_category) return null;

    const meta = WATCH_CATEGORY_META[intent.watch_category];
    const sub: WatchSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      watch_category: intent.watch_category,
      brands: intent.brands,
      keywords: intent.keywords,
      label: intent.label || `${intent.brands.join(", ") || "All brands"} ${meta.label} releases`,
    };

    setSubscriptions((prev) => {
      const updated = [...prev, sub];
      saveToStorage(SUBS_KEY, updated);
      return updated;
    });

    return sub;
  }, []);

  const removeSubscription = useCallback((intent: SubscriptionIntent) => {
    setSubscriptions((prev) => {
      const updated = prev.filter((s) => {
        if (intent.watch_category && s.watch_category !== intent.watch_category) return true;
        if (intent.brands.length > 0) {
          const hasMatchingBrand = intent.brands.some((b) =>
            s.brands.some((sb) => sb.toLowerCase() === b.toLowerCase())
          );
          if (hasMatchingBrand) return false;
        }
        // If no brands specified, remove all in this category
        return intent.brands.length > 0;
      });
      saveToStorage(SUBS_KEY, updated);
      return updated;
    });
  }, []);

  const clearNewMatches = useCallback(() => setNewMatches([]), []);

  return {
    subscriptions,
    newMatches,
    addSubscription,
    removeSubscription,
    clearNewMatches,
  };
}
