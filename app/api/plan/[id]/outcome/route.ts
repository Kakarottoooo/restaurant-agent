import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensurePlanOutcomesTable, sql } from "@/lib/db";
import { PlanOutcomeType } from "@/lib/types";

const VALID_OUTCOME_TYPES = new Set<PlanOutcomeType>([
  "went",
  "skipped",
  "rated_positive",
  "rated_negative",
  "partner_approved",
  "post_experience_feedback",
  "price_drop_alert",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plan_id } = await params;

    // Also accept outcome_type from query string (for calendar deep links)
    const { searchParams } = new URL(req.url);
    const body = req.headers.get("content-type")?.includes("application/json")
      ? await req.json().catch(() => ({}))
      : {};

    const outcome_type = (body.outcome_type ?? searchParams.get("type")) as PlanOutcomeType | null;
    const option_id: string | null = body.option_id ?? null;
    const session_id: string | null = body.session_id ?? searchParams.get("sid") ?? null;
    const metadata: Record<string, unknown> | null = body.metadata ?? null;

    if (!outcome_type || !VALID_OUTCOME_TYPES.has(outcome_type)) {
      return NextResponse.json({ error: "Invalid outcome_type" }, { status: 400 });
    }

    const { userId } = await auth().catch(() => ({ userId: null }));

    await ensurePlanOutcomesTable();

    // Verify plan exists — accept outcome regardless, but warn if unknown
    const planCheck = await sql`
      SELECT id FROM decision_plans WHERE id = ${plan_id} LIMIT 1
    `.catch(() => ({ rows: [] as { id: string }[] }));

    if (planCheck.rows.length === 0) {
      console.warn(`[plan-outcome] outcome for unknown plan_id: ${plan_id}`);
    }

    await sql`
      INSERT INTO plan_outcomes (plan_id, session_id, user_id, outcome_type, option_id, metadata)
      VALUES (
        ${plan_id},
        ${session_id},
        ${userId ?? null},
        ${outcome_type},
        ${option_id},
        ${metadata ? JSON.stringify(metadata) : null}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record outcome" }, { status: 500 });
  }
}

// GET handler for calendar deep links: /api/plan/{id}/outcome?type=went
// Redirects to confirmation page after recording the outcome
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: plan_id } = await params;
  const { searchParams } = new URL(req.url);
  const outcome_type = searchParams.get("type") as PlanOutcomeType | null;

  if (outcome_type && VALID_OUTCOME_TYPES.has(outcome_type)) {
    await ensurePlanOutcomesTable().catch(() => {});

    const planCheck = await sql`
      SELECT id FROM decision_plans WHERE id = ${plan_id} LIMIT 1
    `.catch(() => ({ rows: [] as { id: string }[] }));

    if (planCheck.rows.length === 0) {
      console.warn(`[plan-outcome] GET outcome for unknown plan_id: ${plan_id}`);
    }

    await sql`
      INSERT INTO plan_outcomes (plan_id, session_id, user_id, outcome_type)
      VALUES (${plan_id}, ${null}, ${null}, ${outcome_type})
    `.catch(() => {});
  }

  // Redirect to the shared plan page with a confirmation flag
  return Response.redirect(new URL(`/plan/${plan_id}?outcome=recorded`, req.url), 307);
}
