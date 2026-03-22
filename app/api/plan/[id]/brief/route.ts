import { NextRequest, NextResponse } from "next/server";
import { ensureDecisionPlansTable, sql } from "@/lib/db";
import type { DecisionPlan } from "@/lib/types";
import { buildPlanBrief } from "@/lib/agent/planners/plan-brief";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse("Missing plan id", { status: 400 });
    }

    await ensureDecisionPlansTable();

    const result = await sql<{ plan_json: DecisionPlan }>`
      SELECT plan_json FROM decision_plans WHERE id = ${id} LIMIT 1
    `;

    if (result.rows.length === 0) {
      return new NextResponse("Plan not found", { status: 404 });
    }

    const plan: DecisionPlan = result.rows[0].plan_json;
    const brief = buildPlanBrief(plan);
    const filename = `onegent-plan-${id}.md`;

    return new NextResponse(brief, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Failed to generate plan brief", { status: 500 });
  }
}
