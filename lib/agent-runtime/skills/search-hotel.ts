/**
 * Skill: search_hotel
 *
 * Wraps the existing hotel autopilot endpoint.
 * Handles: primary attempt → area switch (allowAreaSwitch).
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";

export interface SearchHotelInput extends Record<string, unknown> {
  destination: string;
  checkIn: string;   // ISO date
  checkOut: string;  // ISO date
  guests: number;
  rooms?: number;
  budget?: string;   // "mid-range" | "luxury" | "budget"
  preferredArea?: string;
  notes?: string;
  fallbackCandidates?: Array<{ name: string; area?: string; stars?: number }>;
}

export const searchHotelSkill: Skill<SearchHotelInput> = {
  id: "search_hotel",
  label: "Book hotel",
  emoji: "🏨",
  stepType: "hotel",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, autonomy, jobId, sessionId } = ctx;
    const htl = autonomy.hotel;

    ctx.log({
      type: "attempt",
      message: `Searching hotels in ${input.destination} ${input.checkIn}→${input.checkOut}`,
    });

    const body = {
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      rooms: input.rooms ?? 1,
      budget: input.budget,
      preferredArea: input.preferredArea,
      notes: input.notes,
      fallbackCandidates: input.fallbackCandidates ?? [],
      autonomySettings: htl,
      jobId,
      sessionId,
    };

    try {
      const res = await fetch(`${baseUrl}/api/autopilot/hotel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });

      if (!res.ok) {
        return { status: "failed", reason: `HTTP ${res.status} from hotel autopilot` };
      }

      const data = await res.json() as {
        status: string;
        hotelName?: string;
        area?: string;
        handoffUrl?: string;
        usedFallback?: boolean;
        fallbackLabel?: string;
        error?: string;
        actionItem?: string;
      };

      if (data.status === "ready" || data.status === "done") {
        const entityLabel = data.hotelName ?? input.destination;
        const result = {
          summary: `Booked ${entityLabel}${data.area ? ` in ${data.area}` : ""}`,
          entityLabel,
          handoffUrl: data.handoffUrl,
          scheduledAt: `${input.checkIn}T14:00`,  // standard check-in time
          usedFallback: data.usedFallback,
          provider: "Booking.com",
          meta: {
            destination: input.destination,
            area: data.area ?? input.preferredArea,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
          },
        };

        if (data.usedFallback && data.fallbackLabel) {
          ctx.log({ type: "venue_switched", message: `Switched to ${data.fallbackLabel}` });
          return { status: "fallback", result, fallbackLabel: data.fallbackLabel };
        }
        return { status: "succeeded", result };
      }

      if (data.actionItem) {
        return {
          status: "blocked",
          reason: data.error ?? "No hotel availability",
          actionItem: data.actionItem,
        };
      }

      return { status: "failed", reason: data.error ?? "Unknown hotel autopilot error" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "blocked", reason: "Execution cancelled" };
      }
      return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  },

  getFallbackStrategies(reason: string, ctx: SkillContext): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    const htl = ctx.autonomy.hotel;

    if (htl.allowAreaSwitch) {
      strategies.push({
        type: "adjust_location",
        priority: 1,
        description: "Try nearby area hotels",
      });
    }

    if ((htl.minStarRating ?? 0) > 0) {
      strategies.push({
        type: "retry_alternative",
        priority: 2,
        params: { relaxStarRating: true },
        description: "Relax star rating and try again",
      });
    }

    strategies.push({
      type: "escalate_to_user",
      priority: 10,
      description: "Ask user to choose hotel manually",
    });

    return strategies;
  },
};
