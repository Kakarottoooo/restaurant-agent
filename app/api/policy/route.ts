/**
 * GET /api/policy?session_id=...
 *
 * Returns computed PolicyBias for the given session (or global if no session_id).
 * Used by the execution engine at job-start time to seed decision ordering,
 * and by the UI to render "What the agent has learned".
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgentFeedbackEvents } from "@/lib/db";
import { computePolicyBias, buildPreferenceProfile } from "@/lib/policy";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? undefined;
  try {
    const events = await getAgentFeedbackEvents(sessionId, 500);
    const bias = computePolicyBias(events);
    const profile = buildPreferenceProfile(events);
    return NextResponse.json({ bias, profile });
  } catch (err) {
    console.error("policy GET error", err);
    return NextResponse.json({ error: "Failed to compute policy" }, { status: 500 });
  }
}
