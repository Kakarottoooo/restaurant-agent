import { SubscriptionIntent } from "../../types";
import type { WatchCategory } from "../../watchTypes";
import { minimaxChat } from "../../minimax";

export async function parseSubscriptionIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<SubscriptionIntent> {
  const recentHistory = conversationHistory.slice(-4);
  const fallback: SubscriptionIntent = {
    category: "subscription",
    action: "subscribe",
    watch_category: null,
    brands: [],
    keywords: [],
    label: "new product releases",
  };

  try {
    const text = await minimaxChat({
      system: `You parse product release subscription requests.
Return ONLY a valid JSON object:
{
  "action": "subscribe",       // "subscribe" | "unsubscribe" | "list"
  "watch_category": "laptop",  // "laptop" | "gpu" | "phone" | "car" | "tablet" | "monitor" | null
  "brands": [],                // brand names explicitly mentioned, e.g. ["Apple","NVIDIA"]
  "keywords": [],              // specific product line keywords, e.g. ["MacBook Pro","RTX 5090"]
  "label": ""                  // short human-readable label, e.g. "Apple MacBook releases"
}

Rules:
- action: "list" if user asks what they're subscribed to
- action: "unsubscribe" if user wants to stop notifications
- watch_category: detect from context:
    laptop → laptop, MacBook, ThinkPad, notebook computer
    gpu → GPU, graphics card, RTX, Radeon, GeForce
    phone → phone, iPhone, smartphone, Galaxy, Pixel
    car → car, EV, Tesla, electric vehicle
    tablet → tablet, iPad
    monitor → monitor, display, screen
- brands: only names explicitly stated, no inference
- keywords: specific product names mentioned (e.g. "RTX 5090") but NOT generic category words
- label: concise English summary, max 6 words`,
      messages: [
        ...recentHistory,
        { role: "user" as const, content: userMessage },
      ],
      max_tokens: 256,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);

    const validActions = ["subscribe", "unsubscribe", "list"];
    const validCategories: WatchCategory[] = ["laptop", "smartphone", "headphone", "gpu", "car", "tablet", "monitor"];

    return {
      category: "subscription",
      action: validActions.includes(parsed.action) ? parsed.action : "subscribe",
      watch_category: validCategories.includes(parsed.watch_category) ? parsed.watch_category : null,
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      label: typeof parsed.label === "string" ? parsed.label : fallback.label,
    };
  } catch {
    return fallback;
  }
}
