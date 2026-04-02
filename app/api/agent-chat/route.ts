/**
 * POST /api/agent-chat
 *
 * Lightweight Claude conversation endpoint for inline task help.
 * Used when a booking step fails and the user wants to talk to the agent
 * without leaving the tasks page.
 *
 * Body: { message, stepLabel, failReason, jobId }
 * Response: { reply, retryNow }
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const { message, stepLabel, failReason } = body as {
    message: string;
    stepLabel: string;
    failReason: string;
  };

  const systemPrompt = `You are a concise booking assistant built into a travel app.

The user's AI agent tried to book "${stepLabel}" but failed.
Reason: ${failReason}

Your job:
- Understand what the user wants to do next
- Give a clear, short answer (2-4 sentences max)
- If the user wants to retry, confirm you'll try again — respond with [RETRY] at the very end
- If the user wants alternatives or different dates, acknowledge and suggest they use the main chat for a new search
- Never ask multiple questions at once
- Be warm but efficient`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const retryNow = raw.includes("[RETRY]");
  const reply = raw.replace("[RETRY]", "").trim();

  return NextResponse.json({ reply, retryNow });
}
