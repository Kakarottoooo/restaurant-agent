import { NextRequest, NextResponse } from "next/server";
import { ensureDecisionPlansTable, ensureFeedbackPromptsTable, sql } from "@/lib/db";

/**
 * GET /api/cron/feedback-prompts
 *
 * Called by Vercel Cron daily (see vercel.json).
 * Finds decision_plans whose event_datetime was 20-28h ago (no timezone)
 * and inserts a feedback_prompts row for each one that doesn't already have one.
 *
 * curl https://your-domain.com/api/cron/feedback-prompts \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[feedback-prompts] Starting run", new Date().toISOString());

  await ensureDecisionPlansTable();
  await ensureFeedbackPromptsTable();

  // Find plans whose event_datetime (stored as ISO string in plan_json, no TZ)
  // falls within the 20-28h window behind now.
  // We cast the text field to TIMESTAMP and compare against NOW() UTC offsets.
  const plansResult = await sql<{
    id: string;
    session_id: string;
    plan_json: { primary_plan?: { title?: string }; event_datetime?: string };
  }>`
    SELECT id, session_id, plan_json
    FROM decision_plans
    WHERE
      plan_json->>'event_datetime' IS NOT NULL
      AND (plan_json->>'event_datetime')::TIMESTAMP
            BETWEEN NOW() AT TIME ZONE 'UTC' - INTERVAL '28 hours'
                AND NOW() AT TIME ZONE 'UTC' - INTERVAL '20 hours'
  `;

  let created = 0;
  let skipped = 0;

  for (const plan of plansResult.rows) {
    // Check if a prompt already exists for this plan
    const existing = await sql`
      SELECT id FROM feedback_prompts
      WHERE plan_id = ${plan.id}
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const scheduledFor = new Date().toISOString();

    await sql`
      INSERT INTO feedback_prompts (plan_id, user_session, scheduled_for, sent_at)
      VALUES (${plan.id}, ${plan.session_id}, ${scheduledFor}, ${scheduledFor})
    `;

    created++;
  }

  console.log("[feedback-prompts] Done", { created, skipped });

  return NextResponse.json({ ok: true, created, skipped });
}
