/**
 * POST /api/booking-jobs/[id]/start
 *
 * Long-running endpoint (up to 5 min) that executes the autopilot steps
 * for a booking job sequentially, updating the DB after each step.
 * The client fires this request and doesn't await it (keepalive: true).
 * The UI polls /api/booking-jobs/[id] for progress.
 *
 * Recovery logic per step:
 *  1. Try primary  (attempt 1)
 *  2. Retry after 2s if error (attempt 2)
 *  3. Retry after 5s if still error (attempt 3)
 *  4. Try each fallbackCandidate (1 attempt each, no delay)
 *  5. If all fail → mark step as "error", populate actionItem, continue to next step
 *  6. "no_availability" is final — no retry, skip to fallback candidates immediately
 *
 * On completion, sends a Web Push notification to the user.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getBookingJob,
  updateBookingJobStatus,
  updateBookingJobSteps,
  getPushSubscriptionsBySession,
} from "@/lib/db";
import type { BookingJobStep, FallbackCandidate } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";
import type { AutopilotResult } from "@/lib/booking-autopilot/types";

export const maxDuration = 300; // 5 minutes

type Params = { params: Promise<{ id: string }> };

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Call a single autopilot endpoint and return the raw result. */
async function callAutopilotEndpoint(
  endpoint: string,
  body: Record<string, unknown>
): Promise<AutopilotResult> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<AutopilotResult>;
}

/** Sleep for `ms` milliseconds. */
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Run one step with full recovery:
 *  - Up to 3 attempts with 2s / 5s backoff on error
 *  - no_availability is not retried; fall straight through to candidates
 *  - Each fallback candidate gets 1 attempt
 *  - Returns the mutated step with final status + any actionItem
 */
async function runStepWithRecovery(
  step: BookingJobStep,
  onProgress: (updated: BookingJobStep) => Promise<void>
): Promise<BookingJobStep> {
  const RETRY_DELAYS = [0, 2000, 5000]; // delays before attempt 1, 2, 3
  let current = { ...step, attemptCount: 0 };

  // ── Phase 1: try primary with up to 3 attempts ──────────────────────────
  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
    }

    current = {
      ...current,
      status: "loading",
      attemptCount: (current.attemptCount ?? 0) + 1,
      error: undefined,
    };
    await onProgress(current);

    try {
      const data = await callAutopilotEndpoint(step.apiEndpoint, step.body);

      if (data.status === "ready") {
        return {
          ...current,
          status: "done",
          handoff_url: data.handoff_url,
          selected_time: data.selected_time,
          error: undefined,
          usedFallback: false,
        };
      }

      if (data.status === "no_availability") {
        // No point retrying — availability won't change between attempts.
        current = { ...current, status: "no_availability", error: data.error };
        break; // proceed to fallback candidates
      }

      // error status → retry
      current = { ...current, status: "error", error: data.error ?? "Unknown error" };
    } catch (err) {
      current = {
        ...current,
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  // ── Phase 2: try fallback candidates ───────────────────────────────────
  const candidates: FallbackCandidate[] = step.fallbackCandidates ?? [];
  for (const candidate of candidates) {
    current = {
      ...current,
      status: "loading",
      label: `${step.label} → ${candidate.label}`,
      error: undefined,
    };
    await onProgress(current);

    try {
      const data = await callAutopilotEndpoint(step.apiEndpoint, candidate.body);

      if (data.status === "ready") {
        return {
          ...current,
          status: "done",
          handoff_url: data.handoff_url,
          selected_time: data.selected_time,
          error: undefined,
          usedFallback: true,
        };
      }

      current = {
        ...current,
        status: data.status === "no_availability" ? "no_availability" : "error",
        error: data.error,
      };
    } catch (err) {
      current = {
        ...current,
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  // ── Phase 3: all attempts failed — build actionItem ────────────────────
  const manualOptions = [
    { label: step.label, url: step.fallbackUrl },
    ...candidates.map((c) => ({ label: c.label, url: c.fallbackUrl })),
  ].filter((o) => o.url); // drop entries with no URL

  const actionItem =
    manualOptions.length > 0
      ? {
          message:
            manualOptions.length === 1
              ? `Auto-booking failed. Tap to complete manually:`
              : `Auto-booking failed. Choose one of these options to book manually:`,
          options: manualOptions,
        }
      : undefined;

  return {
    ...current,
    status: "error",
    actionItem,
    handoff_url: step.fallbackUrl, // best-effort deep link
  };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const job = await getBookingJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "running" || job.status === "done") {
    return NextResponse.json({ error: "Job already started" }, { status: 409 });
  }

  await updateBookingJobStatus(id, "running");

  const steps: BookingJobStep[] = [...job.steps];

  for (let i = 0; i < steps.length; i++) {
    // Callback that persists intermediate step state to DB while the step runs
    const onProgress = async (updated: BookingJobStep) => {
      steps[i] = updated;
      await updateBookingJobSteps(id, steps);
    };

    steps[i] = await runStepWithRecovery(steps[i], onProgress);
    await updateBookingJobSteps(id, steps);
  }

  const doneCount = steps.filter((s) => s.status === "done").length;
  const finalStatus = doneCount > 0 ? "done" : "failed";
  await updateBookingJobStatus(id, finalStatus, new Date());

  // ── Push notification ─────────────────────────────────────────────────
  try {
    const subscriptions = await getPushSubscriptionsBySession(job.session_id);

    const failedSteps = steps.filter((s) => s.status === "error" || s.status === "no_availability");
    const needsAttention = failedSteps.filter((s) => s.actionItem).length;

    let title: string;
    let body: string;

    if (doneCount === steps.length) {
      title = "✈ Your trip is ready to book!";
      body = `All ${steps.length} bookings pre-filled — tap to open and pay.`;
    } else if (doneCount > 0 && needsAttention > 0) {
      const doneLabels = steps
        .filter((s) => s.status === "done")
        .map((s) => s.emoji)
        .join(" ");
      title = `${doneLabels} Partially booked — action needed`;
      body = `${doneCount} of ${steps.length} ready. ${needsAttention} step${needsAttention > 1 ? "s need" : " needs"} your attention.`;
    } else if (doneCount > 0) {
      title = "Trip booking update";
      body = `${doneCount} of ${steps.length} bookings pre-filled — tap to see what's ready.`;
    } else {
      title = "Trip booking update";
      body = "Some steps couldn't complete. Tap to see what's ready.";
    }

    const pushPayload = { title, body, url: "/trips" };
    await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPushNotification(sub.push_subscription as PushSubscription, pushPayload)
      )
    );
  } catch {
    // Push failure should never block the job completion response
  }

  return NextResponse.json({ jobId: id, status: finalStatus, steps });
}
