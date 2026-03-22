import { CityTripIntent, OutputLanguage } from "../../types";
import { pickLanguageCopy } from "../../outputCopy";
import { EngineConfig } from "../planner-engine/types";

function buildBriefLines(intent: CityTripIntent, lang: OutputLanguage): string[] {
  const brief: string[] = [
    pickLanguageCopy(
      lang,
      `${intent.travelers ?? 1} traveler${(intent.travelers ?? 1) === 1 ? "" : "s"} visiting ${intent.destination_city} for ${intent.nights ?? "a few"} night${intent.nights === 1 ? "" : "s"}.`,
      `${intent.travelers ?? 1} 人前往 ${intent.destination_city}，共 ${intent.nights ?? "几"} 晚。`
    ),
  ];
  if (intent.activities.length > 0) {
    brief.push(
      pickLanguageCopy(
        lang,
        `Activities wanted: ${intent.activities.join(", ")}.`,
        `想体验：${intent.activities.join("、")}。`
      )
    );
  }
  if (intent.hotel_star_rating) {
    brief.push(
      pickLanguageCopy(
        lang,
        `Preferred hotel: ${intent.hotel_star_rating}-star.`,
        `酒店偏好：${intent.hotel_star_rating} 星。`
      )
    );
  }
  if (intent.start_date) {
    brief.push(
      pickLanguageCopy(lang, `Check-in: ${intent.start_date}.`, `入住日期：${intent.start_date}。`)
    );
  }
  return brief.slice(0, 4);
}

/**
 * Builds the EngineConfig for the city_trip scenario.
 * Tier A = Upscale, Tier B = Trendy, Tier C = Local vibe.
 */
export function buildCityTripEngineConfig(
  intent: CityTripIntent,
  lang: OutputLanguage
): EngineConfig {
  const nights = intent.nights ?? 3;
  const city = intent.destination_city;

  return {
    planId: `city-trip-${city}-${intent.start_date ?? "tbd"}`,
    scenario: "city_trip",
    tierLabels: {
      A: pickLanguageCopy(lang, "Upscale", "高端精致"),
      B: pickLanguageCopy(lang, "Trendy", "时髦活力"),
      C: pickLanguageCopy(lang, "Local vibe", "本地地道"),
    },
    tierFallbackReasons: {
      A: pickLanguageCopy(
        lang,
        "Best hotel quality + refined dining. Costs more but delivers the most polished experience.",
        "酒店质量最佳 + 精致餐饮。费用较高，但体验最为精致。"
      ),
      B: pickLanguageCopy(
        lang,
        "Hip neighborhood hotel + buzzy restaurant + live music or lively bar. Best social energy.",
        "时尚街区酒店 + 热门餐厅 + 现场音乐或热闹酒吧。社交氛围最佳。"
      ),
      C: pickLanguageCopy(
        lang,
        "Neighborhood feel, authentic dining, unpretentious bar. Best if you want to avoid tourist traps.",
        "街区感十足，正宗餐饮，不装的酒吧。如果你想避开旅游陷阱，这套最合适。"
      ),
    },
    planTitle: pickLanguageCopy(
      lang,
      `${city} trip packages`,
      `${city} 旅行方案包`
    ),
    planSummary: pickLanguageCopy(
      lang,
      `I built 3 complete packages for your ${nights}-night ${city} trip — each bundles a hotel, a restaurant, and a nightlife spot so you can approve one shape instead of stitching it together yourself.`,
      `我为你在 ${city} 的 ${nights} 晚旅行打包了 3 套完整方案，每套都包含酒店、餐厅和夜生活，直接选一套确认就行。`
    ),
    approvalPrompt: pickLanguageCopy(
      lang,
      "Approve the package that best matches the vibe you're going for.",
      "选最符合你想要的氛围的那套方案直接确认。"
    ),
    briefLines: buildBriefLines(intent, lang),
    nights,
    startDate: intent.start_date,
    tradeoff_summary: pickLanguageCopy(
      lang,
      "Upscale is the default: best hotel quality and refined dining. Trendy trades polish for social energy. Local vibe skips tourist traps for an authentic neighborhood feel.",
      "默认推荐高端精致套餐：酒店质量最佳，餐饮精致。时髦活力换来更好的社交氛围。本地地道放弃精致感，换取真实的街区体验。"
    ),
  };
}
