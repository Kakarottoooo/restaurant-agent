import {
  HeadphoneDevice,
  HeadphoneIntent,
  HeadphoneRecommendationCard,
  HeadphoneSignalBreakdownItem,
  HeadphoneUseCase,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const headphonesData = require("../data/headphones.json");

// ─── Weight matrix ────────────────────────────────────────────────────────────
// 5 use cases × 10 signal dimensions

type SignalDim =
  | "noise_cancellation" | "sound_quality" | "bass_response" | "soundstage"
  | "comfort_long_wear" | "call_quality" | "battery_life"
  | "codec_support" | "multipoint_connection" | "value_for_money";

const WEIGHT_MATRIX: Record<HeadphoneUseCase, Record<SignalDim, number>> = {
  commute:       { noise_cancellation: 0.35, sound_quality: 0.15, bass_response: 0.10, soundstage: 0.05, comfort_long_wear: 0.10, call_quality: 0.05, battery_life: 0.15, codec_support: 0.05, multipoint_connection: 0.00, value_for_money: 0.00 },
  work_from_home:{ noise_cancellation: 0.20, sound_quality: 0.15, bass_response: 0.05, soundstage: 0.05, comfort_long_wear: 0.15, call_quality: 0.20, battery_life: 0.05, codec_support: 0.05, multipoint_connection: 0.10, value_for_money: 0.00 },
  audiophile:    { noise_cancellation: 0.05, sound_quality: 0.35, bass_response: 0.10, soundstage: 0.25, comfort_long_wear: 0.05, call_quality: 0.00, battery_life: 0.05, codec_support: 0.15, multipoint_connection: 0.00, value_for_money: 0.00 },
  sport:         { noise_cancellation: 0.15, sound_quality: 0.15, bass_response: 0.15, soundstage: 0.00, comfort_long_wear: 0.25, call_quality: 0.05, battery_life: 0.20, codec_support: 0.00, multipoint_connection: 0.00, value_for_money: 0.05 },
  casual:        { noise_cancellation: 0.15, sound_quality: 0.20, bass_response: 0.15, soundstage: 0.05, comfort_long_wear: 0.15, call_quality: 0.05, battery_life: 0.10, codec_support: 0.05, multipoint_connection: 0.05, value_for_money: 0.05 },
};

const USE_CASE_LABELS: Record<HeadphoneUseCase, string> = {
  commute:        "Commute / Travel",
  work_from_home: "Work from Home",
  audiophile:     "Audiophile Listening",
  sport:          "Sport / Workout",
  casual:         "Casual Everyday",
};

const SIGNAL_LABELS: Record<SignalDim, string> = {
  noise_cancellation:    "Noise Cancellation",
  sound_quality:         "Sound Quality",
  bass_response:         "Bass Response",
  soundstage:            "Soundstage / Imaging",
  comfort_long_wear:     "Comfort (long wear)",
  call_quality:          "Call / Mic Quality",
  battery_life:          "Battery Life",
  codec_support:         "Codec Support",
  multipoint_connection: "Multipoint Connection",
  value_for_money:       "Value for Money",
};

// ─── Device loading ───────────────────────────────────────────────────────────

function loadDevices(): HeadphoneDevice[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (headphonesData as any).devices as HeadphoneDevice[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function getSignalScores(device: HeadphoneDevice): Record<SignalDim, number> {
  const s = device.signals;
  return {
    noise_cancellation:    s.noise_cancellation.value_normalized,
    sound_quality:         s.sound_quality.value_normalized,
    bass_response:         s.bass_response.value_normalized,
    soundstage:            s.soundstage.value_normalized,
    comfort_long_wear:     s.comfort_long_wear.value_normalized,
    call_quality:          s.call_quality.value_normalized,
    battery_life:          s.battery_life.value_normalized,
    codec_support:         s.codec_support.value_normalized,
    multipoint_connection: s.multipoint_connection.value_normalized,
    value_for_money:       s.value_for_money.value_normalized,
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

// ─── Text generation ──────────────────────────────────────────────────────────

function buildWhyRecommended(
  device: HeadphoneDevice,
  useCases: HeadphoneUseCase[],
  score: number
): string {
  const primary = useCases[0];
  const label = USE_CASE_LABELS[primary] ?? primary;
  const scoreLabel = score >= 8.5 ? "Exceptional" : score >= 7.5 ? "Strong" : "Solid";
  const s = device.signals;

  const highlights: string[] = [];
  if (primary === "commute")
    highlights.push(`${s.noise_cancellation.value_normalized >= 9 ? "class-leading" : "strong"} noise cancellation`);
  if (primary === "work_from_home")
    highlights.push(`excellent call quality${device.wireless ? " with multipoint support" : ""}`);
  if (primary === "audiophile")
    highlights.push(`${s.sound_quality.value_normalized >= 9 ? "reference-grade" : "high-fidelity"} sound`);
  if (primary === "sport")
    highlights.push("secure fit and reliable battery for workouts");
  if (primary === "casual")
    highlights.push("great all-rounder at this price point");

  const formLabel = device.form_factor === "over_ear" ? "over-ear" : device.form_factor === "in_ear" ? "in-ear" : "on-ear";
  return `${scoreLabel} match for ${label} — ${highlights.join(", ") || "well-rounded performance"}. ${formLabel.charAt(0).toUpperCase() + formLabel.slice(1)}, ${device.wireless ? "wireless" : "wired"}. Composite score ${score}/10.`;
}

function buildWatchOut(
  device: HeadphoneDevice,
  useCases: HeadphoneUseCase[]
): string[] {
  const warnings: string[] = [];
  const s = device.signals;
  if (s.value_for_money.value_normalized <= 5)
    warnings.push("Premium pricing — there are cheaper alternatives with similar core performance.");
  if (s.comfort_long_wear.value_normalized <= 6 && useCases.includes("work_from_home"))
    warnings.push("May become uncomfortable during 8+ hour workdays.");
  if (!device.wireless && useCases.includes("sport"))
    warnings.push("Wired headphones are less practical for active workouts.");
  if (device.signals.noise_cancellation.value_normalized <= 3 && useCases.includes("commute"))
    warnings.push("Limited noise isolation — not ideal for noisy commutes.");
  return warnings.slice(0, 2);
}

function buildSignalBreakdown(
  device: HeadphoneDevice,
  useCase: HeadphoneUseCase
): HeadphoneSignalBreakdownItem[] {
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

export function recommendHeadphones(
  intent: HeadphoneIntent
): HeadphoneRecommendationCard[] {
  const allDevices = loadDevices();
  const useCases = intent.use_cases.length > 0 ? intent.use_cases : (["casual"] as HeadphoneUseCase[]);
  const primaryUseCase = useCases[0];

  let filtered = allDevices.filter((d) => {
    if (intent.form_factor_preference !== "any" && d.form_factor !== intent.form_factor_preference) return false;
    if (intent.wireless_required === true && !d.wireless) return false;
    if (intent.avoid_brands.some((b) => d.brand.toLowerCase() === b.toLowerCase())) return false;
    return true;
  });

  if (intent.budget_usd_max) {
    const fits = filtered.filter((d) => d.price_usd <= intent.budget_usd_max!);
    if (fits.length >= 3) filtered = fits;
    else if (fits.length > 0) filtered = fits;
  }

  if (filtered.length === 0) filtered = allDevices;

  const weights = WEIGHT_MATRIX[primaryUseCase];
  const scored = filtered.map((device) => {
    const signalScores = getSignalScores(device);
    const useCaseScores: Partial<Record<HeadphoneUseCase, number>> = {};
    for (const uc of useCases) {
      useCaseScores[uc] = Math.round(weightedScore(signalScores, WEIGHT_MATRIX[uc]) * 10) / 10;
    }
    let finalScore = weightedScore(signalScores, weights);
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
    const staleness = (device.signals.sound_quality.months_old ?? 0) > 18;
    return {
      device,
      rank: i + 1,
      final_score: finalScore,
      use_case_scores: useCaseScores,
      signal_breakdown: buildSignalBreakdown(device, primaryUseCase),
      why_recommended: buildWhyRecommended(device, useCases, finalScore),
      watch_out: buildWatchOut(device, useCases),
      data_staleness_warning: staleness,
    } satisfies HeadphoneRecommendationCard;
  });
}

/** Check which user-mentioned models are missing from the headphones database. */
export function classifyMentionedHeadphones(mentionedModels: string[]): {
  announced: string[];
  unknown: string[];
} {
  if (mentionedModels.length === 0) return { announced: [], unknown: [] };
  const devices = loadDevices();
  const dbText = devices.map((d) => d.name).join(" ").toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readPendingProducts } = require("./subscriptions") as typeof import("./subscriptions");
  const pendingFile = readPendingProducts();
  const pendingText = pendingFile.pending
    .filter((p) => p.watch_category === "headphone")
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
