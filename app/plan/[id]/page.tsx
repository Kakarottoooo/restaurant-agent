import { notFound } from "next/navigation";
import { ensureDecisionPlansTable, sql } from "@/lib/db";
import { DecisionPlan } from "@/lib/types";
import SharedPlanView from "./SharedPlanView";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ outcome?: string }>;
}

export default async function SharedPlanPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { outcome } = await searchParams;

  let plan: DecisionPlan | null = null;

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

  return (
    <SharedPlanView
      plan={plan}
      planId={id}
      outcomeRecorded={outcome === "recorded"}
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
        title: `${plan.title} — Folio`,
        description: plan.summary,
      };
    }
  } catch {
    // ignore
  }

  return { title: "Shared Plan — Folio" };
}
