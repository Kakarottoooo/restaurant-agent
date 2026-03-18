import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { ChatRequestSchema } from "@/lib/schemas";

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// For multi-replica deployments, replace with @upstash/ratelimit + Redis.
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Error classification ──────────────────────────────────────────────────────

function classifyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("Google Places"))
      return "Location search failed. Please try again.";
    if (err.message.includes("MiniMax API"))
      return "AI service temporarily unavailable. Please try again.";
    if (err.message.includes("Rate limit"))
      return "Too many requests. Please wait a moment.";
  }
  return "Something went wrong. Please try again.";
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const body = ChatRequestSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { message, history, city, gpsCoords, nearLocation, sessionPreferences, profileContext } = body.data;

    const result = await runAgent(
      message,
      history,
      city ?? undefined,
      gpsCoords ?? null,
      nearLocation ?? undefined,
      sessionPreferences ?? undefined,
      profileContext ?? undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      { error: classifyError(error) },
      { status: 500 }
    );
  }
}
