import {
  SmartphoneDevice,
  SmartphoneIntent,
  SmartphoneRecommendationCard,
  SmartphoneSignalBreakdownItem,
  SmartphoneSKU,
  SmartphoneUseCase,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const smartphonesData = require("../data/smartphones.json");

// ─── Weight matrix ────────────────────────────────────────────────────────────
// 5 use cases × 9 signal dimensions
// Columns: camera_main | camera_video | battery | display | performance | software | connectivity | build | value

type SignalDim =
  | "camera_main" | "camera_video" | "battery_life" | "display_quality"
  | "performance" | "software_support" | "connectivity" | "build_quality"
  | "value_for_money";

const WEIGHT_MATRIX: Record<SmartphoneUseCase, Record<SignalDim, number>> = {
  photography:  { camera_main: 0.35, camera_video: 0.25, battery_life: 0.10, display_quality: 0.10, performance: 0.05, software_support: 0.05, connectivity: 0.05, build_quality: 0.03, value_for_money: 0.02 },
  gaming:       { camera_main: 0.05, camera_video: 0.05, battery_life: 0.20, display_quality: 0.20, performance: 0.35, software_support: 0.05, connectivity: 0.05, build_quality: 0.03, value_for_money: 0.02 },
  business:     { camera_main: 0.05, camera_video: 0.05, battery_life: 0.20, display_quality: 0.10, performance: 0.15, software_support: 0.25, connectivity: 0.10, build_quality: 0.05, value_for_money: 0.05 },
  everyday:     { camera_main: 0.15, camera_video: 0.10, battery_life: 0.20, display_quality: 0.15, performance: 0.15, software_support: 0.10, connectivity: 0.05, build_quality: 0.05, value_for_money: 0.05 },
  budget_value: { camera_main: 0.15, camera_video: 0.10, battery_life: 0.15, display_quality: 0.10, performance: 0.10, software_support: 0.05, connectivity: 0.05, build_quality: 0.05, value_for_money: 0.25 },
};

const USE_CASE_LABELS: Record<SmartphoneUseCase, string> = {
  photography:  "Photography",
  gaming:       "Mobile Gaming",
  business:     "Business / Productivity",
  everyday:     "Everyday Use",
  budget_value: "Best Value",
};

const SIGNAL_LABELS: Record<SignalDim, string> = {
  camera_main:      "Main Camera",
  camera_video:     "Video Recording",
  battery_life:     "Battery Life",
  display_quality:  "Display",
  performance:      "Performance",
  software_support: "Software Support",
  connectivity:     "5G / Connectivity",
  build_quality:    "Build Quality",
  value_for_money:  "Value",
};

// ─── Device loading ───────────────────────────────────────────────────────────

function loadDevices(): SmartphoneDevice[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (smartphonesData as any).devices as SmartphoneDevice[];
}

// ─── Signal dimension scores ──────────────────────────────────────────────────

function getSignalScores(device: SmartphoneDevice): Record<SignalDim, number> {
  const s = device.signals;
  return {
    camera_main:      s.camera_main.value_normalized,
    camera_video:     s.camera_video.value_normalized,
    battery_life:     s.battery_life.value_normalized,
    display_quality:  s.display_quality.value_normalized,
    performance:      s.performance.value_normalized,
    software_support: s.software_support.value_normalized,
    connectivity:     s.connectivity.value_normalized,
    build_quality:    s.build_quality.value_normalized,
    value_for_money:  s.value_for_money.value_normalized,
  };
}

function weightedScore(
  signalScores: Record<SignalDim, number>,
  weights: Record<SignalDim, number>
): number {
  return (Object.keys(weights) as SignalDim[]).reduce(
    (sum, dim) => sum + signalScores[dim] * weights[dim],
    0
  );
}

// ─── SKU selection ────────────────────────────────────────────────────────────

function recommendSKU(
  device: SmartphoneDevice,
  budgetMax: number | null
): SmartphoneSKU | null {
  const affordable = budgetMax
    ? device.skus.filter((s) => s.price_usd <= budgetMax)
    : device.skus;
  const pool = affordable.length > 0 ? affordable : device.skus;
  // Recommend 256GB tier when available (sweet spot), else mid-tier
  const sorted = [...pool].sort((a, b) => a.price_usd - b.price_usd);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid] ?? sorted[0] ?? null;
}

// ─── Text generation ──────────────────────────────────────────────────────────

function buildWhyRecommended(
  device: SmartphoneDevice,
  useCases: SmartphoneUseCase[],
  score: number
): string {
  const primary = useCases[0];
  const label = USE_CASE_LABELS[primary] ?? primary;
  const scoreLabel = score >= 8.5 ? "Exceptional" : score >= 7.5 ? "Strong" : "Solid";
  const s = device.signals;

  const highlights: string[] = [];
  if (primary === "photography" || primary === "everyday")
    highlights.push(`${s.camera_main.value_normalized >= 9 ? "excellent" : "good"} camera system`);
  if (primary === "gaming")
    highlights.push(`top-tier performance (${device.cpu})`);
  if (primary === "business")
    highlights.push(`${s.software_support.value_normalized >= 9 ? "7+ year" : "long"} software support`);
  if (primary === "budget_value")
    highlights.push(`exceptional value at $${device.price_usd}`);

  return `${scoreLabel} match for ${label} — ${highlights.join(", ") || "well-rounded performance"}. Composite score ${score}/10.`;
}

function buildWatchOut(
  device: SmartphoneDevice,
  useCases: SmartphoneUseCase[]
): string[] {
  const warnings: string[] = [];
  const s = device.signals;
  if (s.value_for_money.value_normalized <= 5 && !useCases.includes("budget_value"))
    warnings.push("Premium pricing — cheaper alternatives offer similar daily performance.");
  if (s.battery_life.value_normalized <= 6)
    warnings.push("Battery life is below average — carry a charger for heavy use days.");
  if (s.software_support.value_normalized <= 6)
    warnings.push("Shorter software support window than Apple/Google/Samsung.");
  if (device.os === "ios" && useCases.includes("gaming"))
    warnings.push("iOS has fewer native game titles optimized for mobile compared to Android.");
  return warnings.slice(0, 2);
}

function buildSignalBreakdown(
  device: SmartphoneDevice,
  useCase: SmartphoneUseCase
): SmartphoneSignalBreakdownItem[] {
  const scores = getSignalScores(device);
  const weights = WEIGHT_MATRIX[useCase];
  const dims = Object.keys(weights) as SignalDim[];

  return dims
    .filter((d) => weights[d] > 0)
    .sort((a, b) => weights[b] - weights[a])
    .map((dim) => {
      const sig = device.signals[dim as keyof typeof device.signals];
      return {
        signal_type: dim,
        label: SIGNAL_LABELS[dim],
        score: scores[dim],
        weight: weights[dim],
        raw_quote: sig?.raw_quote,
        source: sig?.source,
      };
    });
}

// ─── Main recommendation function ────────────────────────────────────────────

export function recommendSmartphones(
  intent: SmartphoneIntent
): SmartphoneRecommendationCard[] {
  const allDevices = loadDevices();
  const useCases = intent.use_cases.length > 0 ? intent.use_cases : (["everyday"] as SmartphoneUseCase[]);
  const primaryUseCase = useCases[0];

  // OS filter
  let filtered = allDevices.filter((d) => {
    if (intent.os_preference !== "any" && d.os !== intent.os_preference) return false;
    if (intent.avoid_brands.some((b) => d.brand.toLowerCase() === b.toLowerCase())) return false;
    return true;
  });

  // Budget filter — check if any SKU fits
  if (intent.budget_usd_max) {
    const fits = filtered.filter((d) => d.skus.some((s) => s.price_usd <= intent.budget_usd_max!));
    if (fits.length >= 3) filtered = fits;
    else if (fits.length > 0) filtered = fits; // show what we have even if < 3
  }

  if (filtered.length === 0) filtered = allDevices;

  // Score
  const weights = WEIGHT_MATRIX[primaryUseCase];
  const scored = filtered.map((device) => {
    const signalScores = getSignalScores(device);
    const useCaseScores: Partial<Record<SmartphoneUseCase, number>> = {};
    for (const uc of useCases) {
      useCaseScores[uc] = Math.round(weightedScore(signalScores, WEIGHT_MATRIX[uc]) * 10) / 10;
    }
    let finalScore = weightedScore(signalScores, weights);
    // Multi-use-case bonus
    if (useCases.length > 1) {
      const avg = useCases.reduce((s, uc) => s + (useCaseScores[uc] ?? 0), 0) / useCases.length;
      finalScore = (finalScore + avg) / 2;
    }
    finalScore = Math.round(Math.max(0, Math.min(10, finalScore)) * 10) / 10;
    return { device, finalScore, useCaseScores };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top5 = scored.slice(0, 5);

  return top5.map(({ device, finalScore, useCaseScores }, i) => {
    const staleness = (device.signals.camera_main.months_old ?? 0) > 18;
    return {
      device,
      rank: i + 1,
      final_score: finalScore,
      use_case_scores: useCaseScores,
      signal_breakdown: buildSignalBreakdown(device, primaryUseCase),
      recommended_sku: recommendSKU(device, intent.budget_usd_max),
      why_recommended: buildWhyRecommended(device, useCases, finalScore),
      watch_out: buildWatchOut(device, useCases),
      data_staleness_warning: staleness,
    } satisfies SmartphoneRecommendationCard;
  });
}

/** Check which user-mentioned models are missing from the smartphones database. */
export function classifyMentionedSmartphones(mentionedModels: string[]): {
  announced: string[];
  unknown: string[];
} {
  if (mentionedModels.length === 0) return { announced: [], unknown: [] };
  const devices = loadDevices();
  const dbText = devices.map((d) => `${d.name} ${d.cpu}`).join(" ").toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readPendingProducts } = require("./subscriptions") as typeof import("./subscriptions");
  const pendingFile = readPendingProducts();
  const pendingText = pendingFile.pending
    .filter((p) => p.watch_category === "smartphone")
    .map((p) => p.name)
    .join(" ")
    .toLowerCase();

  const announced: string[] = [];
  const unknown: string[] = [];
  for (const model of mentionedModels) {
    const lower = model.toLowerCase();
    if (dbText.includes(lower)) continue;
    if (pendingText.includes(lower)) announced.push(model);
    else unknown.push(model);
  }
  return { announced, unknown };
}
