import { notFound } from "next/navigation";
import { ensureDecisionPlansTable, ensurePlanVotesTable, sql } from "@/lib/db";
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

  return (
    <SharedPlanView
      plan={plan}
      planId={id}
      outcomeRecorded={outcome === "recorded"}
      voteMode={voteMode}
      initialTally={initialTally}
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
