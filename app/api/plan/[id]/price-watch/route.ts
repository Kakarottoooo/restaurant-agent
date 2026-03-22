import { NextRequest, NextResponse } from "next/server";
import { ensurePriceWatchesTable, sql } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface PriceWatchItem {
  item_type: "hotel" | "flight";
  item_key: string;
  item_label: string;
  last_known_price: number;
  search_params?: Record<string, string>;
}

/**
 * POST /api/plan/[id]/price-watch
 * Register one or more items to monitor for price drops.
 * Body: { session_id: string; items: PriceWatchItem[] }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: planId } = await params;

  let body: { session_id?: string; items?: PriceWatchItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, items } = body;
  if (!session_id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "session_id and items[] are required" }, { status: 400 });
  }

  const validTypes = new Set(["hotel", "flight"]);
  for (const item of items) {
    if (!validTypes.has(item.item_type) || !item.item_key || typeof item.last_known_price !== "number" || item.last_known_price <= 0) {
      return NextResponse.json({ error: `Invalid item: ${JSON.stringify(item)}` }, { status: 400 });
    }
  }

  try {
    await ensurePriceWatchesTable();
    let created = 0;
    for (const item of items) {
      // Skip if already watching this item for this plan
      const existing = await sql`
        SELECT id FROM price_watches WHERE plan_id = ${planId} AND item_key = ${item.item_key} LIMIT 1
      `;
      if (existing.rows.length > 0) continue;

      await sql`
        INSERT INTO price_watches (plan_id, session_id, item_type, item_key, item_label, last_known_price, search_params)
        VALUES (
          ${planId},
          ${session_id},
          ${item.item_type},
          ${item.item_key},
          ${item.item_label},
          ${item.last_known_price},
          ${item.search_params ? JSON.stringify(item.search_params) : null}
        )
      `;
      created++;
    }
    return NextResponse.json({ ok: true, created, skipped: items.length - created });
  } catch {
    return NextResponse.json({ error: "Failed to register price watches" }, { status: 500 });
  }
}

/**
 * GET /api/plan/[id]/price-watch
 * Returns active price watches for this plan (for the ActionRail "watching" state).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: planId } = await params;
  try {
    await ensurePriceWatchesTable();
    const result = await sql<{
      id: number;
      item_type: string;
      item_label: string;
      last_known_price: string;
      last_checked_at: string | null;
    }>`
      SELECT id, item_type, item_label, last_known_price, last_checked_at
      FROM price_watches
      WHERE plan_id = ${planId}
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ watches: result.rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch watches" }, { status: 500 });
  }
}
