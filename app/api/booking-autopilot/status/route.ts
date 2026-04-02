import { NextResponse } from "next/server";
import { getAllStatuses } from "../../../../lib/booking-autopilot/cookie-store";

export async function GET() {
  return NextResponse.json(getAllStatuses());
}
