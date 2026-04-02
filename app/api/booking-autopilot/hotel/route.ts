import { NextRequest, NextResponse } from "next/server";
import { runBookingComAutopilot } from "../../../../lib/booking-autopilot/booking-com";
import type { HotelAutopilotRequest } from "../../../../lib/booking-autopilot/types";

export async function POST(req: NextRequest) {
  let body: HotelAutopilotRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.hotel_name || !body.city || !body.checkin || !body.checkout || !body.adults) {
    return NextResponse.json(
      { error: "Missing required fields: hotel_name, city, checkin, checkout, adults" },
      { status: 400 }
    );
  }

  const result = await runBookingComAutopilot(body);
  return NextResponse.json(result);
}
