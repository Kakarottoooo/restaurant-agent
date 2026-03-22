import { SmartphoneIntent, SmartphoneUseCase } from "../../types";
import { minimaxChat } from "../../minimax";

export async function parseSmartphoneIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<SmartphoneIntent> {
  const recentHistory = conversationHistory.slice(-6);
  const fallback: SmartphoneIntent = {
    category: "smartphone",
    use_cases: [],
    budget_usd_max: null,
    budget_usd_min: null,
    os_preference: "any",
    avoid_brands: [],
    needs_use_case_info: true,
    mentioned_models: [],
  };
  try {
    const text = await minimaxChat({
      system: `You extract smartphone purchase intent from user messages.
Return ONLY a valid JSON object:
{
  "use_cases": [],           // array of: "photography","gaming","business","everyday","budget_value"
  "budget_usd_max": null,    // number or null
  "budget_usd_min": null,    // number or null
  "os_preference": "any",    // "ios","android","any"
  "avoid_brands": [],        // brands to exclude
  "needs_use_case_info": false, // true if unclear what they'll use it for
  "mentioned_models": []     // specific models named e.g. ["iPhone 17","Galaxy S26"]
}
Rules:
- photography, camera, vlogging, TikTok, YouTube, content creation, selfie, front camera, video stabilization → "photography"
- gaming, high performance, benchmark, fps → "gaming"
- work, email, productivity, business → "business"
- general/all-around, display, battery, everyday use, screen, SOT, storage → "everyday"
- cheap, affordable, budget, under $X, value → "budget_value"
- "iOS","iPhone","Apple phone" → os_preference:"ios"
- "Android" → os_preference:"android"
- If user mentions battery life, screen quality, storage as primary concerns with no specific use case → "everyday"
- needs_use_case_info should be false whenever there is enough context to pick at least one use_case
- Extract budget ranges precisely`,
      messages: [...recentHistory, { role: "user" as const, content: userMessage }],
      max_tokens: 384,
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    const validUC: SmartphoneUseCase[] = ["photography", "gaming", "business", "everyday", "budget_value"];
    const use_cases = (p.use_cases ?? []).filter((u: string) => validUC.includes(u as SmartphoneUseCase));
    return {
      category: "smartphone",
      use_cases,
      budget_usd_max: p.budget_usd_max ?? null,
      budget_usd_min: p.budget_usd_min ?? null,
      os_preference: ["ios","android","any"].includes(p.os_preference) ? p.os_preference : "any",
      avoid_brands: Array.isArray(p.avoid_brands) ? p.avoid_brands : [],
      needs_use_case_info: p.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(p.mentioned_models) ? p.mentioned_models : [],
    };
  } catch {
    return fallback;
  }
}
