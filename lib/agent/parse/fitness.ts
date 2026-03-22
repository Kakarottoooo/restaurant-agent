import { FitnessActivity, FitnessIntent, FitnessSkillLevel, FitnessTimePreference, MultilingualQueryContext } from "../../types";

// ─── Activity detection ───────────────────────────────────────────────────────

const ACTIVITY_PATTERNS: Array<[RegExp, FitnessActivity, string]> = [
  [/\bhot\s+yoga\b|\bvinyasa\b|\byin\b|\basthtanga\b|\bashtanga\b|\bpower\s+yoga\b|\brestorative\b|\bkundalini\b|\bhatha\b|\byoga\b/, "yoga", "yoga"],
  [/\bpilates\b|\breformer\b/, "pilates", "pilates"],
  [/\bspin\b|\bindoor\s+cycling\b|\bcycling\s+class\b|\bpeloton\b/, "spin", "spin"],
  [/\bhiit\b|\bhigh.intensity\b|\bcircuit\s+training\b/, "hiit", "HIIT"],
  [/\bcrossfit\b|\bcross\s*fit\b/, "crossfit", "CrossFit"],
  [/\bkickboxing\b|\bmuay\s+thai\b|\bbox(?:ing)?\s+class\b/, "boxing", "boxing"],
  [/\bdance\s+class\b|\bzumba\b|\bsalsa\s+class\b|\bballroom\b|\bhip.hop\s+dance\b/, "dance", "dance"],
  [/\bmeditation\b|\bmindfulness\b|\bbreath(?:work|ing)\b/, "meditation", "meditation"],
  [/\bbarre\b/, "barre", "barre"],
  [/\bswimming\b|\bswim\s+class\b|\baqua\b/, "swimming", "swimming"],
  [/\brunning\s+club\b|\brun\s+group\b/, "running", "running club"],
  [/\bkarate\b|\bjiu.jitsu\b|\bjudo\b|\btaekwondo\b|\bmartial\s+arts\b/, "martial_arts", "martial arts"],
];

function detectActivity(lower: string): { activity: FitnessActivity; activityLabel: string; style?: string } {
  for (const [pattern, activity, label] of ACTIVITY_PATTERNS) {
    if (pattern.test(lower)) {
      // Extract style modifier for yoga
      let style: string | undefined;
      if (activity === "yoga") {
        if (/\bhot\b/.test(lower)) style = "hot";
        else if (/\bvinyasa\b/.test(lower)) style = "vinyasa";
        else if (/\bpower\b/.test(lower)) style = "power";
        else if (/\byin\b/.test(lower)) style = "yin";
        else if (/\bashtanga\b|\basthtanga\b/.test(lower)) style = "ashtanga";
        else if (/\brestorative\b/.test(lower)) style = "restorative";
        else if (/\bkundalini\b/.test(lower)) style = "kundalini";
        else if (/\bhatha\b/.test(lower)) style = "hatha";
      }
      const stylePrefix = style ? `${style} ` : "";
      return { activity, activityLabel: `${stylePrefix}${label}`, style };
    }
  }
  return { activity: "other", activityLabel: "fitness class" };
}

// ─── Time preference detection ────────────────────────────────────────────────

function detectTimePreference(lower: string): FitnessTimePreference {
  if (/\bmorning\b|\bam\b|\b[5-9]\s*(?:am|:00)\b|\bearly\b/.test(lower)) return "morning";
  if (/\bafternoon\b|\blunch(?:time)?\b|\b1[0-2]\s*(?:pm)?\b|\bnoon\b/.test(lower)) return "afternoon";
  if (/\bevening\b|\bnight\b|\bafter\s+work\b|\bpm\b|\b[5-9]\s*pm\b/.test(lower)) return "evening";
  return "any";
}

// ─── Day preference detection ─────────────────────────────────────────────────

function detectDayPreference(lower: string): string | undefined {
  if (/\bsaturday\b|\bsat\b/.test(lower)) return "Saturday";
  if (/\bsunday\b|\bsun\b/.test(lower)) return "Sunday";
  if (/\bweekend\b/.test(lower)) return "weekend";
  if (/\bweekday\b|\bmonday(?:\s+through\s+friday)?\b/.test(lower)) return "weekday";
  if (/\bmonday\b|\bmon\b/.test(lower)) return "Monday";
  if (/\btuesday\b|\btue\b/.test(lower)) return "Tuesday";
  if (/\bwednesday\b|\bwed\b/.test(lower)) return "Wednesday";
  if (/\bthursday\b|\bthu\b/.test(lower)) return "Thursday";
  if (/\bfriday\b|\bfri\b/.test(lower)) return "Friday";
  return undefined;
}

// ─── Skill level detection ────────────────────────────────────────────────────

function detectSkillLevel(lower: string): FitnessSkillLevel {
  if (/\bbeginner\b|\bnewbie\b|\bnew to\b|\bfirst time\b|\bstarter\b|\bnever done\b/.test(lower)) return "beginner";
  if (/\badvanced\b|\bexpert\b|\bexperienced\b/.test(lower)) return "advanced";
  if (/\bintermediate\b|\bsome experience\b/.test(lower)) return "intermediate";
  return "any";
}

// ─── Budget extraction ────────────────────────────────────────────────────────

function extractBudget(lower: string): number | undefined {
  const match =
    lower.match(/under\s+\$?\s*(\d+)/i) ??
    lower.match(/\$\s*(\d+)\s*(?:per class|a class|each|\/class)?/i) ??
    lower.match(/(\d+)\s*(?:dollars?|bucks?)\s*(?:per class|a class|each)?/i) ??
    lower.match(/(?:budget|spend|max)\s+(?:of\s+)?\$?\s*(\d+)/i);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  return isNaN(n) ? undefined : n;
}

// ─── Neighborhood extraction ──────────────────────────────────────────────────

function extractNeighborhood(message: string, lower: string): string | undefined {
  // "in Brooklyn", "in the West Village", "near SoHo"
  const inMatch = /\b(?:in|near|around)\s+(?:the\s+)?([A-Z][a-zA-Z\s]{2,25}?)(?:\s+(?:this|on|at|for|,|\.|$))/u.exec(message);
  if (inMatch) {
    const candidate = inMatch[1].trim();
    // Avoid matching activity names or time words
    if (!/\bmorning|afternoon|evening|class|studio|yoga|pilates|spin|saturday|sunday\b/i.test(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseFitnessIntent(
  userMessage: string,
  queryContext: MultilingualQueryContext
): FitnessIntent {
  const lower = userMessage.toLowerCase();

  const { activity, activityLabel, style } = detectActivity(lower);
  const timePreference = detectTimePreference(lower);
  const dayPreference = detectDayPreference(lower);
  const skillLevel = detectSkillLevel(lower);
  const neighborhood = extractNeighborhood(userMessage, lower) ?? queryContext.location_hint;

  // Treat GPS placeholder as no neighborhood
  const realNeighborhood =
    neighborhood && neighborhood !== "your current location"
      ? neighborhood
      : undefined;

  const budgetPerClass =
    extractBudget(lower) ??
    queryContext.budget_per_person_hint;

  // Derive city from location_hint or default
  const city =
    queryContext.location_hint && queryContext.location_hint !== "your current location"
      ? queryContext.location_hint
      : "New York, NY";

  const missingFields: string[] = [];
  if (!realNeighborhood && !queryContext.location_hint) missingFields.push("neighborhood");

  const assumptions: string[] = [];
  assumptions.push(`Activity: ${activityLabel}`);
  if (realNeighborhood) assumptions.push(`Location: ${realNeighborhood}`);
  else assumptions.push(`City: ${city}`);
  if (dayPreference) assumptions.push(`Day: ${dayPreference}`);
  if (timePreference !== "any") assumptions.push(`Time: ${timePreference}`);
  if (skillLevel !== "any") assumptions.push(`Level: ${skillLevel}`);
  if (budgetPerClass) assumptions.push(`Budget: up to $${budgetPerClass}/class`);

  return {
    category: "fitness",
    scenario: "fitness",
    scenario_goal: `Find ${activityLabel} classes${realNeighborhood ? ` in ${realNeighborhood}` : ""} in ${city}`,
    activity,
    activity_label: activityLabel,
    style,
    neighborhood: realNeighborhood,
    city,
    day_preference: dayPreference,
    time_preference: timePreference,
    budget_per_class: budgetPerClass,
    skill_level: skillLevel,
    planning_assumptions: assumptions,
    needs_clarification: false, // Google Places search is forgiving — try regardless
    missing_fields: missingFields,
  };
}
