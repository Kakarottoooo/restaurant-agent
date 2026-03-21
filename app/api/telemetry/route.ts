import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensureScenarioEventsTable, sql } from "@/lib/db";
import { ScenarioTelemetryEvent } from "@/lib/types";

export interface SelectionEvent {
  type: "map_click" | "reserve_click";
  restaurant_id: string;
  restaurant_name: string;
  rank: number;
  request_id?: string;
  timestamp: string;
}

type TelemetryEvent = SelectionEvent | ScenarioTelemetryEvent;

function isScenarioEvent(event: TelemetryEvent): event is ScenarioTelemetryEvent {
  return [
    "plan_viewed",
    "plan_approved",
    "backup_promoted",
    "action_clicked",
    "feedback_negative",
  ].includes(event.type);
}

function isSelectionEvent(event: TelemetryEvent): event is SelectionEvent {
  return event.type === "map_click" || event.type === "reserve_click";
}

export async function POST(req: NextRequest) {
  try {
    const event = (await req.json()) as TelemetryEvent;

    if (isScenarioEvent(event)) {
      const { userId } = await auth();
      await ensureScenarioEventsTable();
      await sql`
        INSERT INTO scenario_events (
          user_id,
          session_id,
          scenario,
          plan_id,
          event_type,
          option_id,
          action_id,
          request_id,
          query_text,
          metadata_json
        )
        VALUES (
          ${userId ?? null},
          ${event.session_id},
          ${event.scenario},
          ${event.plan_id},
          ${event.type},
          ${event.option_id ?? null},
          ${event.action_id ?? null},
          ${event.request_id ?? null},
          ${event.query ?? null},
          ${event.metadata ? JSON.stringify(event.metadata) : null}
        )
      `;

      console.log(JSON.stringify({ telemetry: event }));
      return NextResponse.json({ ok: true });
    }

    if (isSelectionEvent(event)) {
      console.log(JSON.stringify({ telemetry: event }));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
  }
}
