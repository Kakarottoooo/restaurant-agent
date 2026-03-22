import { NextRequest, NextResponse } from "next/server";
import { ensureFeedbackPromptsTable, ensurePlanOutcomesTable, sql } from "@/lib/db";
import type { PostExperienceFeedback } from "@/lib/types";

export interface FeedbackPromptItem {
  id: number;
  plan_id: string;
  user_session: string;
  scheduled_for: string;
  venue_name: string;
  scenario: string;
}

/**
 * GET /api/feedback-prompts?session_id=...
 * Returns pending (unresponded) feedback prompts for the given session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  await ensureFeedbackPromptsTable();

  const result = await sql<{
    id: number;
    plan_id: string;
    user_session: string;
    scheduled_for: string;
    plan_json: {
      primary_plan?: { title?: string };
      scenario?: string;
    };
  }>`
    SELECT
      fp.id,
      fp.plan_id,
      fp.user_session,
      fp.scheduled_for,
      dp.plan_json
    FROM feedback_prompts fp
    JOIN decision_plans dp ON fp.plan_id = dp.id
    WHERE fp.user_session = ${session_id}
      AND fp.responded_at IS NULL
    ORDER BY fp.scheduled_for DESC
    LIMIT 3
  `;

  const prompts: FeedbackPromptItem[] = result.rows.map((row) => ({
    id: row.id,
    plan_id: row.plan_id,
    user_session: row.user_session,
    scheduled_for: row.scheduled_for,
    venue_name: row.plan_json?.primary_plan?.title ?? "your plan",
    scenario: row.plan_json?.scenario ?? "date_night",
  }));

  return NextResponse.json({ prompts });
}

/**
 * POST /api/feedback-prompts
 * Records a feedback response, marks the prompt as responded,
 * and writes a plan_outcome row.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt_id: number | null = body.prompt_id ?? null;
    const plan_id: string | null = body.plan_id ?? null;
    const session_id: string | null = body.session_id ?? null;
    const feedback: PostExperienceFeedback | null = body.feedback ?? null;

    if (!prompt_id || !plan_id || !session_id || !feedback) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validRatings = new Set(["great", "ok", "did_not_go"]);
    if (!validRatings.has(feedback.rating)) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    await ensureFeedbackPromptsTable();
    await ensurePlanOutcomesTable();

    const now = new Date().toISOString();

    // Mark the prompt as responded
    await sql`
      UPDATE feedback_prompts
      SET responded_at = ${now}, response_json = ${JSON.stringify(feedback)}
      WHERE id = ${prompt_id}
        AND user_session = ${session_id}
    `;

    // Record in plan_outcomes for the learning loop
    await sql`
      INSERT INTO plan_outcomes (plan_id, session_id, outcome_type, metadata)
      VALUES (
        ${plan_id},
        ${session_id},
        'post_experience_feedback',
        ${JSON.stringify(feedback)}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
