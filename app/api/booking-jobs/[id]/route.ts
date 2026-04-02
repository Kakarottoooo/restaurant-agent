import { NextRequest, NextResponse } from "next/server";
import { getBookingJob } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/booking-jobs/[id] — poll job status */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const job = await getBookingJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
