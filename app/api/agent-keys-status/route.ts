import { NextResponse } from "next/server";

/**
 * GET /api/agent-keys-status
 * Returns which providers have API keys configured server-side (env vars).
 * Never returns the actual key values.
 */
export async function GET() {
  return NextResponse.json({
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY
    ),
  });
}
