import { NextRequest, NextResponse } from "next/server";
import { getDecisionSession, updateDecisionSession } from "@/lib/db";
import { runAgentForTwoParty } from "@/lib/agent/two-party";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getDecisionSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }
  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await updateDecisionSession(id, { status: "expired" });
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }
  return NextResponse.json({ session });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as {
    action: "submit_partner_constraints" | "vote" | "feedback";
    partnerConstraints?: string;
    role?: "initiator" | "partner";
    cardId?: string;
    approved?: boolean;
    feedback?: "loved" | "fine" | "never";
    feedbackRole?: "initiator" | "partner";
  };

  const session = await getDecisionSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  // ── Action: partner submits their constraints ──────────────────────────────
  if (body.action === "submit_partner_constraints") {
    if (session.status !== "waiting_partner") {
      return NextResponse.json(
        { error: "Voting already started — constraints are locked" },
        { status: 409 }
      );
    }
    if (!body.partnerConstraints?.trim()) {
      return NextResponse.json({ error: "partnerConstraints is required" }, { status: 400 });
    }

    // Run the two-party agent to get merged options
    const mergeResult = await runAgentForTwoParty(
      session.initiator_constraints,
      body.partnerConstraints.trim(),
      session.city_id
    );

    if (mergeResult.conflict) {
      await updateDecisionSession(id, {
        partner_constraints: body.partnerConstraints.trim(),
        conflict: true,
        conflict_reason: mergeResult.conflictReason ?? "Constraints are mutually exclusive",
        merged_options: mergeResult.options,
        status: "conflict",
      });
    } else {
      await updateDecisionSession(id, {
        partner_constraints: body.partnerConstraints.trim(),
        merged_options: mergeResult.options,
        status: "voting",
      });
    }

    const updated = await getDecisionSession(id);
    return NextResponse.json({ session: updated });
  }

  // ── Action: vote on a card ─────────────────────────────────────────────────
  if (body.action === "vote") {
    if (!body.cardId || body.approved === undefined || !body.role) {
      return NextResponse.json({ error: "cardId, approved, and role are required" }, { status: 400 });
    }
    if (session.status !== "voting" && session.status !== "conflict") {
      return NextResponse.json({ error: "Session is not in voting state" }, { status: 409 });
    }

    const voteField = body.role === "initiator" ? "initiator_vote" : "partner_vote";
    const existingVotes: { card_id: string; approved: boolean }[] =
      (session[voteField] as { card_id: string; approved: boolean }[]) ?? [];

    // Idempotent: overwrite existing vote for this card
    const filtered = existingVotes.filter((v) => v.card_id !== body.cardId);
    const newVotes = [...filtered, { card_id: body.cardId, approved: body.approved }];

    await updateDecisionSession(id, { [voteField]: newVotes });

    // Check for mutual approval
    const otherVoteField = body.role === "initiator" ? "partner_vote" : "initiator_vote";
    const otherVotes: { card_id: string; approved: boolean }[] =
      (session[otherVoteField] as { card_id: string; approved: boolean }[]) ?? [];

    const decidedCard = newVotes.find(
      (v) => v.approved && otherVotes.some((ov) => ov.card_id === v.card_id && ov.approved)
    );

    if (decidedCard) {
      await updateDecisionSession(id, {
        status: "decided",
        decided_card_id: decidedCard.card_id,
      });
    }

    const updated = await getDecisionSession(id);
    return NextResponse.json({ session: updated });
  }

  // ── Action: submit post-decision feedback ──────────────────────────────────
  if (body.action === "feedback") {
    if (!body.feedback || !body.feedbackRole) {
      return NextResponse.json({ error: "feedback and feedbackRole are required" }, { status: 400 });
    }
    const field = body.feedbackRole === "initiator" ? "feedback_initiator" : "feedback_partner";
    await updateDecisionSession(id, { [field]: body.feedback });
    const updated = await getDecisionSession(id);
    return NextResponse.json({ session: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
