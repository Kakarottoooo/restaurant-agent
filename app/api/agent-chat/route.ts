/**
 * POST /api/agent-chat
 *
 * Two modes:
 *
 * mode: "question" (default on card mount)
 *   Agent analyzes what it knows about the failed step and asks ONE specific
 *   question — what does it need from the user to proceed?
 *   Body: { mode: "question", stepLabel, originalTask, decisionLog, error }
 *   Response: { question }
 *
 * mode: "answer"
 *   User answered the agent's question. Agent decides: retry with the new info,
 *   or explain what else is needed.
 *   Body: { mode: "answer", answer, stepLabel, originalTask, decisionLog, error }
 *   Response: { reply, retryNow, enrichedTask }
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const {
    mode = "question",
    stepLabel,
    originalTask,
    decisionLog,
    error: stepError,
    answer,
  } = body as {
    mode?: "question" | "answer";
    stepLabel: string;
    originalTask?: string;
    decisionLog?: Array<{ type: string; message: string; outcome?: string }>;
    error?: string;
    answer?: string;
  };

  // Summarise the decision log into a readable trail
  const logSummary = (decisionLog ?? [])
    .map((e) => `[${e.type}] ${e.message}${e.outcome ? ` → ${e.outcome}` : ""}`)
    .join("\n") || "No log available.";

  const context = `
Booking task: ${stepLabel}
Original instruction: ${originalTask ?? "not available"}
What the agent did:
${logSummary}
Final error: ${stepError ?? "none"}`.trim();

  if (mode === "question") {
    // Agent speaks first — generate ONE specific question
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are a booking agent that just failed to complete a task.
Analyse exactly what happened and ask the user ONE specific question you need answered to proceed.

Rules:
- Be specific — not "what do you need?" but e.g. "I reached the room selection page. King or Double Queen?"
- One question only, no preamble
- Keep it under 40 words
- Start with what you tried/reached before asking`,
      messages: [{ role: "user", content: context }],
    });

    const question = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return NextResponse.json({ question });
  }

  // mode === "answer" — user replied, decide what to do
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are a booking agent. The user answered your question.
Based on their answer, decide whether to retry the booking or ask for something else.

Context:
${context}

Rules:
- If the answer gives you enough to retry, confirm in 1 sentence and end with [RETRY]
- Include an [ENRICHED_TASK: <new instruction>] tag with the updated task instruction incorporating the user's answer
- If you still need something, ask exactly one more question (no [RETRY])
- Keep replies under 30 words`,
    messages: [{ role: "user", content: `User's answer: ${answer}` }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  const retryNow = raw.includes("[RETRY]");
  const enrichedTaskMatch = raw.match(/\[ENRICHED_TASK:\s*([\s\S]*?)\]/);
  const enrichedTask = enrichedTaskMatch ? enrichedTaskMatch[1].trim() : undefined;
  const reply = raw
    .replace("[RETRY]", "")
    .replace(/\[ENRICHED_TASK:[\s\S]*?\]/, "")
    .trim();

  return NextResponse.json({ reply, retryNow, enrichedTask });
}
