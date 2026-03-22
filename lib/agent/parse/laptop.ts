import { LaptopIntent, LaptopUseCase } from "../../types";
import { minimaxChat } from "../../minimax";

export async function parseLaptopIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<LaptopIntent> {
  const recentHistory = conversationHistory.slice(-6);
  try {
    const text = await minimaxChat({
      system: `You are a laptop recommendation assistant. Extract structured intent from user messages.
Return ONLY a valid JSON object with exactly these fields:
{
  "use_cases": [],           // array of: "light_productivity","software_dev","video_editing","3d_creative","gaming","data_science","business_travel"
  "budget_usd_max": null,    // number or null
  "budget_usd_min": null,    // number or null
  "os_preference": "any",    // "mac","windows","linux","any"
  "portability_priority": "flexible",  // "critical","preferred","flexible"
  "gaming_required": false,  // boolean
  "display_size_preference": "any",    // "<14","14-15","15+","any"
  "avoid_brands": [],        // e.g. ["Dell","HP"]
  "needs_use_case_info": false,  // true if user didn't clearly specify what they'll use it for
  "mentioned_models": []     // specific device names or chip generations explicitly named by the user, e.g. ["MacBook Pro M5","M4 Pro","RTX 5090"]. Empty if none mentioned.
}

Rules:
- If user says "for coding" or "developer" → use_cases: ["software_dev"]
- If user says "video editing" → use_cases: ["video_editing"]
- If user says "gaming" → use_cases: ["gaming"], gaming_required: true
- If user says "data science","ML","AI" → use_cases: ["data_science"]
- If user says "travel","on the go","lightweight","portable" → use_cases: ["business_travel"], portability_priority: "critical" or "preferred"
- If user says "everyday","general use","Office" → use_cases: ["light_productivity"]
- Multiple use cases are allowed
- If user says "MacBook" or "Mac" or "Apple" → os_preference: "mac"
- If user says "Windows" → os_preference: "windows"
- Extract budget: "$1000-1500" → budget_usd_min:1000, budget_usd_max:1500; "under $1200" → budget_usd_max:1200; "budget" → budget_usd_max:800
- If user doesn't mention what they'll use it for, set needs_use_case_info: true
- For mentioned_models: only include names the user explicitly stated, not inferred ones`,
      messages: [
        ...recentHistory,
        { role: "user" as const, content: userMessage },
      ],
      max_tokens: 512,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const use_cases: LaptopUseCase[] = (parsed.use_cases ?? []).filter((u: string) =>
      ["light_productivity","software_dev","video_editing","3d_creative","gaming","data_science","business_travel"].includes(u)
    );

    return {
      category: "laptop",
      use_cases: use_cases.length > 0 ? use_cases : [],
      budget_usd_max: parsed.budget_usd_max ?? null,
      budget_usd_min: parsed.budget_usd_min ?? null,
      os_preference: parsed.os_preference ?? "any",
      portability_priority: parsed.portability_priority ?? "flexible",
      gaming_required: parsed.gaming_required ?? false,
      display_size_preference: parsed.display_size_preference ?? "any",
      avoid_brands: parsed.avoid_brands ?? [],
      needs_use_case_info: parsed.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(parsed.mentioned_models) ? parsed.mentioned_models : [],
    };
  } catch {
    return {
      category: "laptop",
      use_cases: [],
      budget_usd_max: null,
      budget_usd_min: null,
      os_preference: "any",
      portability_priority: "flexible",
      gaming_required: false,
      display_size_preference: "any",
      avoid_brands: [],
      needs_use_case_info: true,
      mentioned_models: [],
    };
  }
}
