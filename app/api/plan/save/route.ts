import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensureDecisionPlansTable, sql } from "@/lib/db";
import { DecisionPlan } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, session_id, query_text, parent_plan_id } = body as {
      plan: DecisionPlan;
      session_id: string;
      query_text?: string;
      parent_plan_id?: string;
    };

    if (!plan?.id || !plan?.scenario || !session_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { userId } = await auth();

    await ensureDecisionPlansTable();

    // Upsert — idempotent, safe to retry on network blips
    await sql`
      INSERT INTO decision_plans (id, session_id, user_id, scenario, query_text, plan_json, parent_plan_id)
      VALUES (
        ${plan.id},
        ${session_id},
        ${userId ?? null},
        ${plan.scenario},
        ${query_text ?? null},
        ${JSON.stringify(plan)},
        ${parent_plan_id ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return NextResponse.json({ ok: true, plan_id: plan.id });
  } catch {
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
