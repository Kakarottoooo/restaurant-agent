/**
 * PATCH /api/monitors/[id]  — update monitor status (pause / cancel / resolve)
 */
import { NextRequest, NextResponse } from "next/server";
import { updateMonitor } from "@/lib/db";
import type { MonitorStatus } from "@/lib/monitors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as { status: MonitorStatus };

  if (!body.status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  try {
    await updateMonitor(id, { status: body.status });
    return NextResponse.json({ ok: true, id, status: body.status });
  } catch (err) {
    console.error("monitor PATCH error", err);
    return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
  }
}
