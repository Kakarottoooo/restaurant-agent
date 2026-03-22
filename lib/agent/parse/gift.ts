import { GiftIntent, GiftOccasion, GiftRelationship, MultilingualQueryContext } from "../../types";

// ─── Occasion detection ───────────────────────────────────────────────────────

const OCCASION_PATTERNS: Array<[RegExp, GiftOccasion]> = [
  [/\bbirthday\b/, "birthday"],
  [/\banniversary\b/, "anniversary"],
  [/\bchristmas\b|\bxmas\b/, "christmas"],
  [/\bvalentine\b/, "valentines"],
  [/\bmother'?s?\s*day\b|\bmom'?s?\s*day\b/, "mothers_day"],
  [/\bfather'?s?\s*day\b|\bdad'?s?\s*day\b/, "fathers_day"],
  [/\bgraduat(?:ion|e)\b/, "graduation"],
  [/\bwedding\b/, "wedding"],
  [/\bhousewarming\b/, "housewarming"],
];

function detectOccasion(lower: string): GiftOccasion | undefined {
  for (const [pattern, occasion] of OCCASION_PATTERNS) {
    if (pattern.test(lower)) return occasion;
  }
  return undefined;
}

// ─── Relationship detection ───────────────────────────────────────────────────

const RELATIONSHIP_PATTERNS: Array<[RegExp, GiftRelationship, string]> = [
  [/\b(?:my\s+)?(?:boy|girl)friend\b|\bpartner\b|\bsignificant other\b|\bspouse\b|\bhusband\b|\bwife\b/, "partner", "partner"],
  [/\b(?:my\s+)?mom\b|\b(?:my\s+)?mother\b/, "parent", "mom"],
  [/\b(?:my\s+)?dad\b|\b(?:my\s+)?father\b/, "parent", "dad"],
  [/\b(?:my\s+)?sister\b|\b(?:my\s+)?brother\b|\bsibling\b/, "sibling", "sibling"],
  [/\b(?:my\s+)?(?:best\s+)?friend\b/, "friend", "friend"],
  [/\b(?:my\s+)?colleague\b|\b(?:my\s+)?coworker\b|\b(?:my\s+)?workmate\b/, "colleague", "colleague"],
  [/\b(?:my\s+)?boss\b|\b(?:my\s+)?manager\b/, "boss", "boss"],
  [/\b(?:my\s+)?(?:son|daughter|kid|child)\b/, "child", "child"],
];

function detectRelationshipAndRecipient(message: string): {
  relationship?: GiftRelationship;
  recipient?: string;
} {
  for (const [pattern, rel, label] of RELATIONSHIP_PATTERNS) {
    if (pattern.test(message.toLowerCase())) {
      return { relationship: rel, recipient: label };
    }
  }
  // Try to extract "for X" pattern
  const forMatch = /\bfor\s+(?:my\s+)?([a-zA-Z]{2,20})\b/.exec(message);
  if (forMatch) {
    return { recipient: forMatch[1].toLowerCase() };
  }
  return {};
}

// ─── Interest extraction ──────────────────────────────────────────────────────

const INTEREST_KEYWORDS: Array<[RegExp, string]> = [
  [/\bcooking\b|\bchef\b|\bfood\b|\bbaker\b/, "cooking"],
  [/\bhiking\b|\boutdoors?\b|\bcamping\b/, "hiking"],
  [/\bgaming\b|\bgamer\b|\bvideo games?\b/, "gaming"],
  [/\bfitness\b|\bgym\b|\bworkout\b|\byoga\b/, "fitness"],
  [/\breading\b|\bbooks?\b|\bbooklover\b/, "reading"],
  [/\bmusic\b|\bmusician\b|\blistening\b/, "music"],
  [/\btravel(?:ling|er)?\b|\btraveler\b/, "travel"],
  [/\bphotograph(?:y|er)\b/, "photography"],
  [/\btech\b|\bgadget\b/, "tech"],
  [/\bbeauty\b|\bskincare\b|\bmakeup\b/, "beauty"],
  [/\bwine\b|\bwhiskey\b|\bcocktail\b/, "drinks"],
  [/\bpet\b|\bdog lover\b|\bcat lover\b/, "pets"],
  [/\bgarden(?:ing)?\b/, "gardening"],
  [/\bart\b|\bpainting\b|\bdrawing\b/, "art"],
  [/\bsport\b|\bathletic\b/, "sports"],
];

function extractInterests(lower: string): string[] {
  const found: string[] = [];
  for (const [pattern, interest] of INTEREST_KEYWORDS) {
    if (pattern.test(lower)) found.push(interest);
  }
  return found;
}

// ─── Budget extraction ────────────────────────────────────────────────────────

function extractBudget(lower: string): number | undefined {
  const match =
    lower.match(/\$\s*(\d[\d,]*)\b/) ??
    lower.match(/(\d[\d,]+)\s*(?:usd|dollars?)/i) ??
    lower.match(/under\s+\$?\s*(\d[\d,]+)/i) ??
    lower.match(/(?:budget|spend|max)\s+(?:of\s+)?\$?\s*(\d[\d,]+)/i);
  if (!match) return undefined;
  const n = parseInt(match[1].replace(/,/g, ""), 10);
  return isNaN(n) ? undefined : n;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseGiftIntent(
  userMessage: string,
  queryContext: MultilingualQueryContext
): GiftIntent {
  const lower = userMessage.toLowerCase();

  const occasion = detectOccasion(lower);
  const { relationship, recipient } = detectRelationshipAndRecipient(userMessage);
  const interests = extractInterests(lower);
  const budget_usd_max =
    extractBudget(lower) ??
    queryContext.budget_total_hint ??
    queryContext.budget_per_person_hint;

  const missingFields: string[] = [];
  if (!recipient && !relationship) missingFields.push("recipient");
  if (!budget_usd_max) missingFields.push("budget");

  const assumptions: string[] = [];
  if (recipient) assumptions.push(`Gift for: ${recipient}`);
  if (occasion) assumptions.push(`Occasion: ${occasion.replace("_", " ")}`);
  if (interests.length > 0) assumptions.push(`Interests: ${interests.join(", ")}`);
  if (budget_usd_max) assumptions.push(`Budget: up to $${budget_usd_max}`);

  const recipientLabel = recipient ?? "someone special";
  const occasionLabel = occasion ? ` for ${occasion.replace("_", " ")}` : "";

  return {
    category: "gift",
    scenario: "gift",
    scenario_goal: `Find the perfect gift${occasionLabel} for ${recipientLabel}`,
    recipient,
    relationship,
    occasion,
    interests: interests.length > 0 ? interests : undefined,
    budget_usd_max,
    planning_assumptions: assumptions,
    needs_clarification: missingFields.length > 0,
    missing_fields: missingFields,
  };
}
