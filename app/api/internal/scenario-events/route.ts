import { NextRequest, NextResponse } from "next/server";
import {
  getScenarioEventsSnapshot,
  requireInternalAnalyticsAccess,
  resolveScenarioEventsQuery,
} from "@/lib/scenarioEvents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await requireInternalAnalyticsAccess();

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? "forbidden" },
      { status: access.status }
    );
  }

  try {
    const snapshot = await getScenarioEventsSnapshot(
      resolveScenarioEventsQuery(req.nextUrl.searchParams)
    );

    return NextResponse.json({
      ...snapshot,
      access_mode: access.accessMode,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load scenario events" },
      { status: 500 }
    );
  }
}
