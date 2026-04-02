import { NextRequest, NextResponse } from "next/server";
import { runKayakFlightAutopilot } from "../../../../lib/booking-autopilot/kayak-flights";
import type { FlightAutopilotRequest } from "../../../../lib/booking-autopilot/kayak-flights";

export async function POST(req: NextRequest) {
  let body: FlightAutopilotRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.origin || !body.dest || !body.date) {
    return NextResponse.json(
      { error: "Missing required fields: origin, dest, date" },
      { status: 400 }
    );
  }

  const result = await runKayakFlightAutopilot(body);
  return NextResponse.json(result);
}
