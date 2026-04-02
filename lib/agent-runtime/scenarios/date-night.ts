/**
 * Scenario: date_night
 *
 * Demonstrates how a new scenario is pure configuration — no new runner/infra.
 *
 * Steps:
 *   1. (Optional) Pre-dinner activity — cocktail bar, dessert venue
 *   2. Dinner — primary + fallback restaurants
 *   3. (Optional) After-dinner — drinks, dessert, walk recommendation
 *
 * All policy, replan, and recovery handling lives in the runner and skills.
 * This file only describes WHAT to do — not HOW.
 */

import type { ScenarioBuilder, TaskDef, TaskStepDef } from "../types";
import type { ReserveRestaurantInput } from "../skills/reserve-restaurant";
import type { FindActivityInput } from "../skills/find-activity";

export interface DateNightParams {
  /** Target restaurant name */
  restaurantName: string;
  /** Pre-ranked fallback restaurants from the planner */
  fallbackRestaurants?: Array<{ name: string; address?: string; rating?: number }>;
  /** City / neighborhood */
  location: string;
  /** ISO date */
  date: string;
  /** "19:00" format */
  time: string;
  partySize: number;
  /** "romantic" | "intimate" | "upscale" */
  vibe?: string;
  /** "dessert" | "cocktail" | "walk" | "none" | "open" */
  followUp?: string;
  /** Budget tier */
  budget?: "mid-range" | "luxury";
  notes?: string;
}

export const dateNightScenario: ScenarioBuilder<DateNightParams> = {
  id: "date_night",
  label: "Date night",
  description: "Romantic dinner with optional pre/post activities",

  build(params: DateNightParams): TaskDef {
    const steps: TaskStepDef[] = [];

    // ── Step 0 (optional): Pre-dinner cocktails ──────────────────────────
    if (params.followUp === "cocktail" || params.vibe === "intimate") {
      const preActivity: TaskStepDef<FindActivityInput> = {
        skillId: "find_activity",
        label: "Pre-dinner cocktails",
        emoji: "🍸",
        optional: true,
        input: {
          destination: params.location,
          date: params.date,
          category: "cocktail_bar",
          partySize: params.partySize,
          notes: params.notes,
        },
      };
      steps.push(preActivity);
    }

    // ── Step 1: Dinner — the core of every date night ────────────────────
    const dinner: TaskStepDef<ReserveRestaurantInput> = {
      skillId: "reserve_restaurant",
      label: `Dinner at ${params.restaurantName}`,
      emoji: "🍽️",
      input: {
        venueName: params.restaurantName,
        date: params.date,
        time: params.time,
        partySize: params.partySize,
        cuisine: params.vibe === "romantic" ? "French" : undefined,
        location: params.location,
        notes: [
          params.notes,
          params.budget === "luxury" ? "upscale restaurant preferred" : undefined,
          params.vibe ? `vibe: ${params.vibe}` : undefined,
        ].filter(Boolean).join("; "),
        fallbackCandidates: params.fallbackRestaurants,
      },
    };
    steps.push(dinner);

    const dinnerIndex = steps.length - 1;

    // ── Step 2 (optional): After-dinner ─────────────────────────────────
    if (params.followUp && params.followUp !== "none") {
      const followUpCategory =
        params.followUp === "dessert" ? "dessert_cafe" :
        params.followUp === "cocktail" ? "cocktail_bar" :
        params.followUp === "walk" ? "scenic_walk" :
        "bar";

      const afterDinner: TaskStepDef<FindActivityInput> = {
        skillId: "find_activity",
        label: "After-dinner plans",
        emoji: params.followUp === "dessert" ? "🍰" : params.followUp === "walk" ? "🌙" : "🥂",
        optional: true,
        dependsOn: [dinnerIndex],  // only meaningful after dinner succeeds
        input: {
          destination: params.location,
          date: params.date,
          category: followUpCategory,
          partySize: params.partySize,
          notes: params.notes,
        },
      };
      steps.push(afterDinner);
    }

    return {
      id: "date_night",
      label: `Date night — ${params.restaurantName}, ${params.location}`,
      steps,
    };
  },
};
