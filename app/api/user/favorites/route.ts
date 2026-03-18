import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { RecommendationCard } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT restaurant_id, card_json, saved_at
      FROM favorites
      WHERE user_id = ${userId}
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({
      favorites: result.rows.map((r) => ({
        restaurant_id: r.restaurant_id,
        card: r.card_json,
        saved_at: r.saved_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Bulk import from localStorage migration
  if (body.bulk) {
    const cards: RecommendationCard[] = body.bulk;
    try {
      for (const card of cards) {
        await sql`
          INSERT INTO favorites (user_id, restaurant_id, card_json)
          VALUES (${userId}, ${card.restaurant.id}, ${JSON.stringify(card)})
          ON CONFLICT (user_id, restaurant_id) DO NOTHING
        `;
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  }

  // Single card save
  const { card } = body as { card: RecommendationCard };
  if (!card?.restaurant?.id) {
    return NextResponse.json({ error: "Missing card" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO favorites (user_id, restaurant_id, card_json)
      VALUES (${userId}, ${card.restaurant.id}, ${JSON.stringify(card)})
      ON CONFLICT (user_id, restaurant_id) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { restaurant_id } = await req.json();
  if (!restaurant_id) {
    return NextResponse.json({ error: "Missing restaurant_id" }, { status: 400 });
  }

  try {
    await sql`
      DELETE FROM favorites WHERE user_id = ${userId} AND restaurant_id = ${restaurant_id}
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
