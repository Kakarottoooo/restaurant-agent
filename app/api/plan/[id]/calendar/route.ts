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

    if (!plan.event_datetime) {
      return new NextResponse("No calendar event for this plan", { status: 422 });
    }

    // event_datetime is a local ISO string ("YYYY-MM-DDTHH:mm:ss") — no timezone offset.
    // We store it as floating local time; ICS uses it without Z (per RFC 5545 §3.3.5).
    const toICSFmt = (iso: string) =>
      iso.replace(/[-:]/g, "").substring(0, 15); // "YYYYMMDDTHHmmss"

    // Compute end time by treating the string as UTC for arithmetic only.
    const addHoursToISO = (iso: string, hrs: number): string => {
      const d = new Date(iso + "Z");
      d.setUTCHours(d.getUTCHours() + hrs);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
    };

    const durationHrs = plan.scenario === "date_night" ? 2 : 24;
    const endISO = addHoursToISO(plan.event_datetime, durationHrs);

    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const dtstart = toICSFmt(plan.event_datetime);
    const dtend = toICSFmt(endISO);
    const location = (plan.event_location ?? "").replace(/\n/g, "\\n").replace(/,/g, "\\,");
    const summary = plan.title.replace(/\n/g, "\\n").replace(/,/g, "\\,");
    const description = plan.summary.replace(/\n/g, "\\n").replace(/,/g, "\\,");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Folio//Folio//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${id}@folio.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="folio-plan-${id}.ics"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Failed to generate calendar file", { status: 500 });
  }
}
