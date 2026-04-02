/**
 * Skill: find_activity
 *
 * New skill type — not in the original booking system.
 * Finds local activities/experiences: tours, museums, shows, cooking classes, etc.
 *
 * Sources (searched in priority order):
 *   1. GetYourGuide API (if key available)
 *   2. Google Places (type: tourist_attraction / event)
 *   3. Eventbrite (fallback)
 *
 * Returns a handoff URL for the user to complete booking.
 * This demonstrates adding a net-new capability without touching runner/policy/replan.
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";

export interface FindActivityInput extends Record<string, unknown> {
  destination: string;
  date: string;          // ISO date
  category?: string;     // "food_tour" | "museum" | "outdoor" | "show" | "class" | "sightseeing"
  partySize?: number;
  maxBudgetPerPerson?: number;
  durationHours?: number;
  notes?: string;
  /** Specific venue or experience name to target */
  targetName?: string;
}

export const findActivitySkill: Skill<FindActivityInput> = {
  id: "find_activity",
  label: "Find activity",
  emoji: "🎭",
  stepType: "activity",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, relationship } = ctx;

    ctx.log({
      type: "attempt",
      message: `Finding ${input.category ?? "activity"} in ${input.destination} on ${input.date}`,
    });

    // Apply relationship constraints — e.g. "needs parking", "vegetarian", "quiet venue"
    const constraints = relationship?.constraints ?? [];
    const avoidTypes  = relationship?.avoid_types ?? [];

    const body = {
      destination: input.destination,
      date: input.date,
      category: input.category,
      partySize: input.partySize ?? 2,
      maxBudgetPerPerson: input.maxBudgetPerPerson,
      durationHours: input.durationHours,
      notes: [input.notes, ...constraints].filter(Boolean).join("; "),
      avoidTypes,
      targetName: input.targetName,
    };

    try {
      const res = await fetch(`${baseUrl}/api/autopilot/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });

      if (!res.ok) {
        // Activity endpoint is optional — degrade gracefully
        return buildGooglePlacesFallback(input, ctx);
      }

      const data = await res.json() as {
        status: string;
        activityName?: string;
        provider?: string;
        handoffUrl?: string;
        startTime?: string;
        pricePerPerson?: number;
        error?: string;
      };

      if (data.status === "ready" || data.status === "done") {
        const entityLabel = data.activityName ?? input.category ?? "Activity";
        return {
          status: "succeeded",
          result: {
            summary: `Found ${entityLabel} on ${input.date}${data.startTime ? ` at ${data.startTime}` : ""}`,
            entityLabel,
            handoffUrl: data.handoffUrl,
            scheduledAt: data.startTime ? `${input.date}T${data.startTime}` : `${input.date}T10:00`,
            provider: data.provider ?? "GetYourGuide",
            meta: { pricePerPerson: data.pricePerPerson, destination: input.destination },
          },
        };
      }

      return buildGooglePlacesFallback(input, ctx);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "blocked", reason: "Execution cancelled" };
      }
      // Activities are optional — block rather than hard fail
      return {
        status: "blocked",
        reason: err instanceof Error ? err.message : "Activity search unavailable",
        actionItem: `Browse GetYourGuide or Viator for ${input.category ?? "activities"} in ${input.destination}`,
      };
    }
  },

  getFallbackStrategies(_reason: string, _ctx: SkillContext): RecoveryStrategy[] {
    return [
      {
        type: "retry_alternative",
        priority: 1,
        description: "Try a different activity category",
      },
      {
        type: "escalate_to_user",
        priority: 5,
        description: "Browse GetYourGuide / Viator manually",
      },
    ];
  },
};

/** Build a Google Places search link as a graceful fallback when no booking API is available. */
function buildGooglePlacesFallback(input: FindActivityInput, _ctx: SkillContext): StepOutcome {
  const query = encodeURIComponent(
    `${input.category ?? "activities"} ${input.destination} ${input.date}`
  );
  const handoffUrl = `https://www.google.com/search?q=${query}`;
  return {
    status: "fallback",
    result: {
      summary: `Search for ${input.category ?? "activities"} in ${input.destination}`,
      entityLabel: `${input.category ?? "Activity"} in ${input.destination}`,
      handoffUrl,
      provider: "Google Search",
    },
    fallbackLabel: "Google Search",
  };
}
