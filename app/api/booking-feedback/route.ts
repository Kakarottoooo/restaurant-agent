import { NextRequest, NextResponse } from "next/server";
import { logAgentFeedback, getAgentFeedbackStats } from "@/lib/db";
import type { AgentFeedbackEvent } from "@/lib/db";
import { randomUUID } from "crypto";

/** POST /api/booking-feedback — log one feedback event */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.job_id || !body?.outcome) {
    return NextResponse.json({ error: "job_id and outcome required" }, { status: 400 });
  }

  const event: AgentFeedbackEvent = {
    id: randomUUID(),
    session_id: body.session_id ?? "anon",
    job_id: body.job_id,
    step_index: body.step_index ?? -1,
    step_type: body.step_type ?? "job",
    agent_decision: body.agent_decision ?? "n/a",
    venue_name: body.venue_name ?? null,
    provider: body.provider ?? null,
    outcome: body.outcome,
    metadata: body.metadata ?? undefined,
  };

  await logAgentFeedback(event);
  return NextResponse.json({ ok: true });
}

/** GET /api/booking-feedback?session_id=xxx — aggregate stats */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? undefined;
  const stats = await getAgentFeedbackStats(sessionId);
  return NextResponse.json({ stats });
}
