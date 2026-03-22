import { NextRequest, NextResponse } from "next/server";
import { ensurePlanVotesTable, sql } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/plan/[id]/votes — returns vote tally by option_id */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: planId } = await params;

  try {
    await ensurePlanVotesTable();
    const result = await sql<{ option_id: string; count: string }>`
      SELECT option_id, COUNT(*) AS count
      FROM plan_votes
      WHERE plan_id = ${planId}
      GROUP BY option_id
    `;
    const tally: Record<string, number> = {};
    for (const row of result.rows) {
      tally[row.option_id] = parseInt(row.count, 10);
    }
    return NextResponse.json({ tally });
  } catch {
    return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
  }
}

/** POST /api/plan/[id]/vote — records or updates a vote (one per voter_session) */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: planId } = await params;

  let body: { voter_session?: string; option_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { voter_session, option_id } = body;
  if (!voter_session || !option_id) {
    return NextResponse.json({ error: "voter_session and option_id are required" }, { status: 400 });
  }

  try {
    await ensurePlanVotesTable();
    // Upsert: one vote per session per plan, overwrite if they change their mind
    await sql`
      INSERT INTO plan_votes (plan_id, voter_session, option_id)
      VALUES (${planId}, ${voter_session}, ${option_id})
      ON CONFLICT (plan_id, voter_session)
      DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()
    `;
    // Return updated tally
    const result = await sql<{ option_id: string; count: string }>`
      SELECT option_id, COUNT(*) AS count
      FROM plan_votes
      WHERE plan_id = ${planId}
      GROUP BY option_id
    `;
    const tally: Record<string, number> = {};
    for (const row of result.rows) {
      tally[row.option_id] = parseInt(row.count, 10);
    }
    return NextResponse.json({ ok: true, tally });
  } catch {
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}
