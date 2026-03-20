/**
 * Server-side subscription matching.
 * Reads pending_devices.json and finds products that satisfy
 * each provided WatchSubscription.
 */

import fs from "fs";
import path from "path";
import {
  WatchSubscription,
  DetectedProduct,
  PendingProductsFile,
  SubscriptionMatch,
} from "./watchTypes";

const PENDING_PATH = path.join(process.cwd(), "data", "pending_devices.json");

export function readPendingProducts(): PendingProductsFile {
  try {
    return JSON.parse(fs.readFileSync(PENDING_PATH, "utf-8")) as PendingProductsFile;
  } catch {
    return { last_checked: "", pending: [] };
  }
}

/**
 * Returns only products detected after `since` (ISO string).
 * Pass the client's last-check timestamp to avoid re-surfacing old notifications.
 */
function productMatchesSubscription(
  product: DetectedProduct,
  sub: WatchSubscription
): boolean {
  if (product.watch_category !== sub.watch_category) return false;
  if (product.status === "dismissed") return false;

  // Brand filter: if the subscription specifies brands, the product must match one
  if (sub.brands.length > 0) {
    const productBrandLower = product.brand.toLowerCase();
    const matches = sub.brands.some((b) => productBrandLower.includes(b.toLowerCase()));
    if (!matches) return false;
  }

  // Keyword filter: if keywords are set, at least one must appear in the product name
  if (sub.keywords.length > 0) {
    const nameLower = product.name.toLowerCase();
    const matches = sub.keywords.some((kw) => nameLower.includes(kw.toLowerCase()));
    if (!matches) return false;
  }

  return true;
}

export function matchSubscriptions(
  subscriptions: WatchSubscription[],
  seenProductIds: string[]
): SubscriptionMatch[] {
  if (subscriptions.length === 0) return [];

  const { pending } = readPendingProducts();
  const seenSet = new Set(seenProductIds);

  // Only surface products the client hasn't been shown yet
  const unseen = pending.filter((p) => !seenSet.has(p.id));
  if (unseen.length === 0) return [];

  const matches: SubscriptionMatch[] = [];

  for (const sub of subscriptions) {
    const matched = unseen.filter((p) => productMatchesSubscription(p, sub));
    if (matched.length > 0) {
      matches.push({ subscription: sub, products: matched });
    }
  }

  return matches;
}
