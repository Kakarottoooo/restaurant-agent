/**
 * GET  /api/relationships?session_id=... — get relationship profile for session
 * POST /api/relationships               — create a new relationship profile
 */
import { NextRequest, NextResponse } from "next/server";
import { getRelationshipBySession, createRelationshipProfile } from "@/lib/db";
import type { RelationshipProfile } from "@/lib/memory";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const profile = await getRelationshipBySession(sessionId);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("relationships GET error", err);
    return NextResponse.json({ error: "Failed to load relationship" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<RelationshipProfile, "created_at" | "updated_at">;
    if (!body.id || !body.name || !body.session_ids?.length) {
      return NextResponse.json({ error: "id, name, session_ids required" }, { status: 400 });
    }
    const profile = await createRelationshipProfile(body);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("relationships POST error", err);
    return NextResponse.json({ error: "Failed to create relationship" }, { status: 500 });
  }
}
