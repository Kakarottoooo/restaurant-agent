import { SessionPreferences, ScoringDimensions } from "../../types";
import { minimaxChat } from "../../minimax";

// ─── Phase 3.2: Weighted Scoring ─────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  budget_match: 0.25,
  scene_match: 0.30,
  review_quality: 0.20,
  location_convenience: 0.15,
  preference_match: 0.10,
};

export function computeWeightedScore(
  dimensions: Omit<ScoringDimensions, "weighted_total">,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): number {
  const raw =
    dimensions.budget_match * weights.budget_match +
    dimensions.scene_match * weights.scene_match +
    dimensions.review_quality * weights.review_quality +
    dimensions.location_convenience * weights.location_convenience +
    dimensions.preference_match * weights.preference_match;
  const penalized = raw - dimensions.red_flag_penalty;
  return Math.round(Math.max(0, Math.min(10, penalized)) * 10) / 10;
}

// ─── Phase 3.3a: Session Preference Extraction ───────────────────────────────

export async function extractRefinements(
  newMessage: string,
  currentPreferences: SessionPreferences
): Promise<SessionPreferences> {
  try {
    const text = await minimaxChat({
      messages: [
        {
          role: "user",
          content: `You are updating a user preference profile based on their latest refinement message.
Current preferences: ${JSON.stringify(currentPreferences)}
New message: "${newMessage}"

Extract any preference updates implied by the message. Return ONLY updated preferences JSON with the same schema.
Only update fields that are clearly implied. Do not invent preferences.
Examples:
- "more quiet" → noise_preference: "quiet"
- "cheaper options" → budget_ceiling reduced by ~30%
- "no chains please" → exclude_chains: true
- "remove Thai from results" → excluded_cuisines: [..., "Thai"]

Return the full updated JSON object.`,
        },
      ],
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return currentPreferences;
    const updated = JSON.parse(jsonMatch[0]);
    return {
      ...currentPreferences,
      ...updated,
      refined_from_query_count: currentPreferences.refined_from_query_count + 1,
    };
  } catch {
    return currentPreferences;
  }
}

export function formatSessionPreferences(prefs: SessionPreferences): string {
  const parts: string[] = [];
  if (prefs.noise_preference) parts.push(`Noise preference: ${prefs.noise_preference}`);
  if (prefs.budget_ceiling) parts.push(`Budget ceiling: $${prefs.budget_ceiling}/person`);
  if (prefs.exclude_chains) parts.push("Exclude chains: yes");
  if (prefs.excluded_cuisines.length > 0)
    parts.push(`Excluded cuisines: ${prefs.excluded_cuisines.join(", ")}`);
  if (prefs.required_features.length > 0)
    parts.push(`Required features: ${prefs.required_features.join(", ")}`);
  if (prefs.occasion) parts.push(`Occasion: ${prefs.occasion}`);
  return parts.length > 0
    ? `User session preferences (accumulated from conversation):\n${parts.map((p) => `- ${p}`).join("\n")}\nPlease factor these into your recommendations.`
    : "";
}

// ─── Phase 7.1: Two-layer Intent Architecture ────────────────────────────────

export const HOTEL_DEFAULT_WEIGHTS = {
  budget_match: 0.30,
  scene_match: 0.25,
  review_quality: 0.20,
  location_convenience: 0.20,
  preference_match: 0.05,
};
