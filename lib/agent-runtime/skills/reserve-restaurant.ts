/**
 * Skill: reserve_restaurant
 *
 * Uses the universal Stagehand browser executor to book a restaurant on any site.
 * Handles: primary attempt → time fallbacks → venue switch (allowVenueSwitch).
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";
import type { BrowserTaskResult } from "@/lib/booking-autopilot/types";
import { buildRestaurantTask } from "@/lib/booking-autopilot/stagehand-executor";

export interface ReserveRestaurantInput extends Record<string, unknown> {
  venueName: string;
  date: string;             // ISO date "2025-03-15"
  time: string;             // "19:00"
  partySize: number;
  cuisine?: string;
  location?: string;
  notes?: string;
  /** Pre-ranked fallback venues from the planner */
  fallbackCandidates?: Array<{ name: string; address?: string; rating?: number }>;
  /** Booking profile — name/email/phone for form filling */
  bookingProfile?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

export const reserveRestaurantSkill: Skill<ReserveRestaurantInput> = {
  id: "reserve_restaurant",
  label: "Reserve restaurant",
  emoji: "🍽️",
  stepType: "restaurant",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, autonomy, policy, jobId } = ctx;
    const rst = autonomy.restaurant;

    ctx.log({
      type: "attempt",
      message: `Reserving ${input.venueName} on ${input.date} at ${input.time} for ${input.partySize}`,
    });

    // Sort fallbacks by policy bias
    const candidates = sortByPolicy(input.fallbackCandidates ?? [], policy);

    // Build booking profile — use provided profile or empty placeholders
    const profile = input.bookingProfile ?? {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    };

    // Build OpenTable search URL as the starting point
    const otUrl = `https://www.opentable.com/s?term=${encodeURIComponent(input.venueName)}&covers=${input.partySize}&dateTime=${input.date}T${input.time}:00`;

    const { task } = buildRestaurantTask({
      restaurantName: input.venueName,
      city: input.location ?? "",
      date: input.date,
      time: input.time,
      covers: input.partySize,
      profile,
    });

    // Append fallback context if we have alternatives
    const taskWithFallbacks = candidates.length > 0
      ? `${task}\n\nIf ${input.venueName} has no availability, try one of these alternatives: ${candidates.map(c => c.name).join(", ")}.`
      : task;

    try {
      const res = await fetch(`${baseUrl}/api/booking-autopilot/universal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrl: otUrl,
          task: taskWithFallbacks,
          profile,
          jobId,
          stepIndex: 0,
        }),
        signal: ctx.signal,
      });

      if (!res.ok) {
        return { status: "failed", reason: `HTTP ${res.status} from universal autopilot` };
      }

      const data = await res.json() as BrowserTaskResult;

      return mapBrowserResult(data, input.venueName, input.time);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "blocked", reason: "Execution cancelled" };
      }
      return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  },

  getFallbackStrategies(reason: string, ctx: SkillContext): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    const rst = ctx.autonomy.restaurant;

    if (rst.timeWindowMinutes > 0) {
      strategies.push({
        type: "adjust_time",
        priority: 1,
        params: { windowMinutes: rst.timeWindowMinutes },
        description: `Try nearby time slots within ±${rst.timeWindowMinutes} min`,
      });
    }

    if (rst.allowVenueSwitch) {
      strategies.push({
        type: "retry_alternative",
        priority: 2,
        description: "Switch to a similar venue from the fallback list",
      });
    }

    strategies.push({
      type: "schedule_retry",
      priority: 3,
      params: { delayHours: 2 },
      description: "Retry in 2 hours — availability may open up",
    });

    strategies.push({
      type: "escalate_to_user",
      priority: 10,
      description: "Ask user to book manually",
    });

    return strategies;
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapBrowserResult(
  data: BrowserTaskResult,
  venueName: string,
  requestedTime: string
): StepOutcome {
  const result = {
    summary: data.summary,
    entityLabel: venueName,
    handoffUrl: data.handoffUrl,
    screenshotBase64: data.screenshotBase64,
    sessionUrl: data.sessionUrl,
  };

  switch (data.status) {
    case "completed":
      return { status: "succeeded", result };

    case "paused_payment":
      // Agent reached the payment page — user needs to complete payment
      return {
        status: "succeeded",
        result: {
          ...result,
          summary: data.summary,
          requiresPayment: true,
        },
      };

    case "no_availability":
      return {
        status: "blocked",
        reason: "No availability found",
        actionItem: `Book ${venueName} manually`,
        retryAfter: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };

    case "needs_login":
      return {
        status: "blocked",
        reason: "Site requires login",
        actionItem: `Sign in and book ${venueName} manually`,
      };

    case "captcha":
      return {
        status: "blocked",
        reason: "Blocked by anti-bot system",
        actionItem: `Book ${venueName} manually`,
      };

    case "error":
    default:
      return { status: "failed", reason: data.error ?? data.summary };
  }
}

function sortByPolicy(
  candidates: Array<{ name: string; address?: string; rating?: number }>,
  policy: import("@/lib/policy").PolicyBias
): typeof candidates {
  return candidates
    .map((c) => {
      const negScore = policy.venueScores?.[c.name] ?? 0;
      return { ...c, _score: (c.rating ?? 3) + negScore };
    })
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .map(({ _score: _s, ...c }) => c);
}
