import { NextRequest, NextResponse } from "next/server";
import { extractRefinements } from "@/lib/agent";
import { SessionPreferences } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, currentPreferences } = body as {
    message: string;
    currentPreferences: SessionPreferences;
  };

  if (!message || typeof message !== "string" || !currentPreferences) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await extractRefinements(message, currentPreferences);
  return NextResponse.json({ preferences: updated });
}
