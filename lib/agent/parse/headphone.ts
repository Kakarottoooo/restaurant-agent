import { HeadphoneIntent, HeadphoneUseCase } from "../../types";
import { minimaxChat } from "../../minimax";

export async function parseHeadphoneIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<HeadphoneIntent> {
  const recentHistory = conversationHistory.slice(-6);
  const fallback: HeadphoneIntent = {
    category: "headphone",
    use_cases: [],
    budget_usd_max: null,
    budget_usd_min: null,
    form_factor_preference: "any",
    wireless_required: null,
    avoid_brands: [],
    needs_use_case_info: true,
    mentioned_models: [],
  };
  try {
    const text = await minimaxChat({
      system: `You extract headphone purchase intent from user messages.
Return ONLY a valid JSON object:
{
  "use_cases": [],                   // array of: "commute","work_from_home","audiophile","sport","casual"
  "budget_usd_max": null,            // number or null
  "budget_usd_min": null,            // number or null
  "form_factor_preference": "any",   // "over_ear","in_ear","on_ear","any"
  "wireless_required": null,         // true/false/null
  "avoid_brands": [],
  "needs_use_case_info": false,
  "mentioned_models": []             // e.g. ["WH-1000XM6","AirPods Pro 3"]
}
Rules:
- commute, travel, subway, plane → "commute"
- office, work, calls, meetings → "work_from_home"
- audiophile, critical listening, studio, hi-fi → "audiophile"
- gym, running, workout, sport → "sport"
- general, everyday, music → "casual"
- over-ear, over ear, headphones → form_factor:"over_ear"
- in-ear, earbuds, earphones → form_factor:"in_ear"
- "wireless","bluetooth" → wireless_required:true
- "wired" → wireless_required:false`,
      messages: [...recentHistory, { role: "user" as const, content: userMessage }],
      max_tokens: 384,
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    const validUC: HeadphoneUseCase[] = ["commute", "work_from_home", "audiophile", "sport", "casual"];
    const use_cases = (p.use_cases ?? []).filter((u: string) => validUC.includes(u as HeadphoneUseCase));
    return {
      category: "headphone",
      use_cases,
      budget_usd_max: p.budget_usd_max ?? null,
      budget_usd_min: p.budget_usd_min ?? null,
      form_factor_preference: ["over_ear","in_ear","on_ear","any"].includes(p.form_factor_preference) ? p.form_factor_preference : "any",
      wireless_required: p.wireless_required ?? null,
      avoid_brands: Array.isArray(p.avoid_brands) ? p.avoid_brands : [],
      needs_use_case_info: p.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(p.mentioned_models) ? p.mentioned_models : [],
    };
  } catch {
    return fallback;
  }
}
