/**
 * POST /api/booking-jobs/[id]/start
 *
 * Long-running endpoint (up to 5 min) that executes autopilot steps
 * sequentially. Every autonomous decision is:
 *   1. Controlled by the user's AgentAutonomySettings (stored in the job)
 *   2. Logged with an explanation that cites the relevant setting
 *
 * Recovery order per step:
 *   1. Try primary (up to 3 attempts, 2s/5s backoff on transient error)
 *   2. If restaurant + no_availability + timeWindowMinutes > 0:
 *      try filtered timeFallbacks, citing the window setting in each log entry
 *   3. If allowVenueSwitch (hotel/restaurant): try each fallbackCandidate
 *      — restaurant candidates also get their own time-filtered fallbacks
 *   4. All failed → actionItem + explanatory message, continue to next step
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getBookingJob,
  updateBookingJobStatus,
  updateBookingJobSteps,
  getPushSubscriptionsBySession,
  writeAgentLog,
} from "@/lib/db";
import type { BookingJobStep, FallbackCandidate, DecisionLogEntry } from "@/lib/db";
import {
  DEFAULT_AUTONOMY,
  filterTimeFallbacks,
  Explain,
} from "@/lib/autonomy";
import type { AgentAutonomySettings } from "@/lib/autonomy";
import {
  computePolicyBias,
  sortCandidatesByPolicy,
  policyOrderExplanation,
  toleranceNote,
} from "@/lib/policy";
import type { PolicyBias } from "@/lib/policy";
import { getAgentFeedbackEvents } from "@/lib/db";
import {
  detectReplanTriggers,
  computeReplan,
  applyReplan,
} from "@/lib/replan";
import { buildAutoMonitors } from "@/lib/monitors";
import { createBookingMonitor } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import type { PushSubscription } from "web-push";
import type { AutopilotResult, BrowserTaskResult } from "@/lib/booking-autopilot/types";
import { buildPreferenceProfile } from "@/lib/policy";

// ── Agent-runtime: activity skill dispatch ─────────────────────────────────
// Restaurant / hotel / flight use the 4-phase recovery loop below.
// Activity steps (and future new types) are dispatched through the agent-runtime.
import { findActivitySkill } from "@/lib/agent-runtime/skills/find-activity";
import type { SkillContext } from "@/lib/agent-runtime/types";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function callEndpoint(
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

// ── Core recovery engine ───────────────────────────────────────────────────

async function runStepWithRecovery(
  step: BookingJobStep,
  autonomy: AgentAutonomySettings,
  policy: PolicyBias,
  onProgress: (s: BookingJobStep) => Promise<void>
): Promise<BookingJobStep> {
  const log: DecisionLogEntry[] = [];
  const RETRY_DELAYS = [0, 2000, 5000];
  let current: BookingJobStep = { ...step, attemptCount: 0, decisionLog: log };

  const rst = autonomy.restaurant;
  const htl = autonomy.hotel;

  // ── Phase 1: primary, up to 3 attempts ──────────────────────────────────
  let primaryData: AutopilotResult | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt]);
      log.push({
        ts: now(), type: "retry",
        message: Explain.retry(attempt + 1, RETRY_DELAYS.length, current.error ?? "error"),
      });
    }

    current = { ...current, status: "loading", attemptCount: (current.attemptCount ?? 0) + 1 };
    await onProgress({ ...current, decisionLog: [...log] });

    try {
      const data = await callEndpoint(step.apiEndpoint, step.body);
      primaryData = data;

      if (data.status === "ready") {
        const timeStr = typeof step.body.time === "string" ? ` at ${step.body.time}` : "";
        log.push({ ts: now(), type: "succeeded",
          message: Explain.timeTry(step.label, typeof step.body.time === "string" ? step.body.time : ""),
          outcome: "Booked ✓" });
        return { ...current, status: "done", handoff_url: data.handoff_url,
          selected_time: data.selected_time, usedFallback: false, timeAdjusted: false,
          decisionLog: [...log] };
      }

      if (data.status === "no_availability") {
        const baseTime = typeof step.body.time === "string" ? step.body.time : "";
        log.push({ ts: now(), type: "skipped",
          message: Explain.timeTry(step.label, baseTime),
          outcome: "No availability" });
        break; // don't retry no_availability — go to time fallbacks
      }

      log.push({ ts: now(), type: "attempt",
        message: Explain.timeTry(step.label, typeof step.body.time === "string" ? step.body.time : ""),
        outcome: data.error ?? "Error" });
      current = { ...current, error: data.error };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      log.push({ ts: now(), type: "attempt",
        message: Explain.timeTry(step.label, ""),
        outcome: errMsg });
      current = { ...current, error: errMsg };
    }
  }

  if (primaryData && primaryData.status === "ready") {
    // Shouldn't reach here but type-safety guard
    return { ...current, status: "done", decisionLog: [...log] };
  }

  // ── Phase 2: time fallbacks (restaurants) ─────────────────────────────
  const baseTime = typeof step.body.time === "string" ? step.body.time : "";

  if (step.type === "restaurant" && primaryData?.status === "no_availability" && baseTime) {
    const rawFallbacks = step.timeFallbacks ?? [];

    // Personal tolerance note for time adjustments
    if (policy.personalTolerance && rst.timeWindowMinutes > 0) {
      const note = toleranceNote(policy.personalTolerance, "time_adjusted");
      if (note) log.push({ ts: now(), type: "attempt", message: note });
    }

    if (rst.timeWindowMinutes === 0) {
      log.push({ ts: now(), type: "skipped",
        message: Explain.noTimeAdjustmentAllowed(step.label, baseTime),
        outcome: "Time adjustment is off" });
    } else {
      const allowed = filterTimeFallbacks(baseTime, rawFallbacks, rst);

      // Log times that were filtered out by settings
      const blocked = rawFallbacks.filter((t) => !allowed.includes(t));
      for (const t of blocked) {
        const tMin = toMin(t);
        const baseMin = toMin(baseTime);
        const diff = Math.abs(tMin - baseMin);
        const reason: "window" | "latest" | "earliest" =
          diff > rst.timeWindowMinutes ? "window" :
          tMin > toMin(rst.latestTimeHHMM) ? "latest" : "earliest";
        log.push({ ts: now(), type: "skipped",
          message: Explain.timeAdjustedBlocked(step.label, baseTime, t, reason),
          outcome: `Blocked by your settings` });
      }

      for (const altTime of allowed) {
        current = { ...current, status: "loading" };
        await onProgress({ ...current, decisionLog: [...log] });

        log.push({ ts: now(), type: "time_adjusted",
          message: Explain.timeAdjusted(step.label, baseTime, altTime, rst.timeWindowMinutes) });

        try {
          const data = await callEndpoint(step.apiEndpoint, { ...step.body, time: altTime });
          const lastEntry = log[log.length - 1];
          lastEntry.outcome = data.status === "ready" ? "Booked ✓" : data.error ?? "No availability";
          lastEntry.type = data.status === "ready" ? "succeeded" : "time_adjusted";

          await onProgress({ ...current, decisionLog: [...log] });

          if (data.status === "ready") {
            return { ...current, status: "done", handoff_url: data.handoff_url,
              selected_time: data.selected_time, timeAdjusted: true, usedFallback: false,
              decisionLog: [...log] };
          }
        } catch (err) {
          log[log.length - 1].outcome = err instanceof Error ? err.message : "Error";
        }
      }
    }
  }

  // ── Phase 3: fallback candidates ──────────────────────────────────────
  let candidates: FallbackCandidate[] = step.fallbackCandidates ?? [];
  const venueAllowed = step.type === "restaurant" ? rst.allowVenueSwitch : htl.allowAreaSwitch;

  // Sort by policy score — best-trusted venue tried first
  if (candidates.length > 1 && policy.hasEnoughData) {
    candidates = sortCandidatesByPolicy(candidates, policy.venueScores);
    candidates.forEach((c, i) => {
      const score = policy.venueScores[c.label] ?? 0;
      const explanation = policyOrderExplanation(c.label, score, i + 1);
      if (score !== 0) {
        log.push({ ts: now(), type: "attempt", message: explanation });
      }
    });
  }

  // Personal tolerance note — warn if behavior diverges from settings
  if (policy.personalTolerance) {
    const note = toleranceNote(policy.personalTolerance, "venue_switched");
    if (note) log.push({ ts: now(), type: "attempt", message: note });
  }

  if (candidates.length > 0 && !venueAllowed) {
    log.push({ ts: now(), type: "skipped",
      message: Explain.venueSwitchBlocked(step.label),
      outcome: "Venue switching is off" });
  } else {
    for (const candidate of candidates) {
      current = { ...current, status: "loading" };
      log.push({ ts: now(), type: "venue_switched",
        message: Explain.venueSwitched(step.label, candidate.label) });
      await onProgress({ ...current, decisionLog: [...log] });

      try {
        const data = await callEndpoint(step.apiEndpoint, candidate.body);
        log[log.length - 1].outcome = data.status === "ready" ? "Booked ✓" :
          data.status === "no_availability" ? "No availability" : (data.error ?? "Error");

        await onProgress({ ...current, decisionLog: [...log] });

        if (data.status === "ready") {
          return { ...current, label: candidate.label, status: "done",
            handoff_url: data.handoff_url, selected_time: data.selected_time,
            usedFallback: true, decisionLog: [...log] };
        }

        // Also try time fallbacks for restaurant candidates
        if (step.type === "restaurant" && data.status === "no_availability" &&
            rst.timeWindowMinutes > 0) {
          const candTime = typeof candidate.body.time === "string" ? candidate.body.time : baseTime;
          const candFallbacks = filterTimeFallbacks(candTime, step.timeFallbacks ?? [], rst);

          for (const altTime of candFallbacks) {
            log.push({ ts: now(), type: "time_adjusted",
              message: Explain.timeAdjusted(candidate.label, candTime, altTime, rst.timeWindowMinutes) });

            try {
              const altData = await callEndpoint(step.apiEndpoint, { ...candidate.body, time: altTime });
              log[log.length - 1].outcome = altData.status === "ready" ? "Booked ✓" : (altData.error ?? "No availability");
              log[log.length - 1].type = altData.status === "ready" ? "succeeded" : "time_adjusted";

              await onProgress({ ...current, decisionLog: [...log] });

              if (altData.status === "ready") {
                return { ...current, label: candidate.label, status: "done",
                  handoff_url: altData.handoff_url, selected_time: altData.selected_time,
                  usedFallback: true, timeAdjusted: true, decisionLog: [...log] };
              }
            } catch { /* continue */ }
          }
        }
      } catch (err) {
        log[log.length - 1].outcome = err instanceof Error ? err.message : "Error";
      }
    }
  }

  // ── Phase 4: all failed — actionItem ──────────────────────────────────
  const triedCount = 1 + (step.timeFallbacks?.length ?? 0) + candidates.length;
  log.push({ ts: now(), type: "failed",
    message: Explain.allFailed(step.label, triedCount),
    outcome: "Needs your attention" });

  const manualOptions = [
    { label: step.label, url: step.fallbackUrl },
    ...candidates.map((c) => ({ label: c.label, url: c.fallbackUrl })),
  ].filter((o) => o.url);

  return {
    ...current,
    status: "error",
    handoff_url: step.fallbackUrl,
    actionItem: manualOptions.length > 0
      ? {
          message: manualOptions.length === 1
            ? "Auto-booking failed. Tap to complete manually:"
            : "Auto-booking failed. Choose one of these to book manually:",
          options: manualOptions,
        }
      : undefined,
    decisionLog: [...log],
  };
}

// ── Universal step via Stagehand browser executor ─────────────────────────

async function runUniversalStep(
  step: BookingJobStep,
  onProgress: (s: BookingJobStep) => Promise<void>
): Promise<BookingJobStep> {
  const log: DecisionLogEntry[] = [];
  await onProgress({ ...step, status: "loading", decisionLog: log });

  try {
    const res = await fetch(`${BASE_URL}/api/booking-autopilot/universal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step.body),
    });

    let data: BrowserTaskResult;
    try {
      data = await res.json() as BrowserTaskResult;
    } catch (parseErr) {
      const rawText = await res.text().catch(() => "(empty body)");
      const errMsg = `Autopilot API returned non-JSON (HTTP ${res.status}): ${rawText.slice(0, 400)}`;
      await writeAgentLog({
        session_id: "",
        job_id: step.label,
        level: "error",
        source: "start-route/universal",
        message: errMsg,
        details: { status: res.status, rawText: rawText.slice(0, 1000) },
      });
      throw new Error(errMsg);
    }

    if (data.status === "completed" || data.status === "paused_payment") {
      log.push({ ts: now(), type: "succeeded", message: data.summary, outcome: "Done ✓" });
      return {
        ...step,
        status: data.status === "paused_payment" ? "awaiting_confirmation" : "done",
        handoff_url: data.handoffUrl,
        decisionLog: log,
      };
    }

    if (data.status === "no_availability") {
      log.push({ ts: now(), type: "skipped", message: "No availability found", outcome: "No availability" });
      return { ...step, status: "no_availability", error: data.summary, decisionLog: log };
    }

    log.push({ ts: now(), type: "failed", message: data.error ?? data.summary, outcome: "Failed" });
    return {
      ...step,
      status: "error",
      error: data.error ?? data.summary,
      handoff_url: step.fallbackUrl,
      actionItem: { message: "Auto-booking failed. Tap to complete manually:", options: [{ label: step.label, url: step.fallbackUrl }] },
      decisionLog: log,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error";
    log.push({ ts: now(), type: "failed", message: errMsg, outcome: "Error" });
    return { ...step, status: "error", error: errMsg, decisionLog: log };
  }
}

// ── Activity step via agent-runtime skill ─────────────────────────────────

async function runActivityStep(
  step: BookingJobStep,
  ctx: SkillContext,
  onProgress: (s: BookingJobStep) => Promise<void>
): Promise<BookingJobStep> {
  const log: DecisionLogEntry[] = [];
  const withLog = { ...ctx, log: (e: Omit<DecisionLogEntry, "ts">) => log.push({ ...e, ts: new Date().toISOString() } as DecisionLogEntry) };

  await onProgress({ ...step, status: "loading", decisionLog: log });

  const outcome = await findActivitySkill.execute(
    step.body as Parameters<typeof findActivitySkill.execute>[0],
    withLog
  );

  if (outcome.status === "succeeded" || outcome.status === "adjusted" || outcome.status === "fallback") {
    log.push({ ts: new Date().toISOString(), type: "succeeded",
      message: `Found ${outcome.result.entityLabel}`, outcome: "Ready ✓" });
    return {
      ...step, status: "done",
      handoff_url: outcome.result.handoffUrl,
      selected_time: outcome.result.scheduledAt,
      usedFallback: outcome.status === "fallback",
      decisionLog: log,
    };
  }

  if (outcome.status === "blocked") {
    log.push({ ts: new Date().toISOString(), type: "skipped",
      message: outcome.reason, outcome: "No availability" });
    return {
      ...step, status: "no_availability", error: outcome.reason,
      actionItem: { message: outcome.actionItem ?? outcome.reason, options: [] },
      decisionLog: log,
    };
  }

  log.push({ ts: new Date().toISOString(), type: "failed", message: outcome.reason, outcome: "Error" });
  return { ...step, status: "error", error: outcome.reason, decisionLog: log };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const job = await getBookingJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  // Allow re-running failed jobs (e.g. after a scheduled retry or user-triggered retry)
  if (job.status === "running") {
    return NextResponse.json({ error: "Job already running" }, { status: 409 });
  }

  // Use the autonomy settings saved at job-creation time, fall back to defaults
  const autonomy: AgentAutonomySettings = job.autonomy_settings ?? DEFAULT_AUTONOMY;

  // Load policy bias + preference profile for this session
  let policy: PolicyBias;
  let events: Awaited<ReturnType<typeof getAgentFeedbackEvents>> = [];
  try {
    events = await getAgentFeedbackEvents(job.session_id, 500);
    policy = computePolicyBias(events);
  } catch {
    policy = computePolicyBias([]); // safe fallback — no bias applied
  }
  const profile = buildPreferenceProfile(events);

  await updateBookingJobStatus(id, "running");

  // Shared skill context for agent-runtime dispatched steps (activity, etc.)
  const skillCtx: SkillContext = {
    jobId: id,
    sessionId: job.session_id,
    tripLabel: job.trip_label,
    autonomy,
    policy,
    profile,
    relationship: null,
    baseUrl: BASE_URL,
    log: () => {}, // fire-and-forget; step logs are written via onProgress
  };

  const steps: BookingJobStep[] = [...job.steps];

  for (let i = 0; i < steps.length; i++) {
    // Skip steps that already succeeded — supports partial retry (cron/manual)
    if (steps[i].status === "done") continue;

    // Snapshot before execution — needed for replan trigger detection
    const stepBefore = { ...steps[i] };

    const onProgress = async (updated: BookingJobStep) => {
      steps[i] = updated;
      await updateBookingJobSteps(id, steps);
    };

    // ── Dispatch: universal → Stagehand, activity → agent-runtime, rest → recovery loop ──
    if (steps[i].type === "universal") {
      steps[i] = await runUniversalStep(steps[i], onProgress);
    } else if ((steps[i].type as string) === "activity") {
      steps[i] = await runActivityStep(steps[i], skillCtx, onProgress);
    } else {
      steps[i] = await runStepWithRecovery(steps[i], autonomy, policy, onProgress);
    }
    await updateBookingJobSteps(id, steps);

    // ── Scene-level replan ─────────────────────────────────────────────
    // Check if this step's outcome should cascade to downstream steps.
    const triggers = detectReplanTriggers(stepBefore, steps[i], i);
    for (const trigger of triggers) {
      const replan = computeReplan(steps, trigger, autonomy);
      if (replan && replan.affectedCount > 0) {
        // Reconstruct steps array with mutations applied
        const replanned = applyReplan(steps, replan);
        for (let j = 0; j < replanned.length; j++) {
          steps[j] = replanned[j];
        }
        await updateBookingJobSteps(id, steps);
      }
    }
  }

  const doneCount = steps.filter((s) => s.status === "done").length;
  const finalStatus = doneCount > 0 ? "done" : "failed";
  await updateBookingJobStatus(id, finalStatus, new Date());

  // ── Auto-create monitors ──────────────────────────────────────────────
  // Availability watches for failed steps, reservation checks for booked ones,
  // weather alerts for trips within 14 days. Fire-and-forget.
  try {
    const monitors = buildAutoMonitors(
      { id, session_id: job.session_id, trip_label: job.trip_label },
      steps
    );
    await Promise.allSettled(monitors.map((m) => createBookingMonitor(m)));
  } catch { /* monitor setup never blocks the job response */ }

  // ── Push notification ────────────────────────────────────────────────
  try {
    const subscriptions = await getPushSubscriptionsBySession(job.session_id);
    const needsAttention = steps.filter((s) => s.actionItem).length;
    const adjusted = steps.filter((s) => s.timeAdjusted || s.usedFallback).length;

    let title: string, body: string;
    if (doneCount === steps.length) {
      const note = adjusted > 0 ? ` (${adjusted} smart adjustment${adjusted > 1 ? "s" : ""})` : "";
      title = "✈ Your trip is ready to book!";
      body = `All ${steps.length} bookings pre-filled${note} — tap to open and pay.`;
    } else if (doneCount > 0 && needsAttention > 0) {
      const emojis = steps.filter((s) => s.status === "done").map((s) => s.emoji).join(" ");
      title = `${emojis} Partially booked — action needed`;
      body = `${doneCount}/${steps.length} ready. ${needsAttention} step${needsAttention > 1 ? "s need" : " needs"} your decision.`;
    } else if (doneCount > 0) {
      title = "Trip booking update";
      body = `${doneCount}/${steps.length} bookings pre-filled — tap to see.`;
    } else {
      title = "Trip booking needs attention";
      body = "Autopilot couldn't complete any steps. Tap to book manually.";
    }

    await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPushNotification(sub.push_subscription as PushSubscription, { title, body, url: "/tasks" })
      )
    );
  } catch { /* push failure never blocks */ }

  return NextResponse.json({ jobId: id, status: finalStatus, steps });
}

// ── Utility ────────────────────────────────────────────────────────────────

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
