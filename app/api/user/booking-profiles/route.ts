import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  listBookingProfiles,
  createBookingProfile,
  getDefaultBookingProfile,
  getBookingProfileById,
} from "@/lib/db";

/** GET /api/user/booking-profiles
 * Query params:
 *   ?default=true  → return single default profile (with decrypted card)
 *   ?id=123&card=true → return single profile with decrypted card number
 *   (none)         → list all profiles (card numbers masked)
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const idParam = sp.get("id");
  const wantDefault = sp.get("default") === "true";
  const includeCard = sp.get("card") === "true";

  try {
    if (idParam) {
      const profile = await getBookingProfileById(parseInt(idParam), userId, includeCard);
      if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ profile });
    }
    if (wantDefault) {
      const profile = await getDefaultBookingProfile(userId, true);
      return NextResponse.json({ profile });
    }
    const profiles = await listBookingProfiles(userId);
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("GET booking-profiles:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

/** POST /api/user/booking-profiles — create a new profile */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const profile = await createBookingProfile(userId, data);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error("POST booking-profiles:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
