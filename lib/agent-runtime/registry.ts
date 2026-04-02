/**
 * Skill Registry — register and look up skills by ID.
 *
 * Skills are registered at module load time via `registerSkill()`.
 * The runner resolves them at execution time via `getSkill()`.
 */

import type { Skill } from "./types";

const registry = new Map<string, Skill<any, any>>();  // eslint-disable-line @typescript-eslint/no-explicit-any

export function registerSkill(skill: Skill<any, any>): void {  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (registry.has(skill.id)) {
    throw new Error(`Skill "${skill.id}" is already registered`);
  }
  registry.set(skill.id, skill);
}

export function getSkill(id: string): Skill<any, any> | undefined {  // eslint-disable-line @typescript-eslint/no-explicit-any
  return registry.get(id);
}

export function listSkills(): Skill<any, any>[] {  // eslint-disable-line @typescript-eslint/no-explicit-any
  return [...registry.values()];
}

/**
 * Replace an existing skill (useful in tests or for hot-swapping implementations).
 */
export function overrideSkill(skill: Skill<any, any>): void {  // eslint-disable-line @typescript-eslint/no-explicit-any
  registry.set(skill.id, skill);
}
