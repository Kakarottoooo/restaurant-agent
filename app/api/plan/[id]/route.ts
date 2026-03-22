import { NextRequest, NextResponse } from "next/server";
import { ensureDecisionPlansTable, sql } from "@/lib/db";
import { DecisionPlan } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing plan id" }, { status: 400 });
    }

    await ensureDecisionPlansTable();

    const result = await sql<{ plan_json: DecisionPlan }>`
      SELECT plan_json FROM decision_plans WHERE id = ${id} LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(
      { plan: result.rows[0].plan_json },
      {
        headers: {
          // Plan JSON is immutable after save — safe to cache at the edge
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}
