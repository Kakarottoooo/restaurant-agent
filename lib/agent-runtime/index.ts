/**
 * Agent Runtime — public API
 *
 * Usage:
 *
 *   import { registerSkill, buildTask, runTask } from "@/lib/agent-runtime";
 *   import { reserveRestaurantSkill } from "@/lib/agent-runtime/skills/reserve-restaurant";
 *
 *   registerSkill(reserveRestaurantSkill);
 *
 *   const task = dateNightScenario.build({ restaurantName: "Masa", ... });
 *   const result = await runTask(task, ctx);
 */

// Core execution
export { runTask } from "./runner";

// Registry
export { registerSkill, getSkill, listSkills, overrideSkill } from "./registry";

// Types
export type {
  Skill,
  SkillContext,
  SkillResult,
  StepOutcome,
  RecoveryStrategy,
  RecoveryType,
  VerifyResult,
  TaskDef,
  TaskStepDef,
  ScenarioBuilder,
  StepRunResult,
  TaskRunResult,
} from "./types";

// Built-in skills
export { reserveRestaurantSkill } from "./skills/reserve-restaurant";
export { searchHotelSkill } from "./skills/search-hotel";
export { searchFlightSkill } from "./skills/search-flight";
export { findActivitySkill } from "./skills/find-activity";

export type { ReserveRestaurantInput } from "./skills/reserve-restaurant";
export type { SearchHotelInput } from "./skills/search-hotel";
export type { SearchFlightInput } from "./skills/search-flight";
export type { FindActivityInput } from "./skills/find-activity";

// Built-in scenarios
export { dateNightScenario } from "./scenarios/date-night";
export type { DateNightParams } from "./scenarios/date-night";

// Bootstrap — call once at app startup (e.g., in a layout or server component) to register all built-in skills
export function bootstrapRuntime() {
  const { registerSkill, getSkill } = require("./registry");
  const skills = [
    require("./skills/reserve-restaurant").reserveRestaurantSkill,
    require("./skills/search-hotel").searchHotelSkill,
    require("./skills/search-flight").searchFlightSkill,
    require("./skills/find-activity").findActivitySkill,
  ];
  for (const skill of skills) {
    if (!getSkill(skill.id)) registerSkill(skill);
  }
}
