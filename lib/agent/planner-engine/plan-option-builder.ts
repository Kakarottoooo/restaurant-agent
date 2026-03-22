import { OutputLanguage, PlanAction, PlanLinkAction, PlanOption } from "../../types";
import { pickLanguageCopy } from "../../outputCopy";
import { TieredPackage } from "./types";

function computePackageScore(pkg: TieredPackage): number {
  const hotelScore =
    pkg.hotel ? (pkg.hotel.score || pkg.hotel.hotel.rating) * 0.45 : 0;
  const flightScore =
    pkg.flight
      ? (pkg.flight.flight.stops === 0 ? 9 : pkg.flight.flight.stops === 1 ? 7.5 : 6.5) * 0.35
      : 0;
  const activityScore =
    ((pkg.restaurant?.score ?? 0) + (pkg.bar?.score ?? 0)) /
    ((pkg.restaurant ? 1 : 0) + (pkg.bar ? 1 : 0) || 1) * 0.2;

  const weights = (pkg.hotel ? 0.45 : 0) + (pkg.flight ? 0.35 : 0) + (pkg.restaurant || pkg.bar ? 0.2 : 0);
  if (weights === 0) return 7;

  return Math.round(((hotelScore + flightScore + activityScore) / weights) * weights * 10) / 10;
}

export interface PlanOptionContext {
  label: string;
  fallbackReason: string;
  nights: number;
  startDate?: string;
  outputLanguage: OutputLanguage;
  /** Override the auto-generated plan ID */
  idPrefix?: string;
}

/**
 * Generic PlanOption builder from a TieredPackage.
 * Handles any combination of hotel / flight / restaurant / bar / credit card.
 */
export function buildPlanOptionFromPackage(
  pkg: TieredPackage,
  ctx: PlanOptionContext
): PlanOption | null {
  const { hotel, flight, restaurant, bar, creditCard } = pkg;
  const { outputLanguage: lang, nights, startDate, label, fallbackReason } = ctx;

  if (!hotel && !flight && !restaurant) return null;

  // ── Highlights ──────────────────────────────────────────────────────────────
  const highlights: string[] = [];
  if (hotel) {
    highlights.push(
      pickLanguageCopy(
        lang,
        `${hotel.hotel.name}: ${hotel.price_summary || `$${hotel.hotel.price_per_night}/night`} — ${hotel.why_recommended}`,
        `${hotel.hotel.name}：${hotel.price_summary || `$${hotel.hotel.price_per_night}/晚`} — ${hotel.why_recommended}`
      )
    );
  }
  if (flight) {
    const stopLabel =
      flight.flight.stops === 0
        ? pickLanguageCopy(lang, "nonstop", "直飞")
        : pickLanguageCopy(lang, `${flight.flight.stops} stop`, `${flight.flight.stops} 次中转`);
    highlights.push(
      pickLanguageCopy(
        lang,
        `${flight.flight.airline} ${flight.flight.departure_airport}→${flight.flight.arrival_airport}, ${flight.flight.duration}, ${stopLabel}`,
        `${flight.flight.airline}：${flight.flight.departure_airport}→${flight.flight.arrival_airport}，${flight.flight.duration}，${stopLabel}`
      )
    );
  }
  if (restaurant) {
    highlights.push(
      pickLanguageCopy(
        lang,
        `${restaurant.restaurant.name} (${restaurant.restaurant.cuisine}): ${restaurant.why_recommended}`,
        `${restaurant.restaurant.name}（${restaurant.restaurant.cuisine}）：${restaurant.why_recommended}`
      )
    );
  }
  if (bar) {
    highlights.push(
      pickLanguageCopy(
        lang,
        `${bar.restaurant.name}: ${bar.why_recommended}`,
        `${bar.restaurant.name}：${bar.why_recommended}`
      )
    );
  }
  if (creditCard) {
    highlights.push(
      pickLanguageCopy(
        lang,
        `${creditCard.card.name}: ${creditCard.why_recommended}`,
        `${creditCard.card.name}：${creditCard.why_recommended}`
      )
    );
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  const primaryAction: PlanLinkAction | undefined = hotel
    ? {
        id: `book-hotel-${hotel.hotel.id}`,
        label: pickLanguageCopy(lang, `Book ${hotel.hotel.name}`, `预订 ${hotel.hotel.name}`),
        url: hotel.hotel.booking_link,
      }
    : flight?.flight.booking_link
    ? {
        id: `book-flight-${flight.flight.id}`,
        label: pickLanguageCopy(lang, "Book flight", "预订航班"),
        url: flight.flight.booking_link,
      }
    : undefined;

  const secondaryActions: PlanLinkAction[] = [];
  if (flight?.flight.booking_link && hotel) {
    secondaryActions.push({
      id: `book-flight-${flight.flight.id}`,
      label: pickLanguageCopy(lang, "Book flight", "预订航班"),
      url: flight.flight.booking_link,
    });
  }
  if (restaurant?.restaurant.url) {
    secondaryActions.push({
      id: `reserve-restaurant-${restaurant.restaurant.id}`,
      label: pickLanguageCopy(lang, `Reserve at ${restaurant.restaurant.name}`, `预订 ${restaurant.restaurant.name}`),
      url: restaurant.restaurant.url,
    });
  }
  if (bar?.restaurant.url) {
    secondaryActions.push({
      id: `directions-bar-${bar.restaurant.id}`,
      label: pickLanguageCopy(lang, `Directions to ${bar.restaurant.name}`, `前往 ${bar.restaurant.name}`),
      url: bar.restaurant.url,
    });
  }

  // ── Title & Subtitle ────────────────────────────────────────────────────────
  const titleParts: string[] = [];
  if (hotel) titleParts.push(hotel.hotel.name);
  else if (flight) titleParts.push(`${flight.flight.airline} flight`);
  const title = titleParts.join(" + ") || label;

  const subtitleParts: string[] = [];
  if (hotel) subtitleParts.push(pickLanguageCopy(lang, `${hotel.hotel.star_rating}★ hotel`, `${hotel.hotel.star_rating}★酒店`));
  if (flight) subtitleParts.push(pickLanguageCopy(lang, flight.flight.stops === 0 ? "nonstop flight" : `${flight.flight.stops}-stop flight`, flight.flight.stops === 0 ? "直飞" : `${flight.flight.stops}程航班`));
  if (restaurant) subtitleParts.push(pickLanguageCopy(lang, `${restaurant.restaurant.cuisine} dining`, `${restaurant.restaurant.cuisine}餐饮`));
  if (bar) subtitleParts.push(pickLanguageCopy(lang, bar.restaurant.cuisine || "nightlife", bar.restaurant.cuisine || "夜生活"));
  const subtitle = subtitleParts.join(" · ");

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (hotel) summaryParts.push(pickLanguageCopy(lang, `${nights} nights at ${hotel.hotel.name}`, `${nights} 晚住 ${hotel.hotel.name}`));
  if (flight) summaryParts.push(pickLanguageCopy(lang, `fly ${flight.flight.airline}`, `乘坐 ${flight.flight.airline}`));
  if (restaurant) summaryParts.push(pickLanguageCopy(lang, `dine at ${restaurant.restaurant.name}`, `在 ${restaurant.restaurant.name} 用餐`));
  if (bar) summaryParts.push(pickLanguageCopy(lang, `drinks at ${bar.restaurant.name}`, `在 ${bar.restaurant.name} 喝酒`));
  const summary = summaryParts.join(", ") + ".";

  // ── Cost ────────────────────────────────────────────────────────────────────
  let totalCost = 0;
  if (hotel) totalCost += hotel.hotel.total_price || hotel.hotel.price_per_night * nights;
  if (flight) totalCost += flight.flight.price || 0;
  const estimatedTotal = totalCost > 0 ? `$${Math.round(totalCost)}` : pickLanguageCopy(lang, "see below", "见下方");

  // ── Risks ────────────────────────────────────────────────────────────────────
  const risks: string[] = [
    hotel?.watch_out,
    restaurant?.watch_out,
    flight?.flight.stops === 2 ? pickLanguageCopy(lang, "Two-stop flight — longer travel time", "两次中转——旅行时间较长") : null,
  ].filter((r): r is string => !!r).slice(0, 2);

  // ── Evidence card ID ────────────────────────────────────────────────────────
  const evidenceCardId = hotel?.hotel.id ?? flight?.flight.id ?? restaurant?.restaurant.id;

  return {
    id: `${ctx.idPrefix ?? "modular"}-${pkg.slot}-${Date.now()}`,
    label,
    option_category: "trip",
    title,
    subtitle,
    summary,
    why_this_now:
      [hotel?.why_recommended, flight?.why_recommended].filter(Boolean).join(" ").trim() || summary,
    best_for: label,
    estimated_total: estimatedTotal,
    timing_note: startDate
      ? pickLanguageCopy(lang, `Check in ${startDate}`, `${startDate} 入住`)
      : pickLanguageCopy(lang, "Book early for best rates", "尽早预订获取最优惠价格"),
    risks,
    tradeoffs: [],
    highlights: highlights.slice(0, 3),
    primary_action: primaryAction,
    secondary_actions: secondaryActions,
    evidence_card_id: evidenceCardId,
    score: computePackageScore(pkg),
    fallback_reason: fallbackReason,
  };
}
