import { ConcertEventIntent, DecisionPlan, OutputLanguage, PlanAction, PlanOption, DecisionEvidenceItem } from "../../types";
import { TicketmasterEvent } from "../../types";
import { pickLanguageCopy } from "../../outputCopy";
import { searchConcertEvents } from "../../ticketmaster";

function formatPrice(min?: number, max?: number): string {
  if (!min && !max) return "Price TBD";
  if (min && max && min !== max) return `$${min}–$${max}`;
  return `$${min ?? max}`;
}

function formatDateTime(date: string, time?: string, lang: OutputLanguage = "en"): string {
  if (!date) return pickLanguageCopy(lang, "Date TBD", "日期待定");
  try {
    const d = new Date(date + (time ? `T${time}` : "T00:00:00"));
    const datePart = d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    const timePart = time
      ? d.toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" })
      : "";
    return timePart ? `${datePart} · ${timePart}` : datePart;
  } catch {
    return date + (time ? ` ${time}` : "");
  }
}

function tierLabel(idx: number, lang: OutputLanguage): string {
  const labels = [
    [pickLanguageCopy(lang, "Top pick", "最佳推荐"), pickLanguageCopy(lang, "Most exciting", "最受期待"), pickLanguageCopy(lang, "Hidden gem", "小众精选")],
  ];
  return labels[0][idx] ?? pickLanguageCopy(lang, "Option", "选项");
}

function buildEventPlanOption(
  event: TicketmasterEvent,
  idx: number,
  intent: ConcertEventIntent,
  lang: OutputLanguage
): PlanOption {
  const label = tierLabel(idx, lang);
  const priceStr = formatPrice(event.price_min, event.price_max);
  const dateTimeStr = formatDateTime(event.date, event.time, lang);
  const perPersonNote = intent.travelers > 1
    ? pickLanguageCopy(lang, ` × ${intent.travelers} people`, ` × ${intent.travelers} 人`)
    : "";

  const highlights: string[] = [
    pickLanguageCopy(lang, `📍 ${event.venue_name}`, `📍 ${event.venue_name}`),
    pickLanguageCopy(lang, `🗓 ${dateTimeStr}`, `🗓 ${dateTimeStr}`),
    pickLanguageCopy(lang, `🎟 ${priceStr}${perPersonNote}`, `🎟 ${priceStr}${perPersonNote}`),
  ];
  if (event.genre) {
    highlights.push(pickLanguageCopy(lang, `🎵 ${event.genre}`, `🎵 ${event.genre}`));
  }

  const primaryAction = {
    id: `buy-tickets-${event.id}`,
    label: pickLanguageCopy(lang, "Buy tickets", "购买门票"),
    url: event.url,
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_name + " " + event.venue_address)}`;
  const secondaryActions = [
    {
      id: `venue-map-${event.id}`,
      label: pickLanguageCopy(lang, "View venue", "查看场馆"),
      url: mapsUrl,
    },
  ];

  // Score: favour idx 0 (most popular from TM default sort), slight decay for others
  const score = Math.max(7, 9.5 - idx * 0.8);

  return {
    id: `event-opt-${idx}-${event.id}`,
    label,
    option_category: "trip",
    title: event.name,
    subtitle: pickLanguageCopy(
      lang,
      `${event.venue_name} · ${event.city}`,
      `${event.venue_name} · ${event.city}`
    ),
    summary: pickLanguageCopy(
      lang,
      `${event.name} at ${event.venue_name}. ${priceStr} per ticket${intent.travelers > 1 ? ` (${intent.travelers} people)` : ""}. ${event.genre ? `Genre: ${event.genre}.` : ""}`,
      `${event.name}，在 ${event.venue_name} 举行。门票 ${priceStr}${intent.travelers > 1 ? `（${intent.travelers} 人）` : ""}。${event.genre ? `类型：${event.genre}。` : ""}`
    ),
    why_this_now: pickLanguageCopy(
      lang,
      `Live events sell out fast — ${event.date ? `this is on ${event.date}` : "dates are limited"}. Book now to lock in your spot.`,
      `现场活动门票紧俏${event.date ? `，活动时间为 ${event.date}` : ""}，趁早购票锁定名额。`
    ),
    best_for: pickLanguageCopy(
      lang,
      intent.travelers > 1 ? "Groups and friends" : "Solo or couples",
      intent.travelers > 1 ? "团体或朋友聚会" : "独行或双人出行"
    ),
    estimated_total: priceStr + perPersonNote,
    timing_note: dateTimeStr,
    risks: event.price_min
      ? [pickLanguageCopy(lang, "Prices may increase as the event approaches.", "临近活动日期票价可能上涨。")]
      : [pickLanguageCopy(lang, "Price not listed — check Ticketmaster for current availability.", "票价暂未公示，请在 Ticketmaster 查看最新情况。")],
    tradeoffs: [],
    highlights,
    primary_action: primaryAction,
    secondary_actions: secondaryActions,
    score,
  };
}

function buildNextActions(lang: OutputLanguage): PlanAction[] {
  return [
    {
      id: "refine",
      type: "refine",
      label: pickLanguageCopy(lang, "Different dates or genre", "换日期或类型"),
      description: pickLanguageCopy(lang, "Search for different events", "搜索其他活动"),
      prompt: pickLanguageCopy(lang, "Show me different dates or a different genre", "换个日期或类型帮我找"),
    },
    {
      id: "share_plan",
      type: "share_plan",
      label: pickLanguageCopy(lang, "Share this", "分享"),
      description: pickLanguageCopy(lang, "Share these event options with your group", "把这些活动选项分享给你的团队"),
    },
    {
      id: "send_for_vote",
      type: "send_for_vote",
      label: pickLanguageCopy(lang, "Vote on it", "投票决定"),
      description: pickLanguageCopy(lang, "Let your group pick the event", "让大家投票选活动"),
    },
  ];
}

export async function runConcertEventPlanner(params: {
  intent: ConcertEventIntent;
  outputLanguage: OutputLanguage;
}): Promise<DecisionPlan | null> {
  const { intent, outputLanguage: lang } = params;

  // Build Ticketmaster search params
  const startDate = intent.event_date
    ? `${intent.event_date}T00:00:00Z`
    : new Date().toISOString();

  const classificationName = (() => {
    switch (intent.event_type) {
      case "sports": return "Sports";
      case "theater": return "Arts & Theatre";
      case "comedy": return "Comedy";
      default: return "Music";
    }
  })();

  // Extract city name without state for Ticketmaster (it searches by city name)
  const cityName = intent.event_city.split(",")[0].trim();

  const events = await searchConcertEvents({
    keyword: intent.keyword,
    city: cityName,
    startDateTime: startDate,
    classificationName,
    size: 9,
  });

  if (events.length === 0) return null;

  // Deduplicate by event name (sometimes TM returns duplicates for multi-venue legs)
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = e.name.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Pick up to 3 — TM default sort is by relevance/date, so top 3 is already best/exciting/unique-ish
  const picked = unique.slice(0, 3);

  const options: PlanOption[] = picked.map((event, idx) =>
    buildEventPlanOption(event, idx, intent, lang)
  );

  const primary = options[0];
  const backups = options.slice(1);

  const evidenceItems: DecisionEvidenceItem[] = picked.map((event) => ({
    id: event.id,
    title: event.name,
    detail: `${event.venue_name} · ${formatPrice(event.price_min, event.price_max)}`,
    tag: event.genre,
  }));

  const titleKeyword = intent.keyword ?? (intent.event_type !== "other" ? intent.event_type : "events");

  return {
    id: `concert-${cityName}-${intent.event_date ?? "soon"}-${Date.now()}`,
    scenario: "concert_event",
    output_language: lang,
    title: pickLanguageCopy(
      lang,
      `${titleKeyword} events in ${intent.event_city}`,
      `${intent.event_city} ${titleKeyword} 活动`
    ),
    summary: pickLanguageCopy(
      lang,
      `I found ${picked.length} ${picked.length === 1 ? "event" : "events"} matching your search. Each includes a direct link to buy tickets on Ticketmaster.`,
      `我找到了 ${picked.length} 个符合你要求的活动，每个都附有 Ticketmaster 购票链接。`
    ),
    approval_prompt: pickLanguageCopy(
      lang,
      "Pick the event you want — tap Buy tickets to lock in your spot.",
      "选择你想去的活动——点击「购买门票」锁定名额。"
    ),
    confidence: picked.length >= 3 ? "high" : picked.length >= 1 ? "medium" : "low",
    scenario_brief: intent.planning_assumptions,
    primary_plan: primary,
    backup_plans: backups,
    tradeoff_summary: pickLanguageCopy(
      lang,
      "Top pick is the most prominent result for your search. Other options offer different dates, venues, or vibes — explore all before buying.",
      "首推是最匹配你搜索条件的活动。其他选项有不同的日期、场馆或氛围——建议都看看再购票。"
    ),
    event_datetime: picked[0].date
      ? `${picked[0].date}T${picked[0].time ?? "20:00:00"}`
      : undefined,
    event_location: picked[0].venue_name,
    risks: [
      pickLanguageCopy(lang, "Ticket availability changes quickly — book as soon as you decide.", "门票库存变化快，决定好就尽快购票。"),
      pickLanguageCopy(lang, "Check the venue's bag policy before attending.", "入场前请确认场馆的随身物品政策。"),
    ],
    next_actions: buildNextActions(lang),
    evidence_card_ids: picked.map((e) => e.id),
    evidence_items: evidenceItems,
  };
}
