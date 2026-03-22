import { PlanAction, PlanLinkAction } from "../../types";

/**
 * Converts PlanLinkAction[] (secondary_actions on a PlanOption) into
 * PlanAction[type="open_link"] entries suitable for inclusion in next_actions.
 *
 * The outcome_action is derived from the link id using a stable mapping:
 *   open-map       → "maps_open"
 *   add-calendar   → "calendar_add"
 *   open-flight    → "flight_open"
 *   open-hotel     → "hotel_open"
 *   open-amazon    → "amazon_purchase"
 *   (fallback)     → link id with hyphens replaced by underscores
 */
const LINK_ID_TO_OUTCOME: Record<string, string> = {
  "open-map": "maps_open",
  "add-calendar": "calendar_add",
  "open-flight": "flight_open",
  "open-hotel": "hotel_open",
  "open-amazon": "amazon_purchase",
};

export function mapLinksToOpenLinkActions(links: PlanLinkAction[]): PlanAction[] {
  return links.map((link) => ({
    id: link.id,
    type: "open_link" as const,
    label: link.label,
    description: link.label,
    url: link.url,
    outcome_action: LINK_ID_TO_OUTCOME[link.id] ?? link.id.replace(/-/g, "_"),
  }));
}
