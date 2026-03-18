import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT profile_json FROM preference_profiles WHERE user_id = ${userId}
    `;
    if (result.rows.length === 0) {
      return NextResponse.json({ profile: null });
    }
    return NextResponse.json({ profile: result.rows[0].profile_json });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { profile } = await req.json();
  if (!profile) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO preference_profiles (user_id, profile_json, updated_at)
      VALUES (${userId}, ${JSON.stringify(profile)}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET profile_json = ${JSON.stringify(profile)}, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
