/**
 * POST /api/booking-jobs/[id]/start
 *
 * Long-running endpoint (up to 5 min) that executes autopilot steps
 * sequentially with full in-task decision-making:
 *
 * Per step:
 *  1. Try primary   (up to 3 attempts with 2s/5s backoff on transient error)
 *  2. If restaurant + no_availability: auto-try timeFallbacks (±30, ±60, ±90 min)
 *     — the agent picks the best adjacent time on the user's behalf
 *  3. Try each fallbackCandidate venue (1 attempt each)
 *  4. If candidate is a restaurant + no_availability: also try its timeFallbacks
 *  5. All failed → actionItem with manual booking links, continue to next step
 *
 * Every decision is logged in step.decisionLog for the task view.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getBookingJob,
  updateBookingJobStatus,
  updateBookingJobSteps,
  getPushSubscriptionsBySession,
} from "@/lib/db";
import type {
  BookingJobStep,
  FallbackCandidate,
  DecisionLogEntry,
} from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";
import type { AutopilotResult } from "@/lib/booking-autopilot/types";

export const maxDuration = 300; // 5 minutes

type Params = { params: Promise<{ id: string }> };

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function now(): string {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

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

/**
 * Try one specific body payload against the autopilot endpoint.
 * Returns { data, log } — data is the API result, log is the entry to append.
 */
async function tryOnce(
  endpoint: string,
  body: Record<string, unknown>,
  logMessage: string
): Promise<{ data: AutopilotResult | null; entry: DecisionLogEntry }> {
  try {
    const data = await callAutopilotEndpoint(endpoint, body);
    const outcome =
      data.status === "ready"
        ? "Booked ✓"
        : data.status === "no_availability"
        ? "No availability"
        : data.error ?? "Error";
    return {
      data,
      entry: {
        ts: now(),
        type: data.status === "ready" ? "succeeded" : data.status === "no_availability" ? "skipped" : "failed",
        message: logMessage,
        outcome,
      },
    };
  } catch (err) {
    return {
      data: null,
      entry: {
        ts: now(),
        type: "failed",
        message: logMessage,
        outcome: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

/**
 * Try a venue+body with optional time fallbacks.
 * Returns the first successful result, or null if all fail.
 * Appends to `log` for every attempt made.
 */
async function tryWithTimeFallbacks(
  endpoint: string,
  baseBody: Record<string, unknown>,
  primaryLabel: string,
  timeFallbacks: string[] | undefined,
  log: DecisionLogEntry[]
): Promise<AutopilotResult | null> {
  // Primary time
  const primaryTime = typeof baseBody.time === "string" ? baseBody.time : undefined;
  const primaryMessage =
    primaryTime && baseBody.restaurant_name
      ? `Tried ${baseBody.restaurant_name} at ${primaryTime}`
      : primaryLabel;

  const { data, entry } = await tryOnce(endpoint, baseBody, primaryMessage);
  log.push(entry);

  if (data?.status === "ready") return data;

  // Only try time fallbacks for no_availability (not transient errors)
  if (data?.status === "no_availability" && timeFallbacks?.length) {
    for (const altTime of timeFallbacks) {
      const altBody = { ...baseBody, time: altTime };
      const altMessage = baseBody.restaurant_name
        ? `Agent adjusted to ${altTime} at ${baseBody.restaurant_name}`
        : `Trying ${altTime}`;
      const { data: altData, entry: altEntry } = await tryOnce(endpoint, altBody, altMessage);
      altEntry.type = altData?.status === "ready" ? "succeeded" : "time_adjusted";
      log.push(altEntry);
      if (altData?.status === "ready") return altData;
    }
  }

  return null;
}

async function runStepWithRecovery(
  step: BookingJobStep,
  onProgress: (updated: BookingJobStep) => Promise<void>
): Promise<BookingJobStep> {
  const RETRY_DELAYS = [0, 2000, 5000];
  const log: DecisionLogEntry[] = [];
  let current = { ...step, attemptCount: 0, decisionLog: log };

  // ── Phase 1: primary, up to 3 attempts with backoff ──────────────────
  let primarySucceeded = false;
  let primaryData: AutopilotResult | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
      log.push({
        ts: now(),
        type: "retry",
        message: `Retrying… (attempt ${attempt + 1} of ${RETRY_DELAYS.length})`,
      });
    }

    current = {
      ...current,
      status: "loading",
      attemptCount: (current.attemptCount ?? 0) + 1,
    };
    await onProgress({ ...current, decisionLog: [...log] });

    try {
      const data = await callAutopilotEndpoint(step.apiEndpoint, step.body);

      if (data.status === "ready") {
        const primaryTime =
          typeof step.body.time === "string" ? step.body.time : undefined;
        log.push({
          ts: now(),
          type: "succeeded",
          message: primaryTime
            ? `Booked ${step.label} at ${primaryTime}`
            : `Booked ${step.label}`,
          outcome: "Booked ✓",
        });
        primarySucceeded = true;
        primaryData = data;
        break;
      }

      if (data.status === "no_availability") {
        const primaryTime =
          typeof step.body.time === "string" ? ` at ${step.body.time}` : "";
        log.push({
          ts: now(),
          type: "skipped",
          message: `Tried ${step.label}${primaryTime}`,
          outcome: "No availability",
        });
        primaryData = data;
        break; // no_availability = don't retry same time
      }

      // transient error → loop to retry
      log.push({
        ts: now(),
        type: "attempt",
        message: `Tried ${step.label}`,
        outcome: data.error ?? "Error",
      });
      primaryData = data;
    } catch (err) {
      log.push({
        ts: now(),
        type: "attempt",
        message: `Tried ${step.label}`,
        outcome: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (primarySucceeded && primaryData) {
    return {
      ...current,
      status: "done",
      handoff_url: primaryData.handoff_url,
      selected_time: primaryData.selected_time,
      usedFallback: false,
      timeAdjusted: false,
      decisionLog: [...log],
    };
  }

  // ── Phase 2: time fallbacks (restaurants only) ───────────────────────
  if (
    step.type === "restaurant" &&
    primaryData?.status === "no_availability" &&
    step.timeFallbacks?.length
  ) {
    current = { ...current, status: "loading" };
    await onProgress({ ...current, decisionLog: [...log] });

    for (const altTime of step.timeFallbacks) {
      const altBody = { ...step.body, time: altTime };
      const altMessage = `Agent adjusted to ${altTime} at ${step.label}`;
      const { data: altData, entry: altEntry } = await tryOnce(
        step.apiEndpoint,
        altBody,
        altMessage
      );
      altEntry.type = altData?.status === "ready" ? "succeeded" : "time_adjusted";
      log.push(altEntry);

      await onProgress({ ...current, decisionLog: [...log] });

      if (altData?.status === "ready") {
        return {
          ...current,
          status: "done",
          handoff_url: altData.handoff_url,
          selected_time: altData.selected_time,
          usedFallback: false,
          timeAdjusted: true,
          decisionLog: [...log],
        };
      }
    }
  }

  // ── Phase 3: fallback candidates (alternative venues) ────────────────
  const candidates: FallbackCandidate[] = step.fallbackCandidates ?? [];
  for (const candidate of candidates) {
    current = {
      ...current,
      status: "loading",
    };
    await onProgress({ ...current, decisionLog: [...log] });

    log.push({
      ts: now(),
      type: "venue_switched",
      message: `Switching to alternative: ${candidate.label}`,
    });

    const successData = await tryWithTimeFallbacks(
      step.apiEndpoint,
      candidate.body,
      candidate.label,
      step.type === "restaurant" ? step.timeFallbacks : undefined,
      log
    );

    await onProgress({ ...current, decisionLog: [...log] });

    if (successData) {
      return {
        ...current,
        status: "done",
        label: candidate.label,
        handoff_url: successData.handoff_url,
        selected_time: successData.selected_time,
        usedFallback: true,
        decisionLog: [...log],
      };
    }
  }

  // ── Phase 4: all failed — build actionItem ────────────────────────────
  log.push({
    ts: now(),
    type: "failed",
    message: "All automatic options exhausted",
    outcome: "Needs your attention",
  });

  const manualOptions = [
    { label: step.label, url: step.fallbackUrl },
    ...candidates.map((c) => ({ label: c.label, url: c.fallbackUrl })),
  ].filter((o) => o.url);

  const actionItem =
    manualOptions.length > 0
      ? {
          message:
            manualOptions.length === 1
              ? "Auto-booking failed. Tap to complete manually:"
              : "Auto-booking failed. Choose one of these to book manually:",
          options: manualOptions,
        }
      : undefined;

  return {
    ...current,
    status: "error",
    handoff_url: step.fallbackUrl,
    actionItem,
    decisionLog: [...log],
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

  // ── Push notification ──────────────────────────────────────────────────
  try {
    const subscriptions = await getPushSubscriptionsBySession(job.session_id);
    const needsAttention = steps.filter((s) => s.actionItem).length;
    const timeAdjusted = steps.filter((s) => s.timeAdjusted).length;
    const usedFallback = steps.filter((s) => s.usedFallback).length;

    let title: string;
    let body: string;

    if (doneCount === steps.length) {
      const adjustNote =
        timeAdjusted > 0 || usedFallback > 0
          ? ` (agent made ${timeAdjusted + usedFallback} smart adjustment${timeAdjusted + usedFallback > 1 ? "s" : ""})`
          : "";
      title = "✈ Your trip is ready to book!";
      body = `All ${steps.length} bookings pre-filled${adjustNote} — tap to open and pay.`;
    } else if (doneCount > 0 && needsAttention > 0) {
      const doneEmojis = steps
        .filter((s) => s.status === "done")
        .map((s) => s.emoji)
        .join(" ");
      title = `${doneEmojis} Partially booked — action needed`;
      body = `${doneCount} of ${steps.length} ready. ${needsAttention} step${needsAttention > 1 ? "s need" : " needs"} your attention.`;
    } else if (doneCount > 0) {
      title = "Trip booking update";
      body = `${doneCount} of ${steps.length} bookings pre-filled — tap to see.`;
    } else {
      title = "Trip booking needs attention";
      body = "Autopilot couldn't complete any steps. Tap to book manually.";
    }

    await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPushNotification(sub.push_subscription as PushSubscription, {
          title,
          body,
          url: "/trips",
        })
      )
    );
  } catch {
    // Push failure never blocks job completion
  }

  return NextResponse.json({ jobId: id, status: finalStatus, steps });
}
