/**
 * PATCH /api/booking-jobs/[id]/schedule-retry
 *
 * Schedules a specific failed step for automatic retry at a future time.
 * The cron job at /api/cron/retry-jobs picks this up and re-runs the step.
 *
 * Body: { stepIndex: number, retryAfter: string } (retryAfter = ISO timestamp)
 * To cancel a scheduled retry: pass retryAfter: null
 */
import { NextRequest, NextResponse } from "next/server";
import { getBookingJob, updateBookingJobStep } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as {
    stepIndex: number;
    retryAfter: string | null;
    resetStatus?: boolean;
    patchBody?: Record<string, unknown>;
  };

  if (typeof body.stepIndex !== "number") {
    return NextResponse.json({ error: "stepIndex required" }, { status: 400 });
  }

  const job = await getBookingJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const step = job.steps[body.stepIndex];
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // Only allow scheduling retry on failed steps
  if (step.status === "done" && !body.retryAfter && !body.resetStatus) {
    return NextResponse.json({ error: "Step already succeeded" }, { status: 400 });
  }

  if (body.retryAfter === null || body.resetStatus) {
    const patch: Parameters<typeof updateBookingJobStep>[2] = {
      retryScheduledFor: undefined,
    };

    // Reset step to pending so the executor will re-run it
    if (body.resetStatus) {
      patch.status = "pending";
      patch.error = undefined;
      patch.decisionLog = [];
    }

    // Merge enriched task fields into step body (e.g. updated task instruction)
    if (body.patchBody && typeof body.patchBody === "object") {
      patch.body = { ...step.body, ...body.patchBody };
    }

    await updateBookingJobStep(id, body.stepIndex, patch);
    return NextResponse.json({ ok: true, cancelled: body.retryAfter === null });
  }

  const retryAt = new Date(body.retryAfter);
  if (isNaN(retryAt.getTime())) {
    return NextResponse.json({ error: "Invalid retryAfter timestamp" }, { status: 400 });
  }

  await updateBookingJobStep(id, body.stepIndex, {
    retryScheduledFor: retryAt.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    stepIndex: body.stepIndex,
    retryScheduledFor: retryAt.toISOString(),
  });
}
