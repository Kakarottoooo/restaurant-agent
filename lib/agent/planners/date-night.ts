import { RestaurantIntent, DateNightIntent, MultilingualQueryContext } from "../../types";

export function buildDateNightFallbackIntent(
  userMessage: string,
  intent: RestaurantIntent,
  queryContext?: MultilingualQueryContext
): DateNightIntent | null {
  const lower = userMessage.toLowerCase();
  const hasEnglishDateSignal =
    /date night|first date|romantic|anniversary|proposal|girlfriend|boyfriend|wife|husband|partner|romance|dating/.test(
      lower
    );
  const hasChineseDateSignal =
    /\u7ea6\u4f1a|\u7b2c\u4e00\u6b21\u7ea6\u4f1a|\u7b2c\u4e00\u6b21\u89c1\u9762|\u6d6a\u6f2b|\u7eaa\u5ff5\u65e5|\u8868\u767d|\u5973\u670b\u53cb|\u7537\u670b\u53cb|\u8001\u5a46|\u8001\u516c/.test(
      userMessage
    );

  if (
    queryContext?.scenario_hint !== "date_night" &&
    intent.purpose !== "date" &&
    queryContext?.purpose_hint !== "date" &&
    !hasEnglishDateSignal &&
    !hasChineseDateSignal
  ) {
    return null;
  }

  const stage =
    /first date/.test(lower) ||
    /\u7b2c\u4e00\u6b21\u7ea6\u4f1a|\u7b2c\u4e00\u6b21\u89c1\u9762/.test(userMessage)
      ? "first_date"
      : /anniversary|birthday dinner|proposal/.test(lower) ||
        /\u7eaa\u5ff5\u65e5|\u751f\u65e5\u665a\u9910|\u8868\u767d/.test(userMessage)
      ? "anniversary"
      : /surprise/.test(lower) || /\u60ca\u559c/.test(userMessage)
      ? "surprise"
      : /wife|husband|partner|boyfriend|girlfriend|fiance|fiancee/.test(lower) ||
        /\u8001\u5a46|\u8001\u516c|\u5bf9\u8c61|\u5973\u670b\u53cb|\u7537\u670b\u53cb/.test(userMessage)
      ? "steady_relationship"
      : "casual_date";

  const followUpPreference =
    /dessert|ice cream/.test(lower)
      ? "dessert"
      : /cocktail|bar|wine|drinks/.test(lower)
      ? "cocktail"
      : /walk|stroll/.test(lower) || /\u6563\u6b65/.test(userMessage)
      ? "walk"
      : /just dinner|only dinner/.test(lower) ||
        /\u53ea\u5403\u996d|\u53ea\u5403\u665a\u9910/.test(userMessage)
      ? "none"
      : "open";

  const decisionStyle =
    /safe|steady|don't want to mess up|reliable/.test(lower) ||
    /\u7a33\u4e00\u70b9|\u7a33\u59a5|\u522b\u51fa\u9519|\u9760\u8c31/.test(userMessage)
      ? "safe"
      : /impress|special|fancy|wow/.test(lower) ||
        /\u9ad8\u7ea7|\u7279\u522b|\u60ca\u8273|\u6709\u6c1b\u56f4/.test(userMessage)
      ? "impressive"
      : /playful|fun|lively/.test(lower) ||
        /\u597d\u73a9|\u6d3b\u6cfc|\u70ed\u95f9/.test(userMessage)
      ? "playful"
      : /relaxed|easy|casual/.test(lower) ||
        /\u8f7b\u677e|\u968f\u610f|\u4e0d\u8981\u592a\u6b63\u5f0f/.test(userMessage)
      ? "relaxed"
      : "romantic";

  const withMinutes = lower.match(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/);
  const hourOnly = lower.match(/\b\d{1,2}\s*(am|pm)\b/);
  const timeHint =
    queryContext?.time_hint ??
    withMinutes?.[0] ??
    hourOnly?.[0] ??
    (/early dinner/.test(lower)
      ? "7:00 pm"
      : /late dinner/.test(lower)
      ? "8:30 pm"
      : /dinner/.test(lower) || /\u665a\u4e0a|\u665a\u996d|\u665a\u9910/.test(userMessage)
      ? "7:30 pm"
      : /\u4e2d\u5348|\u5348\u996d|\u5348\u9910/.test(userMessage)
      ? "12:30 pm"
      : /\u65e9\u9910|\u65e9\u996d/.test(userMessage)
      ? "9:00 am"
      : undefined);

  const englishWeekday = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    .find((day) => lower.includes(day));
  const chineseWeekdayMap: Array<{ english: string; aliases: string[] }> = [
    { english: "monday", aliases: ["\u5468\u4e00", "\u661f\u671f\u4e00", "\u793c\u62dc\u4e00"] },
    { english: "tuesday", aliases: ["\u5468\u4e8c", "\u661f\u671f\u4e8c", "\u793c\u62dc\u4e8c"] },
    { english: "wednesday", aliases: ["\u5468\u4e09", "\u661f\u671f\u4e09", "\u793c\u62dc\u4e09"] },
    { english: "thursday", aliases: ["\u5468\u56db", "\u661f\u671f\u56db", "\u793c\u62dc\u56db"] },
    { english: "friday", aliases: ["\u5468\u4e94", "\u661f\u671f\u4e94", "\u793c\u62dc\u4e94"] },
    { english: "saturday", aliases: ["\u5468\u516d", "\u661f\u671f\u516d", "\u793c\u62dc\u516d"] },
    { english: "sunday", aliases: ["\u5468\u65e5", "\u5468\u5929", "\u661f\u671f\u65e5", "\u661f\u671f\u5929", "\u793c\u62dc\u65e5", "\u793c\u62dc\u5929"] },
  ];
  const chineseWeekday = chineseWeekdayMap.find(({ aliases }) =>
    aliases.some((alias) => userMessage.includes(alias))
  );
  const detectedDateText =
    queryContext?.date_text_hint ??
    lower.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ??
    (/\u4eca\u665a/.test(userMessage)
      ? "tonight"
      : /\u660e\u5929/.test(userMessage)
      ? "tomorrow"
      : /\u4eca\u5929/.test(userMessage)
      ? "today"
      : englishWeekday
      ? lower.includes(`next ${englishWeekday}`)
        ? `next ${englishWeekday}`
        : lower.includes(`this ${englishWeekday}`)
        ? `this ${englishWeekday}`
        : englishWeekday
      : chineseWeekday
      ? (() => {
          const alias = chineseWeekday.aliases.find((item) => userMessage.includes(item));
          if (!alias) return chineseWeekday.english;
          const weekdaySuffix = alias.slice(-1);
          return userMessage.includes(`\u4e0b${alias}`) ||
            userMessage.includes(`\u4e0b\u5468${weekdaySuffix}`) ||
            userMessage.includes(`\u4e0b\u661f\u671f${weekdaySuffix}`) ||
            userMessage.includes(`\u4e0b\u793c\u62dc${weekdaySuffix}`)
            ? `next ${chineseWeekday.english}`
            : chineseWeekday.english;
        })()
      : undefined);

  const scenarioLocation =
    intent.neighborhood ??
    intent.near_location ??
    queryContext?.location_hint ??
    intent.location ??
    "the right area";
  const budgetLabel =
    intent.budget_total != null
      ? `around $${intent.budget_total} total`
      : intent.budget_per_person != null
      ? `around $${intent.budget_per_person}/person`
      : "within a comfortable dinner budget";

  return {
    ...intent,
    category: "restaurant",
    scenario: "date_night",
    scenario_goal: `Find a dinner plan for a date night in ${scenarioLocation} ${budgetLabel}, with enough confidence that the user can approve a single option quickly.`,
    stage,
    follow_up_preference: followUpPreference,
    decision_style: decisionStyle,
    time_hint: timeHint,
    detected_date_text: detectedDateText,
    wants_quiet_buffer:
      intent.noise_level === "quiet" ||
      /quiet|calm|not too loud|low noise|easy conversation/i.test(userMessage) ||
      /\u5b89\u9759|\u4e0d\u8981\u592a\u5435|\u522b\u592a\u5435/.test(userMessage),
  };
}
