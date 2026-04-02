import { NextRequest, NextResponse } from "next/server";
import { runOpenTableAutopilot } from "../../../../lib/booking-autopilot/opentable";
import type { RestaurantAutopilotRequest } from "../../../../lib/booking-autopilot/types";

export async function POST(req: NextRequest) {
  let body: RestaurantAutopilotRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.restaurant_name || !body.city || !body.date || !body.time || !body.covers) {
    return NextResponse.json(
      { error: "Missing required fields: restaurant_name, city, date, time, covers" },
      { status: 400 }
    );
  }

  const result = await runOpenTableAutopilot(body);
  return NextResponse.json(result);
}
