/**
 * Skill: search_flight
 *
 * Wraps the existing flight autopilot endpoint.
 * Returns a Kayak/Google Flights handoff URL rather than a direct booking.
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";

export interface SearchFlightInput extends Record<string, unknown> {
  origin: string;       // airport code or city
  destination: string;  // airport code or city
  departDate: string;   // ISO date
  returnDate?: string;  // ISO date (for round trips)
  passengers: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  maxBudget?: number;
  notes?: string;
}

export const searchFlightSkill: Skill<SearchFlightInput> = {
  id: "search_flight",
  label: "Find flights",
  emoji: "✈️",
  stepType: "flight",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, jobId, sessionId } = ctx;

    ctx.log({
      type: "attempt",
      message: `Searching flights ${input.origin}→${input.destination} on ${input.departDate}`,
    });

    const body = {
      origin: input.origin,
      destination: input.destination,
      departDate: input.departDate,
      returnDate: input.returnDate,
      passengers: input.passengers,
      cabinClass: input.cabinClass ?? "economy",
      maxBudget: input.maxBudget,
      notes: input.notes,
      jobId,
      sessionId,
    };

    try {
      const res = await fetch(`${baseUrl}/api/autopilot/flight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctx.signal,
      });

      if (!res.ok) {
        return { status: "failed", reason: `HTTP ${res.status} from flight autopilot` };
      }

      const data = await res.json() as {
        status: string;
        airline?: string;
        flightNumber?: string;
        departTime?: string;
        arriveTime?: string;
        handoffUrl?: string;
        price?: number;
        error?: string;
        actionItem?: string;
      };

      if (data.status === "ready" || data.status === "done") {
        const entityLabel = data.airline
          ? `${data.airline} ${data.flightNumber ?? ""}`.trim()
          : `${input.origin}→${input.destination}`;

        const result = {
          summary: `Found ${entityLabel} departing ${data.departTime ?? input.departDate}`,
          entityLabel,
          handoffUrl: data.handoffUrl,
          scheduledAt: data.departTime
            ? `${input.departDate}T${data.departTime}`
            : `${input.departDate}T00:00`,
          provider: "Kayak",
          meta: {
            origin: input.origin,
            destination: input.destination,
            departDate: input.departDate,
            returnDate: input.returnDate,
            price: data.price,
          },
        };
        return { status: "succeeded", result };
      }

      if (data.actionItem) {
        return {
          status: "blocked",
          reason: data.error ?? "No flights found",
          actionItem: data.actionItem,
        };
      }

      return { status: "failed", reason: data.error ?? "Unknown flight autopilot error" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "blocked", reason: "Execution cancelled" };
      }
      return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  },

  getFallbackStrategies(_reason: string, _ctx: SkillContext): RecoveryStrategy[] {
    return [
      {
        type: "retry_alternative",
        priority: 1,
        params: { nearbyDates: true },
        description: "Search ±1 day for better availability or price",
      },
      {
        type: "escalate_to_user",
        priority: 10,
        description: "Open Kayak/Google Flights for manual selection",
      },
    ];
  },
};
