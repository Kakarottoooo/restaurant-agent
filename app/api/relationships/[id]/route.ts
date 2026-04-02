/**
 * PATCH /api/relationships/[id] — update name, type, constraints, avoid_types, notes
 */
import { NextRequest, NextResponse } from "next/server";
import { updateRelationshipProfile } from "@/lib/db";
import type { RelationshipProfile } from "@/lib/memory";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const patch = await req.json() as Partial<RelationshipProfile>;
    await updateRelationshipProfile(id, patch);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("relationship PATCH error", err);
    return NextResponse.json({ error: "Failed to update relationship" }, { status: 500 });
  }
}
