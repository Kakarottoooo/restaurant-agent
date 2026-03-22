import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mergeSessionPreferences } from "@/lib/db";

/**
 * POST /api/user/preferences/merge
 * Merges session-keyed preferences into the signed-in user's account.
 * Called by ClerkSync on sign-in (idempotent — safe to call multiple times).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  await mergeSessionPreferences(sessionId, userId);
  return NextResponse.json({ ok: true });
}
