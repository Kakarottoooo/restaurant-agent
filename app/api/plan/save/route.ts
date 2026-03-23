import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensureDecisionPlansTable, recordVenueBaseline, sql } from "@/lib/db";
import { DecisionPlan, RecommendationCard } from "@/lib/types";

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

    // G-4: Record venue baseline for date_night plans with a restaurant primary option
    // fire-and-forget — never block the save response
    if (plan.scenario === "date_night" && plan.primary_plan?.evidence_card_id) {
      // The plan_json carries the full plan; extract restaurant from evidence_card_ids context.
      // We look for a restaurant object embedded in the plan's primary_plan via linked cards.
      // Since evidence_card_ids are string IDs and cards are not stored in the DB row directly,
      // we check the plan_json for any serialized restaurant data.
      const planJson = plan as DecisionPlan & { _evidence_cards?: RecommendationCard[] };
      const evidenceCards: RecommendationCard[] = (planJson as unknown as { _evidence_cards?: RecommendationCard[] })._evidence_cards ?? [];
      const primaryCard = evidenceCards.find((c) => c.restaurant?.id);
      if (primaryCard?.restaurant) {
        const { id: venueId, name: venueName, rating, review_count } = primaryCard.restaurant;
        // Only record if the plan has a future event date
        const eventDatetime = plan.event_datetime ? new Date(plan.event_datetime) : null;
        const isFutureEvent = eventDatetime && eventDatetime > new Date();
        if (isFutureEvent && venueId && rating && review_count) {
          recordVenueBaseline(plan.id, venueId, venueName, rating, review_count).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true, plan_id: plan.id });
  } catch {
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
