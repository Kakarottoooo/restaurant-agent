/**
 * Skill: reserve_restaurant
 *
 * Wraps the existing restaurant autopilot endpoint.
 * Handles: primary attempt → time fallbacks → venue switch (allowVenueSwitch).
 *
 * Input shape mirrors the existing BookingJobStep.body for restaurants.
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";

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
}

export const reserveRestaurantSkill: Skill<ReserveRestaurantInput> = {
  id: "reserve_restaurant",
  label: "Reserve restaurant",
  emoji: "🍽️",
  stepType: "restaurant",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, autonomy, policy, jobId, sessionId } = ctx;
    const rst = autonomy.restaurant;

    ctx.log({
      type: "attempt",
      message: `Reserving ${input.venueName} on ${input.date} at ${input.time} for ${input.partySize}`,
    });

    // Sort fallbacks by policy bias
    const candidates = sortByPolicy(input.fallbackCandidates ?? [], policy);

    const body = {
      venueName: input.venueName,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      cuisine: input.cuisine,
      location: input.location,
      notes: input.notes,
      fallbackCandidates: candidates,
      autonomySettings: rst,
      jobId,
      sessionId,
    };

    try {
      const res = await fetch(`${baseUrl}/api/autopilot/restaurant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });

      if (!res.ok) {
        return { status: "failed", reason: `HTTP ${res.status} from restaurant autopilot` };
      }

      const data = await res.json() as {
        status: string;
        venueName?: string;
        time?: string;
        handoffUrl?: string;
        usedFallback?: boolean;
        fallbackLabel?: string;
        error?: string;
        actionItem?: string;
      };

      if (data.status === "ready" || data.status === "done") {
        const entityLabel = data.venueName ?? input.venueName;
        const handoffUrl  = data.handoffUrl;
        const result = {
          summary: `Booked ${entityLabel} at ${data.time ?? input.time}`,
          entityLabel,
          handoffUrl,
          scheduledAt: `${input.date}T${data.time ?? input.time}`,
          usedFallback: data.usedFallback,
          provider: "OpenTable",
        };

        if (data.usedFallback && data.fallbackLabel) {
          return { status: "fallback", result, fallbackLabel: data.fallbackLabel };
        }
        if (data.time && data.time !== input.time) {
          return { status: "adjusted", result, adjustment: `Time shifted to ${data.time}` };
        }
        return { status: "succeeded", result };
      }

      if (data.status === "blocked" || data.actionItem) {
        return {
          status: "blocked",
          reason: data.error ?? "No availability found",
          actionItem: data.actionItem ?? "Book manually",
          retryAfter: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        };
      }

      return { status: "failed", reason: data.error ?? "Unknown restaurant autopilot error" };
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

function sortByPolicy(
  candidates: Array<{ name: string; address?: string; rating?: number }>,
  policy: import("@/lib/policy").PolicyBias
): typeof candidates {
  // Apply negative memory — demote consistently rejected venues
  return candidates
    .map((c) => {
      const negScore = policy.venueScores?.[c.name] ?? 0;
      return { ...c, _score: (c.rating ?? 3) + negScore };
    })
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .map(({ _score: _s, ...c }) => c);
}
