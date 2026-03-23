import { notFound } from "next/navigation";
import { ensureDecisionPlansTable, ensurePlanOutcomesTable, ensurePlanVotesTable, sql } from "@/lib/db";
import { DecisionPlan } from "@/lib/types";
import SharedPlanView from "./SharedPlanView";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ outcome?: string; vote?: string }>;
}

export default async function SharedPlanPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { outcome, vote } = await searchParams;
  const voteMode = vote === "true";

  let plan: DecisionPlan | null = null;
  let initialTally: Record<string, number> = {};
  let hasVenueAlert = false;

  try {
    await ensureDecisionPlansTable();
    const result = await sql<{ plan_json: DecisionPlan }>`
      SELECT plan_json FROM decision_plans WHERE id = ${id} LIMIT 1
    `;
    plan = result.rows[0]?.plan_json ?? null;
  } catch {
    // DB unavailable — treat as not found
  }

  if (!plan) {
    notFound();
  }

  if (voteMode) {
    try {
      await ensurePlanVotesTable();
      const tallyResult = await sql<{ option_id: string; count: string }>`
        SELECT option_id, COUNT(*) AS count FROM plan_votes WHERE plan_id = ${id} GROUP BY option_id
      `;
      for (const row of tallyResult.rows) {
        initialTally[row.option_id] = parseInt(row.count, 10);
      }
    } catch {
      // Non-fatal — UI degrades gracefully
    }
  }

  // G-4: Check for venue quality alert in plan outcomes
  try {
    await ensurePlanOutcomesTable();
    const alertResult = await sql<{ id: number }>`
      SELECT id FROM plan_outcomes
      WHERE plan_id = ${id} AND outcome_type = 'venue_quality_alert'
      LIMIT 1
    `;
    hasVenueAlert = alertResult.rows.length > 0;
  } catch {
    // Non-fatal — degrade gracefully
  }

  return (
    <SharedPlanView
      plan={plan}
      planId={id}
      outcomeRecorded={outcome === "recorded"}
      voteMode={voteMode}
      initialTally={initialTally}
      hasVenueAlert={hasVenueAlert}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await ensureDecisionPlansTable();
    const result = await sql<{ plan_json: DecisionPlan }>`
      SELECT plan_json FROM decision_plans WHERE id = ${id} LIMIT 1
    `;
    const plan = result.rows[0]?.plan_json;
    if (plan) {
      return {
        title: `${plan.title} — Onegent`,
        description: plan.summary,
      };
    }
  } catch {
    // ignore
  }

  return { title: "Shared Plan — Onegent" };
}
