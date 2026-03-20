import laptopsData from "../data/laptops.json";
import {
  LaptopDevice,
  LaptopIntent,
  LaptopRecommendationCard,
  LaptopSignalBreakdownItem,
  LaptopSKU,
  LaptopUseCase,
} from "./types";

// ─── Weight Matrix (from PLAN.md Phase 10) ───────────────────────────────────
// 7 use cases × 8 signal dimensions
// Columns: battery | thermal | keyboard | display | build | ports | weight | value

type SignalDim = "battery" | "thermal" | "keyboard" | "display" | "build" | "ports" | "weight" | "value";

const WEIGHT_MATRIX: Record<LaptopUseCase, Record<SignalDim, number>> = {
  light_productivity: { battery: 0.20, thermal: 0.05, keyboard: 0.15, display: 0.15, build: 0.10, ports: 0.10, weight: 0.15, value: 0.10 },
  software_dev:       { battery: 0.20, thermal: 0.20, keyboard: 0.15, display: 0.10, build: 0.10, ports: 0.10, weight: 0.10, value: 0.05 },
  video_editing:      { battery: 0.10, thermal: 0.25, keyboard: 0.10, display: 0.20, build: 0.10, ports: 0.05, weight: 0.10, value: 0.10 },
  "3d_creative":      { battery: 0.05, thermal: 0.30, keyboard: 0.10, display: 0.15, build: 0.10, ports: 0.05, weight: 0.10, value: 0.15 },
  gaming:             { battery: 0.05, thermal: 0.30, keyboard: 0.10, display: 0.15, build: 0.15, ports: 0.05, weight: 0.05, value: 0.15 },
  data_science:       { battery: 0.15, thermal: 0.25, keyboard: 0.10, display: 0.10, build: 0.10, ports: 0.10, weight: 0.10, value: 0.10 },
  business_travel:    { battery: 0.25, thermal: 0.05, keyboard: 0.15, display: 0.10, build: 0.15, ports: 0.10, weight: 0.15, value: 0.05 },
};

// Use case display names
const USE_CASE_LABELS: Record<LaptopUseCase, string> = {
  light_productivity: "Light Productivity",
  software_dev: "Software Development",
  video_editing: "Video Editing",
  "3d_creative": "3D / Creative",
  gaming: "Gaming",
  data_science: "Data Science / ML",
  business_travel: "Business Travel",
};

// ─── Device loading ───────────────────────────────────────────────────────────

function loadDevices(): LaptopDevice[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (laptopsData as any).devices as LaptopDevice[];
}

// ─── Score aggregation per device ────────────────────────────────────────────

function getSignalDimScores(device: LaptopDevice): Record<SignalDim, number> {
  const s = device.signals;
  return {
    battery:  s.battery_life.value_normalized,
    thermal:  Math.round((s.thermal_performance.value_normalized + s.fan_noise.value_normalized) / 2),
    keyboard: Math.round((s.keyboard_feel.value_normalized + s.trackpad_feel.value_normalized) / 2),
    display:  Math.round((s.display_quality.value_normalized + s.display_brightness.value_normalized) / 2),
    build:    s.build_quality.value_normalized,
    ports:    s.port_selection.value_normalized,
    weight:   s.weight_portability.value_normalized,
    value:    s.value_for_money.value_normalized,
  };
}

function computeUseCaseScore(device: LaptopDevice, useCase: LaptopUseCase): number {
  const dimScores = getSignalDimScores(device);
  const weights = WEIGHT_MATRIX[useCase];
  let total = 0;
  for (const dim of Object.keys(weights) as SignalDim[]) {
    total += dimScores[dim] * weights[dim];
  }
  // Add CPU/GPU bonus for compute-heavy tasks
  if (useCase === "software_dev" || useCase === "data_science") {
    total = total * 0.85 + device.signals.cpu_benchmark * 0.15;
  }
  if (useCase === "video_editing" || useCase === "3d_creative" || useCase === "gaming") {
    total = total * 0.80 + device.signals.cpu_benchmark * 0.10 + device.signals.gpu_benchmark * 0.10;
  }
  return Math.round(total * 10) / 10;
}

function buildSignalBreakdown(device: LaptopDevice, primaryUseCase: LaptopUseCase): LaptopSignalBreakdownItem[] {
  const weights = WEIGHT_MATRIX[primaryUseCase];
  const s = device.signals;

  const items: LaptopSignalBreakdownItem[] = [
    {
      signal_type: "battery",
      label: `Battery: ${s.battery_life.value_label}`,
      score: s.battery_life.value_normalized,
      weight: weights.battery,
      raw_quote: s.battery_life.raw_quote,
      source: s.battery_life.source,
    },
    {
      signal_type: "thermal",
      label: `Thermal: ${s.thermal_performance.value_label}`,
      score: Math.round((s.thermal_performance.value_normalized + s.fan_noise.value_normalized) / 2),
      weight: weights.thermal,
      raw_quote: s.thermal_performance.raw_quote,
      source: s.thermal_performance.source,
    },
    {
      signal_type: "keyboard",
      label: `Keyboard: ${s.keyboard_feel.value_label}`,
      score: Math.round((s.keyboard_feel.value_normalized + s.trackpad_feel.value_normalized) / 2),
      weight: weights.keyboard,
      raw_quote: s.keyboard_feel.raw_quote,
      source: s.keyboard_feel.source,
    },
    {
      signal_type: "display",
      label: `Display: ${s.display_quality.value_label}`,
      score: Math.round((s.display_quality.value_normalized + s.display_brightness.value_normalized) / 2),
      weight: weights.display,
      raw_quote: s.display_quality.raw_quote,
      source: s.display_quality.source,
    },
    {
      signal_type: "build",
      label: `Build Quality: ${s.build_quality.value_label}`,
      score: s.build_quality.value_normalized,
      weight: weights.build,
      raw_quote: s.build_quality.raw_quote,
      source: s.build_quality.source,
    },
    {
      signal_type: "ports",
      label: `Port Selection: ${buildPortLabel(device)}`,
      score: s.port_selection.value_normalized,
      weight: weights.ports,
    },
    {
      signal_type: "weight",
      label: `Weight: ${s.weight_portability.value_label}`,
      score: s.weight_portability.value_normalized,
      weight: weights.weight,
    },
    {
      signal_type: "value",
      label: `Value: ${s.value_for_money.value_label}`,
      score: s.value_for_money.value_normalized,
      weight: weights.value,
      raw_quote: s.value_for_money.raw_quote,
      source: s.value_for_money.source,
    },
  ];

  // Only show dimensions with meaningful weight
  return items.filter((i) => i.weight >= 0.05).sort((a, b) => b.weight - a.weight);
}

function buildPortLabel(device: LaptopDevice): string {
  const p = device.signals.port_selection;
  const parts: string[] = [];
  if (p.thunderbolt) parts.push(`Thunderbolt×${p.usb_c}`);
  else if (p.usb_c > 0) parts.push(`USB-C×${p.usb_c}`);
  if (p.usb_a > 0) parts.push(`USB-A×${p.usb_a}`);
  if (p.hdmi) parts.push("HDMI");
  if (p.sd_card) parts.push("SD");
  return parts.join(", ") || "Limited";
}

// ─── Why Recommended text ─────────────────────────────────────────────────────

function buildWhyRecommended(device: LaptopDevice, useCases: LaptopUseCase[], finalScore: number): string {
  const primaryUseCase = useCases[0];
  const s = device.signals;

  const highlights: string[] = [];

  // Battery highlight for relevant use cases
  if (["business_travel", "light_productivity"].includes(primaryUseCase) && s.battery_life.value_normalized >= 8) {
    highlights.push(`${s.battery_life.value_label} battery life`);
  }
  // Thermal for heavy workloads
  if (["video_editing", "3d_creative", "gaming", "data_science", "software_dev"].includes(primaryUseCase) && s.thermal_performance.value_normalized >= 8) {
    highlights.push("excellent thermal management for sustained workloads");
  }
  // Display for creative work
  if (["video_editing", "3d_creative"].includes(primaryUseCase) && s.display_quality.value_normalized >= 9) {
    highlights.push(`${s.display_quality.value_label} display`);
  }
  // Keyboard for writing/dev
  if (["software_dev", "business_travel"].includes(primaryUseCase) && s.keyboard_feel.value_normalized >= 9) {
    highlights.push("best-in-class keyboard");
  }
  // Weight for travel
  if (primaryUseCase === "business_travel" && s.weight_portability.value_normalized >= 9) {
    highlights.push(`ultra-light ${s.weight_portability.value_label}`);
  }
  // Value
  if (s.value_for_money.value_normalized >= 9) {
    highlights.push("exceptional value for money");
  }

  const useCaseStr = useCases.map((u) => USE_CASE_LABELS[u]).join(" and ");
  const highlightStr = highlights.length > 0 ? ` — ${highlights.slice(0, 2).join(", ")}` : "";

  return `Strong match for ${useCaseStr}${highlightStr}. Composite score ${finalScore.toFixed(1)}/10.`;
}

// ─── Watch Out notes ──────────────────────────────────────────────────────────

function buildWatchOut(device: LaptopDevice, useCases: LaptopUseCase[]): string[] {
  const notes: string[] = [];
  const s = device.signals;

  // Port limitations
  if (s.port_selection.usb_a === 0) {
    notes.push("No USB-A ports — you'll need a dongle or hub for older peripherals.");
  }
  if (!s.port_selection.hdmi) {
    notes.push("No HDMI port — requires a USB-C to HDMI adapter for external displays.");
  }

  // Thermal for heavy workload use cases
  if (
    ["video_editing", "3d_creative", "gaming", "data_science"].some((u) => useCases.includes(u as LaptopUseCase)) &&
    s.thermal_performance.value_normalized <= 5
  ) {
    notes.push("Throttles under sustained heavy load — performance drops during extended rendering or gaming sessions.");
  }
  if (s.fan_noise.value_normalized <= 3) {
    notes.push("Fan noise is loud under load — not ideal for quiet environments.");
  }

  // Display brightness outdoors
  if (s.display_brightness.value_normalized <= 2) {
    notes.push("Screen is dim outdoors — struggles in direct sunlight.");
  }

  // Battery for travel-heavy users
  if (useCases.includes("business_travel") && s.battery_life.value_normalized <= 5) {
    notes.push("Battery life is below average — you'll likely need to carry the charger on long travel days.");
  }

  // Fanless throttle
  if (s.fan_noise.value_raw === "silent" && s.thermal_performance.value_normalized <= 7) {
    notes.push("Fanless design means it throttles under sustained heavy CPU workloads — best for light-to-moderate loads.");
  }

  // Base RAM concern
  if (device.ram_gb <= 8) {
    notes.push("8GB RAM base config can feel tight running multiple apps or browser tabs — consider upgrading to 16GB.");
  }

  // High price
  if (device.price_usd >= 2000 && s.value_for_money.value_normalized <= 5) {
    notes.push("Premium pricing — similar specs are available from competitors at a lower cost.");
  }

  return notes.slice(0, 4);
}

// ─── SKU recommendation ───────────────────────────────────────────────────────

function recommendSKU(device: LaptopDevice, useCases: LaptopUseCase[], budgetMax: number | null): LaptopSKU | null {
  if (!device.skus || device.skus.length === 0) return null;

  const isHeavyWorkload = useCases.some((u) =>
    ["video_editing", "3d_creative", "gaming", "data_science", "software_dev"].includes(u)
  );

  // Filter by budget
  const affordable = budgetMax
    ? device.skus.filter((s) => s.price_usd <= budgetMax)
    : [...device.skus];

  if (affordable.length === 0) return device.skus[0]; // return cheapest if nothing fits

  // For heavy workloads, prefer higher RAM
  if (isHeavyWorkload) {
    const sorted = [...affordable].sort((a, b) => b.ram_gb - a.ram_gb);
    return sorted[0];
  }

  // For light use, mid-tier is often the best value
  const midIndex = Math.floor(affordable.length / 2);
  return affordable[midIndex] ?? affordable[0];
}

// ─── Main recommendation function ────────────────────────────────────────────

export function recommendLaptops(intent: LaptopIntent): LaptopRecommendationCard[] {
  const allDevices = loadDevices();
  const useCases = intent.use_cases.length > 0 ? intent.use_cases : (["light_productivity"] as LaptopUseCase[]);

  // ── Step 1: Filter ────────────────────────────────────────────────────────

  let candidates = allDevices.filter((device) => {
    // OS filter
    if (intent.os_preference !== "any" && device.os !== intent.os_preference) {
      return false;
    }
    // Budget filter (with 10% flexibility)
    if (intent.budget_usd_max !== null && intent.budget_usd_max !== undefined) {
      const cheapestSKU = device.skus.reduce((min, s) => Math.min(min, s.price_usd), device.price_usd);
      if (cheapestSKU > intent.budget_usd_max * 1.1) return false;
    }
    if (intent.budget_usd_min !== null && intent.budget_usd_min !== undefined) {
      if (device.price_usd < intent.budget_usd_min * 0.9) return false;
    }
    // Display size filter
    if (intent.display_size_preference === "<14" && device.display_size >= 14) return false;
    if (intent.display_size_preference === "14-15" && (device.display_size < 13.9 || device.display_size > 15.1)) return false;
    if (intent.display_size_preference === "15+" && device.display_size < 15) return false;
    // Brand exclusion
    if (intent.avoid_brands && intent.avoid_brands.length > 0) {
      const brandLower = device.brand.toLowerCase();
      if (intent.avoid_brands.some((b) => brandLower.includes(b.toLowerCase()))) return false;
    }
    // Gaming filter
    if (intent.gaming_required && device.signals.gpu_benchmark < 7.5) return false;

    return true;
  });

  if (candidates.length === 0) {
    // Relax budget filter by 20% and try again
    candidates = allDevices.filter((device) => {
      if (intent.os_preference !== "any" && device.os !== intent.os_preference) return false;
      if (intent.budget_usd_max !== null && intent.budget_usd_max !== undefined) {
        const cheapestSKU = device.skus.reduce((min, s) => Math.min(min, s.price_usd), device.price_usd);
        if (cheapestSKU > intent.budget_usd_max * 1.3) return false;
      }
      return true;
    });
  }

  // ── Step 2: Score ─────────────────────────────────────────────────────────

  const scored = candidates.map((device) => {
    const useCaseScores: Partial<Record<LaptopUseCase, number>> = {};
    for (const uc of useCases) {
      useCaseScores[uc] = computeUseCaseScore(device, uc);
    }

    // Final score = average across requested use cases, with portability bonus
    let finalScore = Object.values(useCaseScores).reduce((sum, s) => sum + s, 0) / useCases.length;

    // Portability priority adjustment
    if (intent.portability_priority === "critical") {
      const portabilityBonus = (device.signals.weight_portability.value_normalized - 5) * 0.3;
      finalScore += portabilityBonus;
    }

    finalScore = Math.round(Math.max(0, Math.min(10, finalScore)) * 10) / 10;

    return { device, finalScore, useCaseScores };
  });

  // ── Step 3: Sort and top 5 ────────────────────────────────────────────────

  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top5 = scored.slice(0, 5);

  // ── Step 4: Build recommendation cards ───────────────────────────────────

  return top5.map(({ device, finalScore, useCaseScores }, i) => {
    const primaryUseCase = useCases[0];
    const staleness = device.signals.battery_life.months_old > 18;

    return {
      device,
      rank: i + 1,
      final_score: finalScore,
      use_case_scores: useCaseScores,
      signal_breakdown: buildSignalBreakdown(device, primaryUseCase),
      recommended_sku: recommendSKU(device, useCases, intent.budget_usd_max),
      why_recommended: buildWhyRecommended(device, useCases, finalScore),
      watch_out: buildWatchOut(device, useCases),
      data_staleness_warning: staleness,
    } satisfies LaptopRecommendationCard;
  });
}

/**
 * Given a list of model names mentioned by the user, classifies each one as:
 *   - "in_db"      : already in laptops.json (no warning needed)
 *   - "announced"  : detected by laptop-watch but no review data yet
 *   - "unknown"    : not found anywhere in our knowledge
 */
export function classifyMentionedModels(mentionedModels: string[]): {
  announced: string[];   // seen in pending_devices.json
  unknown: string[];     // truly not in our system at all
} {
  if (mentionedModels.length === 0) return { announced: [], unknown: [] };

  const devices = loadDevices();
  const dbText = devices.map((d) => `${d.name} ${d.cpu}`).join(" ").toLowerCase();

  // Lazy import to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readPendingProducts } = require("./subscriptions") as typeof import("./subscriptions");
  const pendingFile = readPendingProducts();
  const pendingText = pendingFile.pending
    .map((d) => `${d.name} ${d.extracted_specs.cpu ?? ""}`)
    .join(" ")
    .toLowerCase();

  const announced: string[] = [];
  const unknown: string[] = [];

  for (const model of mentionedModels) {
    const lower = model.toLowerCase();
    if (dbText.includes(lower)) continue;          // already in DB
    if (pendingText.includes(lower)) {
      announced.push(model);
    } else {
      unknown.push(model);
    }
  }

  return { announced, unknown };
}

/** Convenience wrapper — returns only models missing from laptops.json (any status). */
export function findMissingModels(mentionedModels: string[]): string[] {
  const { announced, unknown } = classifyMentionedModels(mentionedModels);
  return [...announced, ...unknown];
}
