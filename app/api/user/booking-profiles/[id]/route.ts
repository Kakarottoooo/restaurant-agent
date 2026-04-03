import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { updateBookingProfile, deleteBookingProfile } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/user/booking-profiles/[id] — update profile */
export async function PUT(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const profile = await updateBookingProfile(parseInt(id), userId, data);
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("PUT booking-profiles/[id]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

/** DELETE /api/user/booking-profiles/[id] — delete profile */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const deleted = await deleteBookingProfile(parseInt(id), userId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE booking-profiles/[id]:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
