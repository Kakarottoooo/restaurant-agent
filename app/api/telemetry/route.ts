import { NextRequest, NextResponse } from "next/server";

export interface SelectionEvent {
  type: "map_click" | "reserve_click";
  restaurant_id: string;
  restaurant_name: string;
  rank: number;
  request_id?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const event: SelectionEvent = await req.json();
    console.log(JSON.stringify({ telemetry: event }));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
  }
}
