import { DecisionPlan, OutputLanguage, PlanAction, PlanOption } from "../../types";
import { pickLanguageCopy } from "../../outputCopy";
import { EngineConfig, ModuleResults } from "./types";
import { buildTieredPackages } from "./selectors";
import { buildPlanOptionFromPackage } from "./plan-option-builder";
import { getBestCardForTrip, buildTripCardCallout } from "../planners/trip-card";

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function inferConfidence(score: number, backupCount: number): "high" | "medium" | "low" {
  if (score >= 8.5 && backupCount >= 1) return "high";
  if (score >= 7) return "medium";
  return "low";
}

function buildDefaultActions(lang: OutputLanguage): PlanAction[] {
  return [
    {
      id: "export-brief",
      type: "export_brief",
      label: pickLanguageCopy(lang, "Export trip brief", "导出行程摘要"),
      description: pickLanguageCopy(lang, "Download a markdown summary of this trip package.", "下载这套旅行方案的 Markdown 摘要。"),
    },
    {
      id: "approve-plan",
      type: "approve_plan",
      label: pickLanguageCopy(lang, "Lock in this plan", "确认这套方案"),
      description: pickLanguageCopy(lang, "Finalize the selected package", "确定所选方案"),
    },
    {
      id: "send-for-vote",
      type: "send_for_vote",
      label: pickLanguageCopy(lang, "Send to friends", "发给朋友投票"),
      description: pickLanguageCopy(lang, "Let your group vote on the trip options.", "让朋友们投票选出最喜欢的方案。"),
    },
    {
      id: "swap-backup",
      type: "swap_backup",
      label: pickLanguageCopy(lang, "Try a different package", "换一套方案"),
      description: pickLanguageCopy(lang, "See an alternative combination", "查看其他组合"),
    },
    {
      id: "refine",
      type: "refine",
      label: pickLanguageCopy(lang, "Adjust preferences", "调整偏好"),
      description: pickLanguageCopy(lang, "Change dates, budget, or requirements", "修改日期、预算或需求"),
      prompt: pickLanguageCopy(lang, "I'd like to adjust the plan:", "我想调整一下方案："),
    },
  ];
}

/**
 * Generic modular planner engine.
 * Takes pre-fetched module results + a precomputed config and assembles a DecisionPlan.
 */
export function runModularPlanner(params: {
  results: ModuleResults;
  config: EngineConfig;
  outputLanguage: OutputLanguage;
}): DecisionPlan | null {
  const { results, config, outputLanguage: lang } = params;

  // Need at least hotels or restaurants to build a plan
  if (results.hotels.length === 0 && results.restaurants.length === 0) return null;

  const [pkgA, pkgB, pkgC] = buildTieredPackages(results);

  const buildOption = (pkg: typeof pkgA, slot: "A" | "B" | "C") =>
    buildPlanOptionFromPackage(pkg, {
      label: config.tierLabels[slot],
      fallbackReason: config.tierFallbackReasons[slot],
      nights: config.nights,
      startDate: config.startDate,
      outputLanguage: lang,
      idPrefix: config.planId,
    });

  const optionA = buildOption(pkgA, "A");
  const optionB = buildOption(pkgB, "B");
  const optionC = buildOption(pkgC, "C");

  if (!optionA) return null;

  const allOptions = [optionA, optionB, optionC].filter((o): o is PlanOption => o !== null);
  const sorted = [...allOptions].sort((a, b) => b.score - a.score);
  const primary = sorted[0];
  const backups = sorted.slice(1);

  // Collect evidence IDs from all packages
  const evidenceCardIds = dedupeStrings([
    pkgA.hotel?.hotel.id,
    pkgB.hotel?.hotel.id,
    pkgC.hotel?.hotel.id,
    pkgA.flight?.flight.id,
    pkgA.restaurant?.restaurant.id,
    pkgB.restaurant?.restaurant.id,
  ].filter((id): id is string => !!id));

  // Build evidence items from hotels and restaurants
  const evidenceItems = [
    ...results.hotels.slice(0, 2).map((h) => ({
      id: h.hotel.id,
      title: h.hotel.name,
      detail: `${h.why_recommended}${h.watch_out ? ` Watch-out: ${h.watch_out}` : ""}`,
      tag: pickLanguageCopy(lang, `Hotel · ⭐${h.hotel.rating}`, `酒店 · ⭐${h.hotel.rating}`),
    })),
    ...results.restaurants.slice(0, 2).map((r) => ({
      id: r.restaurant.id,
      title: r.restaurant.name,
      detail: `${r.why_recommended}${r.watch_out ? ` Watch-out: ${r.watch_out}` : ""}`,
      tag: pickLanguageCopy(
        lang,
        `${r.restaurant.cuisine} · score ${r.score.toFixed(1)}`,
        `${r.restaurant.cuisine} · 评分 ${r.score.toFixed(1)}`
      ),
    })),
  ];

  const risks = dedupeStrings([
    ...primary.risks,
    ...backups.flatMap((b) => b.risks.slice(0, 1)),
  ]).slice(0, 4);

  // event_datetime / event_location for ICS export
  const eventFields: { event_datetime?: string; event_location?: string } = {};
  if (config.startDate) {
    const primaryHotel = [pkgA, pkgB, pkgC].find(
      (p) => p.hotel && (sorted[0].evidence_card_id === p.hotel.hotel.id)
    )?.hotel ?? pkgA.hotel;
    eventFields.event_datetime = `${config.startDate}T14:00:00`;
    if (primaryHotel) eventFields.event_location = primaryHotel.hotel.address || primaryHotel.hotel.name;
  }

  // trip_card_callout: best card to use (or sign up for) when booking this trip
  let trip_card_callout: string | undefined;
  {
    const primaryHotel = [pkgA, pkgB, pkgC].find(
      (p) => p.hotel && sorted[0].evidence_card_id === p.hotel.hotel.id
    )?.hotel ?? pkgA.hotel;
    const hotelUsd = primaryHotel?.hotel.total_price ?? (primaryHotel?.hotel.price_per_night ?? 0) * (config.nights ?? 1);
    const bestCard = getBestCardForTrip({ hotel_usd: hotelUsd });
    if (bestCard) {
      const cardLang = lang === "zh" ? "zh" : "en";
      trip_card_callout = buildTripCardCallout(bestCard, cardLang);
    }
  }

  return {
    id: config.planId,
    scenario: config.scenario,
    output_language: lang,
    title: config.planTitle,
    summary: config.planSummary,
    approval_prompt: config.approvalPrompt,
    confidence: inferConfidence(primary.score, backups.length),
    scenario_brief: config.briefLines,
    primary_plan: { ...primary, label: pickLanguageCopy(lang, "Main pick", "主方案"), fallback_reason: undefined },
    backup_plans: backups,
    show_more_available: false,
    tradeoff_summary: config.tradeoff_summary,
    ...eventFields,
    ...(trip_card_callout ? { trip_card_callout } : {}),
    risks,
    next_actions: buildDefaultActions(lang),
    evidence_card_ids: evidenceCardIds,
    evidence_items: evidenceItems,
  };
}

export type { EngineConfig, ModuleResults, TieredPackage } from "./types";
