import { NextRequest, NextResponse } from "next/server";
import { matchSubscriptions } from "@/lib/subscriptions";
import { WatchSubscription } from "@/lib/watchTypes";

/**
 * POST /api/subscriptions/check
 *
 * Stateless: client sends its current subscriptions + the IDs it has already
 * seen. Server reads pending_devices.json and returns new matches only.
 *
 * Body: {
 *   subscriptions: WatchSubscription[];
 *   seen_product_ids: string[];   // product IDs already shown to this client
 * }
 *
 * Response: {
 *   matches: SubscriptionMatch[];
 * }
 */
export async function POST(req: NextRequest) {
  let body: { subscriptions?: WatchSubscription[]; seen_product_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscriptions: WatchSubscription[] = body.subscriptions ?? [];
  const seenProductIds: string[] = body.seen_product_ids ?? [];

  const matches = matchSubscriptions(subscriptions, seenProductIds);

  return NextResponse.json({ matches });
}
