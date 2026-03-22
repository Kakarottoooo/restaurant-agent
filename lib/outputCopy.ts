import { OutputLanguage } from "./types";

export function pickLanguageCopy(
  language: OutputLanguage | undefined,
  english: string,
  chinese: string
): string {
  return language === "zh" ? chinese : english;
}

export function formatConfidenceCopy(
  language: OutputLanguage | undefined,
  confidence: "high" | "medium" | "low"
): string {
  if (language === "zh") {
    const labels = { high: "高置信度", medium: "中置信度", low: "低置信度" } as const;
    return labels[confidence];
  }
  const labels = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;
  return labels[confidence];
}

export function getScenarioUiCopy(language: OutputLanguage | undefined) {
  return {
    scenarioPlan: pickLanguageCopy(language, "Scenario plan", "场景方案"),
    yourPlan: pickLanguageCopy(language, "Your plan", "你的方案"),
    estimatedSpend: pickLanguageCopy(language, "Estimated spend", "预计花费"),
    whyThisPlan: pickLanguageCopy(language, "Why this plan", "为什么推荐它"),
    timing: pickLanguageCopy(language, "Timing", "时间安排"),
    bestFor: pickLanguageCopy(language, "Best for", "最适合"),
    included: pickLanguageCopy(language, "Included", "方案内容"),
    tradeoffs: pickLanguageCopy(language, "Tradeoffs", "取舍"),
    nextActions: pickLanguageCopy(language, "Next actions", "下一步操作"),
    evidenceLayer: pickLanguageCopy(language, "Evidence layer", "证据层"),
    evidenceTitle: pickLanguageCopy(
      language,
      "What drove this package",
      "这个方案为什么会这样"
    ),
    planRisks: pickLanguageCopy(language, "Plan risks", "方案风险"),
    backupOptions: pickLanguageCopy(language, "Backup options", "备选方案"),
    keepOnDeck: pickLanguageCopy(language, "Keep these on deck", "先留作备选"),
    makePrimary: pickLanguageCopy(language, "Make primary", "设为主方案"),
    showAlternatives: pickLanguageCopy(language, "Show alternatives", "查看备选方案"),
    hideAlternatives: pickLanguageCopy(language, "Hide alternatives", "收起备选方案"),
  };
}

export function buildPlanFeedbackCopy(
  language: OutputLanguage | undefined,
  kind: "shared" | "promoted" | "approved" | "needs_changes" | "refining",
  title?: string
): string {
  switch (kind) {
    case "shared":
      return pickLanguageCopy(
        language,
        "Shared the current plan link.",
        "已分享当前方案链接。"
      );
    case "promoted":
      return pickLanguageCopy(
        language,
        `${title ?? "That option"} is now the main plan.`,
        `${title ?? "该方案"} 已设为主方案。`
      );
    case "approved":
      return pickLanguageCopy(
        language,
        "Marked this as your approved plan.",
        "已将它标记为你批准的方案。"
      );
    case "needs_changes":
      return pickLanguageCopy(
        language,
        "Captured that this plan needs changes.",
        "已记录这个方案还需要调整。"
      );
    case "refining":
      return pickLanguageCopy(
        language,
        `Refining with: ${title ?? "your tweak"}`,
        `正在按这个方向细化：${title ?? "你的调整"}`
      );
    default:
      return "";
  }
}

export function localizeFieldName(
  field: string,
  language: OutputLanguage | undefined
): string {
  if (language !== "zh") return field;

  const dictionary: Record<string, string> = {
    destination: "目的地",
    "travel dates": "出行日期",
    "different dates or destination": "换一个日期或目的地",
    "monthly spending by category": "每月各类消费",
    "cash back or travel rewards preference": "返现还是旅行积分偏好",
    "any cards you already hold": "你目前已有的卡",
    use_case: "使用场景",
  };

  return dictionary[field] ?? field;
}

export function localizeFieldList(
  fields: string[],
  language: OutputLanguage | undefined
): string[] {
  return fields.map((field) => localizeFieldName(field, language));
}

export function buildWeekendTripFollowupCopy(
  language: OutputLanguage | undefined,
  missingFields: string[],
  assumption?: string
): string {
  const localizedFields = localizeFieldList(missingFields, language);

  if (language === "zh") {
    const parts = [
      "我可以继续给你生成周末旅行方案，但还差一两个关键信息。",
      localizedFields.length > 0 ? `还缺：${localizedFields.join("、")}。` : "",
      assumption ? `当前假设：${assumption}` : "",
    ].filter(Boolean);
    return parts.join("\n\n");
  }

  const parts = [
    "I can build a weekend-trip package, but I need one or two more details first.",
    localizedFields.length > 0 ? `Missing: ${localizedFields.join(", ")}.` : "",
    assumption ? `Current assumption: ${assumption}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildCityTripFollowupCopy(
  language: OutputLanguage | undefined,
  missingFields: string[],
  assumption?: string
): string {
  const localizedFields = localizeFieldList(missingFields, language);

  if (language === "zh") {
    const parts = [
      "我可以继续给你生成城市旅行方案，但还差一两个关键信息。",
      localizedFields.length > 0 ? `还缺：${localizedFields.join("、")}。` : "",
      assumption ? `当前假设：${assumption}` : "",
    ].filter(Boolean);
    return parts.join("\n\n");
  }

  const parts = [
    "I can build a city-trip package, but I need one or two more details first.",
    localizedFields.length > 0 ? `Missing: ${localizedFields.join(", ")}.` : "",
    assumption ? `Current assumption: ${assumption}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildRestaurantFoundCopy(
  language: OutputLanguage | undefined,
  count: number
): string {
  return pickLanguageCopy(
    language,
    `Found ${count} restaurant${count > 1 ? "s" : ""} for you.`,
    `为你找到 ${count} 家餐厅。`
  );
}

export function buildNoRestaurantCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    "No restaurants matched your search. Try broadening your criteria: different cuisine, price range, or neighborhood.",
    "没有找到符合条件的餐厅。可以试试放宽条件，比如换个菜系、预算或区域。"
  );
}

export function buildHotelFoundCopy(
  language: OutputLanguage | undefined,
  count: number
): string {
  return pickLanguageCopy(
    language,
    `Found ${count} hotel${count > 1 ? "s" : ""} for you.`,
    `为你找到 ${count} 家酒店。`
  );
}

export function buildNoHotelCopy(language: OutputLanguage | undefined): string {
  return pickLanguageCopy(
    language,
    "No hotels matched your search. Try adjusting your dates, budget, or location.",
    "没有找到符合条件的酒店。可以试试调整日期、预算或位置。"
  );
}

export function buildFlightNeedInfoCopy(
  language: OutputLanguage | undefined,
  missingFields: string[]
): string {
  const localizedFields = localizeFieldList(missingFields, language);
  return pickLanguageCopy(
    language,
    `To search for flights, I need a bit more info: **${localizedFields.join(", ")}**. Could you provide those?`,
    `要帮你查航班，我还需要这些信息：**${localizedFields.join("、")}**。`
  );
}

export function buildNoFlightCopy(language: OutputLanguage | undefined): string {
  return pickLanguageCopy(
    language,
    "No flights found for that route. Try adjusting your dates or airports.",
    "这条航线暂时没有找到合适航班。可以试试调整日期或机场。"
  );
}

export function buildFlightFoundCopy(
  language: OutputLanguage | undefined,
  count: number,
  noDirectAvailable: boolean
): string {
  if (noDirectAvailable) {
    return pickLanguageCopy(
      language,
      "No nonstop flights found for that route. Here are the best connecting options:",
      "这条航线暂时没有直飞航班，下面是最合适的中转方案。"
    );
  }

  return pickLanguageCopy(
    language,
    `Found ${count} flight${count > 1 ? "s" : ""} for you.`,
    `为你找到 ${count} 个航班方案。`
  );
}

export function buildCreditCardNeedInfoCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    `To find the best card for you, I need a few details:

1. **Monthly spending** - roughly how much do you spend on dining, groceries, travel, gas, and other categories each month?
2. **Reward preference** - do you prefer cash back or travel points/miles?
3. **Existing cards** - any cards you already hold? (I'll calculate the marginal value of adding a new one.)

Even rough estimates work great!`,
    `要帮你找到最适合的卡，我还需要几个信息：

1. **每月消费结构** - 你大概每月在餐饮、超市、旅行、加油和其他类别各花多少？
2. **奖励偏好** - 你更想要返现还是旅行积分/里程？
3. **已有卡片** - 你现在手上已经有哪些卡？（我会算新增一张卡的边际价值。）

给个大概范围就够用了。`
  );
}

export function buildCreditCardNoResultsCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    "I couldn't generate card recommendations. Please tell me your monthly spending and whether you prefer cash back or travel rewards.",
    "我现在还没法稳定给出信用卡推荐。你可以告诉我每月消费结构，以及你更偏好返现还是旅行奖励。"
  );
}

export function buildLaptopNeedInfoCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    `To find the best laptop for you, I need to know **how you'll use it**. Please tell me:

1. **Primary use case** - e.g. coding, video editing, gaming, business travel, general productivity, data science
2. **Budget** - rough price range in USD (optional)
3. **OS preference** - Mac, Windows, Linux, or no preference
4. **Portability** - how important are weight and battery life?`,
    `要帮你选最合适的笔记本，我需要先知道 **你准备怎么用它**。请告诉我：

1. **主要用途** - 比如写代码、剪视频、打游戏、商务出差、日常办公、数据科学
2. **预算** - 大概的美元价格范围（可选）
3. **系统偏好** - Mac、Windows、Linux，还是都可以
4. **便携需求** - 你有多在意重量和续航？`
  );
}

export function buildLaptopFoundCopy(
  language: OutputLanguage | undefined,
  count: number
): string {
  return pickLanguageCopy(
    language,
    `Here are the top ${count} laptop${count > 1 ? "s" : ""} ranked for your use case.`,
    `下面是按你的使用场景排出来的前 ${count} 台笔记本。`
  );
}

export function buildSmartphoneNeedInfoCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    `To find the best smartphone for you, I need to know **how you'll use it**. Please tell me:

1. **Primary use case** - e.g. photography, gaming, business, everyday, or best value
2. **Budget** - rough price range in USD (optional)
3. **OS preference** - iOS, Android, or no preference
4. **Brands to avoid** (optional)`,
    `要帮你选最合适的手机，我需要先知道 **你准备怎么用它**。请告诉我：

1. **主要用途** - 比如拍照、游戏、商务、日常，或者追求性价比
2. **预算** - 大概的美元价格范围（可选）
3. **系统偏好** - iOS、Android，还是都可以
4. **想避开的品牌**（可选）`
  );
}

export function buildSmartphoneFoundCopy(
  language: OutputLanguage | undefined,
  count: number
): string {
  return pickLanguageCopy(
    language,
    `Here are the top ${count} smartphone${count > 1 ? "s" : ""} ranked for your use case.`,
    `下面是按你的使用场景排出来的前 ${count} 部手机。`
  );
}

export function buildHeadphoneNeedInfoCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    `To find the best headphones for you, I need to know **how you'll use them**. Please tell me:

1. **Primary use case** - e.g. commuting, work from home, audiophile listening, sport/workout, or casual
2. **Budget** - rough price range in USD (optional)
3. **Form factor preference** - over-ear, in-ear, on-ear, or no preference
4. **Wireless required?** (yes/no)`,
    `要帮你选最合适的耳机，我需要先知道 **你准备怎么用它们**。请告诉我：

1. **主要用途** - 比如通勤、居家办公、发烧听音、运动健身、日常使用
2. **预算** - 大概的美元价格范围（可选）
3. **形态偏好** - 头戴、入耳、贴耳，还是都可以
4. **是否必须无线？**（是/否）`
  );
}

export function buildHeadphoneFoundCopy(
  language: OutputLanguage | undefined,
  count: number
): string {
  return pickLanguageCopy(
    language,
    `Here are the top ${count} headphone${count > 1 ? "s" : ""} picks ranked for your use case.`,
    `下面是按你的使用场景排出来的前 ${count} 个耳机推荐。`
  );
}

export function buildSubscriptionUnknownCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    'I could not figure out which product category to watch. You can try something like "tell me when Apple releases a new MacBook" or "notify me about new NVIDIA GPUs".',
    '我还没识别出你想追踪哪个产品类别。你可以试试说“苹果发新 MacBook 的时候提醒我”或者“有新的 NVIDIA 显卡时通知我”。'
  );
}

export function buildGenericErrorCopy(
  language: OutputLanguage | undefined
): string {
  return pickLanguageCopy(
    language,
    "Something went wrong. Please try again.",
    "出了点问题，请再试一次。"
  );
}
