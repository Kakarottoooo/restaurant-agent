import { minimaxChat } from "./minimax";
import {
  CategoryType,
  InputLanguage,
  MultilingualQueryContext,
  OutputLanguage,
  ScenarioType,
} from "./types";

const LOCATION_ALIAS_RULES: Array<{ pattern: RegExp; location: string }> = [
  { pattern: /\bnyc\b|\bnew york city\b|\bmanhattan\b/i, location: "New York, NY" },
  { pattern: /\bny\b/i, location: "New York, NY" },
  { pattern: /\bla\b/i, location: "Los Angeles, CA" },
  { pattern: /\bsf\b|\bsan francisco\b/i, location: "San Francisco, CA" },
  { pattern: /\bdc\b|\bwashington dc\b|\bwashington, dc\b/i, location: "Washington, DC" },
  { pattern: /\bphilly\b/i, location: "Philadelphia, PA" },
  { pattern: /\bvegas\b|\blas vegas\b/i, location: "Las Vegas, NV" },
  { pattern: /\bchi\b|\bchicago\b/i, location: "Chicago, IL" },
];

const VALID_CATEGORIES: CategoryType[] = [
  "restaurant",
  "hotel",
  "flight",
  "credit_card",
  "laptop",
  "smartphone",
  "headphone",
  "subscription",
  "trip",
  "unknown",
];

const VALID_SCENARIOS: ScenarioType[] = [
  "date_night",
  "weekend_trip",
  "city_trip",
  "big_purchase",
  "concert_event",
  "gift",
];

function inferInputLanguage(message: string): InputLanguage {
  const cjkMatches = message.match(/[\u3040-\u30ff\u3400-\u9fff]/g) ?? [];
  const latinMatches = message.match(/[A-Za-z]/g) ?? [];

  if (cjkMatches.length > 0 && latinMatches.length > 0) return "mixed";
  if (cjkMatches.length > 0) return "zh";
  if (latinMatches.length > 0) return "en";
  if (message.trim().length === 0) return "unknown";
  return "other";
}

function inferOutputLanguage(inputLanguage: InputLanguage): OutputLanguage {
  return inputLanguage === "zh" || inputLanguage === "mixed" ? "zh" : "en";
}

function hasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

function resolveLocationAlias(message: string): string | undefined {
  return LOCATION_ALIAS_RULES.find(({ pattern }) => pattern.test(message))?.location;
}

function normalizeLocation(location: string | undefined): string | undefined {
  if (!location) return undefined;
  const normalized = location.trim();
  if (!normalized) return undefined;
  if (/^nyc?$/i.test(normalized)) return "New York, NY";
  if (/^la$/i.test(normalized)) return "Los Angeles, CA";
  if (/^sf$/i.test(normalized)) return "San Francisco, CA";
  if (/^dc$/i.test(normalized)) return "Washington, DC";
  return normalized;
}

function coerceCategory(value: unknown): CategoryType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as CategoryType;
  return VALID_CATEGORIES.includes(normalized) ? normalized : null;
}

function coerceScenario(value: unknown): ScenarioType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as ScenarioType;
  return VALID_SCENARIOS.includes(normalized) ? normalized : null;
}

function buildFallbackContext(
  message: string,
  fallbackLocation?: string
): MultilingualQueryContext {
  const lower = message.toLowerCase();
  const inputLanguage = inferInputLanguage(message);
  const outputLanguage = inferOutputLanguage(inputLanguage);

  let categoryHint: CategoryType | null = null;
  if (/\bflight\b|\bflights\b|\bairport\b|\bfly\b/.test(lower)) categoryHint = "flight";
  else if (/\bhotel\b|\bhotels\b|\bcheck in\b|\bcheck out\b|\bstay\b/.test(lower)) categoryHint = "hotel";
  else if (/\bcredit card\b|\bcash back\b|\brewards card\b/.test(lower)) categoryHint = "credit_card";
  else if (/\blaptop\b|\bmacbook\b|\bthinkpad\b/.test(lower)) categoryHint = "laptop";
  else if (/\bphone\b|\bsmartphone\b|\biphone\b|\bandroid\b/.test(lower)) categoryHint = "smartphone";
  else if (/\bheadphone\b|\bearbuds\b|\bairpods\b/.test(lower)) categoryHint = "headphone";
  else if (/\brestaurant\b|\bdinner\b|\blunch\b|\bdate\b|\breservation\b/.test(lower)) categoryHint = "restaurant";

  let scenarioHint: ScenarioType | null = null;
  if (/\bweekend\b.*\btrip\b|\bweekend getaway\b|\bcity break\b/.test(lower)) {
    scenarioHint = "weekend_trip";
  } else if (/\bdate night\b|\bfirst date\b|\bromantic\b|\banniversary\b/.test(lower)) {
    scenarioHint = "date_night";
  } else if (
    (/\btravel(?:ing)? to\b|\bgoing to\b|\bvisit(?:ing)?\b|\btrip to\b/i.test(lower)) &&
    /\bhotel\b|\bstay\b/i.test(lower) &&
    /\brestaurants?\b|\bbars?\b|\bnightlife\b|\bmusic\b|\bplan/i.test(lower)
  ) {
    scenarioHint = "city_trip";
  } else if (
    /\bconcert\b|\bgig\b|\blive music\b|\bfestival\b|\bmusical\b|\bcomedy show\b|\bstand.?up\b|\btickets?\b/i.test(lower) ||
    (/\bshow\b|\bperformance\b|\bevent\b/i.test(lower) &&
      /\bsee\b|\bwatch\b|\battend\b|\bgo to\b|\bgoing\b/i.test(lower))
  ) {
    scenarioHint = "concert_event";
  } else if (
    /\bgift\b|\bgifts\b|\bpresent\b|\bpresents\b/i.test(lower) &&
    /\bfind\b|\bget\b|\bbuy\b|\bsuggest\b|\brecommend\b|\bidea\b|\bfor\b/i.test(lower)
  ) {
    scenarioHint = "gift";
  }

  return {
    input_language: inputLanguage,
    output_language: outputLanguage,
    normalized_query: message.trim(),
    intent_summary: message.trim(),
    category_hint: categoryHint,
    scenario_hint: scenarioHint,
    location_hint: resolveLocationAlias(message) ?? fallbackLocation,
  };
}

function mergeContexts(
  fallback: MultilingualQueryContext,
  parsed: Partial<MultilingualQueryContext>
): MultilingualQueryContext {
  const inputLanguage =
    parsed.input_language === "en" ||
    parsed.input_language === "zh" ||
    parsed.input_language === "mixed" ||
    parsed.input_language === "other" ||
    parsed.input_language === "unknown"
      ? parsed.input_language
      : fallback.input_language;

  const outputLanguage =
    parsed.output_language === "zh" || parsed.output_language === "en"
      ? parsed.output_language
      : inferOutputLanguage(inputLanguage);

  const parsedSummary =
    typeof parsed.intent_summary === "string" && parsed.intent_summary.trim()
      ? parsed.intent_summary.trim()
      : "";
  const safeSummary =
    outputLanguage === "en"
      ? hasCjk(parsedSummary) && !hasLatin(parsedSummary)
        ? fallback.normalized_query
        : parsedSummary || fallback.intent_summary
      : !hasCjk(parsedSummary) && hasLatin(parsedSummary)
      ? fallback.intent_summary
      : parsedSummary || fallback.intent_summary;

  return {
    input_language: inputLanguage,
    output_language: outputLanguage,
    normalized_query:
      typeof parsed.normalized_query === "string" && parsed.normalized_query.trim()
        ? parsed.normalized_query.trim()
        : fallback.normalized_query,
    intent_summary: safeSummary,
    category_hint: coerceCategory(parsed.category_hint) ?? fallback.category_hint ?? null,
    scenario_hint: coerceScenario(parsed.scenario_hint) ?? fallback.scenario_hint ?? null,
    location_hint:
      normalizeLocation(
        typeof parsed.location_hint === "string"
          ? parsed.location_hint
          : fallback.location_hint
      ) ?? fallback.location_hint,
    cuisine_hint:
      typeof parsed.cuisine_hint === "string" && parsed.cuisine_hint.trim()
        ? parsed.cuisine_hint.trim().toLowerCase()
        : fallback.cuisine_hint,
    purpose_hint:
      typeof parsed.purpose_hint === "string" && parsed.purpose_hint.trim()
        ? parsed.purpose_hint.trim().toLowerCase()
        : fallback.purpose_hint,
    party_size_hint:
      typeof parsed.party_size_hint === "number" && Number.isFinite(parsed.party_size_hint)
        ? parsed.party_size_hint
        : fallback.party_size_hint,
    budget_per_person_hint:
      typeof parsed.budget_per_person_hint === "number" &&
      Number.isFinite(parsed.budget_per_person_hint)
        ? parsed.budget_per_person_hint
        : fallback.budget_per_person_hint,
    budget_total_hint:
      typeof parsed.budget_total_hint === "number" &&
      Number.isFinite(parsed.budget_total_hint)
        ? parsed.budget_total_hint
        : fallback.budget_total_hint,
    date_text_hint:
      typeof parsed.date_text_hint === "string" && parsed.date_text_hint.trim()
        ? parsed.date_text_hint.trim()
        : fallback.date_text_hint,
    time_hint:
      typeof parsed.time_hint === "string" && parsed.time_hint.trim()
        ? parsed.time_hint.trim()
        : fallback.time_hint,
    constraints_hint: Array.isArray(parsed.constraints_hint)
      ? parsed.constraints_hint.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      : fallback.constraints_hint,
  };
}

function buildPreferenceConstraintHints(userPreferences: Record<string, string>): string[] {
  return Object.entries(userPreferences).flatMap(([k, v]) => {
    if (k === "noise_sensitivity" && v === "high") return ["quiet venues preferred"];
    if (k === "budget_sensitivity" && v === "high") return ["budget-conscious options preferred"];
    if (k === "distance_tolerance" && v === "low") return ["nearby venues only"];
    return [];
  });
}

function buildPreferenceConstraintBlock(userPreferences: Record<string, string>): string {
  const hints = buildPreferenceConstraintHints(userPreferences);
  if (hints.length === 0) return "";
  const lines = hints.map((h) => `- ${h}`);
  return "\n\nLearned user preferences (soft constraints from past feedback):\n" + lines.join("\n");
}

export async function analyzeMultilingualQuery(
  message: string,
  fallbackLocation?: string,
  userPreferences?: Record<string, string>
): Promise<MultilingualQueryContext> {
  const fallback = buildFallbackContext(message, fallbackLocation);

  const preferenceHints = userPreferences ? buildPreferenceConstraintHints(userPreferences) : [];

  // Fast path: pure English queries don't need MiniMax NLU — regex fallback is accurate enough.
  // MiniMax adds value for Chinese, mixed-language, and ambiguous queries.
  if (inferInputLanguage(message) === "en") {
    if (preferenceHints.length > 0) {
      return {
        ...fallback,
        constraints_hint: [...(fallback.constraints_hint ?? []), ...preferenceHints],
      };
    }
    return fallback;
  }

  const preferenceBlock = userPreferences ? buildPreferenceConstraintBlock(userPreferences) : "";

  try {
    const text = await minimaxChat({
      system: `You are a multilingual consumer-query normalizer.
Return ONLY valid JSON with this schema:
{
  "input_language": "en" | "zh" | "mixed" | "other" | "unknown",
  "output_language": "en" | "zh",
  "normalized_query": "short internal canonical paraphrase in English",
  "intent_summary": "one sentence summary in the user's preferred output language",
  "category_hint": "restaurant" | "hotel" | "flight" | "credit_card" | "laptop" | "smartphone" | "headphone" | "subscription" | "trip" | "unknown" | null,
  "scenario_hint": "date_night" | "weekend_trip" | "city_trip" | "big_purchase" | null,
  "location_hint": "canonical place name like New York, NY" | null,
  "cuisine_hint": "western|italian|french|japanese|..." | null,
  "purpose_hint": "date|business|family|friends|solo|group|..." | null,
  "party_size_hint": number | null,
  "budget_per_person_hint": number | null,
  "budget_total_hint": number | null,
  "date_text_hint": "next tuesday|tomorrow|2026-03-24|..." | null,
  "time_hint": "7:30 pm|8pm|..." | null,
  "constraints_hint": ["constraint", "..."]
}

Rules:
- Detect the user's dominant language and preserve it in output_language.
- normalized_query should be a concise English internal representation.
- category_hint and scenario_hint must reflect the user's actual goal, not the surface wording.
- Canonicalize location names when possible.
- If the user mixes languages, still extract one clean canonical intent.
- Use null for missing fields.
- Return JSON only.`,
      messages: [
        {
          role: "user",
          content: `Fallback location: ${fallbackLocation ?? "none"}\nUser message: "${message}"`,
        },
      ],
      max_tokens: 600,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const merged = mergeContexts(
      fallback,
      JSON.parse(jsonMatch[0]) as Partial<MultilingualQueryContext>
    );
    if (preferenceHints.length > 0) {
      return {
        ...merged,
        constraints_hint: [...(merged.constraints_hint ?? []), ...preferenceHints],
      };
    }
    return merged;
  } catch {
    return fallback;
  }
}

export function resolveLocationHint(
  parsedLocation: string | undefined,
  queryContext: MultilingualQueryContext | undefined,
  userMessage: string,
  fallbackLocation?: string
): string | undefined {
  return (
    queryContext?.location_hint ??
    resolveLocationAlias(userMessage) ??
    normalizeLocation(parsedLocation) ??
    fallbackLocation
  );
}
