import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createDecisionSession } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initiatorConstraints, cityId, decisionType } = body as {
      initiatorConstraints: string;
      cityId?: string;
      decisionType?: string;
    };

    if (!initiatorConstraints?.trim()) {
      return NextResponse.json({ error: "initiatorConstraints is required" }, { status: 400 });
    }

    const { userId } = await auth();
    const sessionId = nanoid(8);
    const partnerToken = nanoid(24);

    const session = await createDecisionSession({
      id: sessionId,
      initiatorUserId: userId ?? null,
      partnerSessionToken: partnerToken,
      initiatorConstraints: initiatorConstraints.trim(),
      cityId: cityId ?? "los-angeles",
      decisionType: decisionType ?? "dinner_tonight",
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/decide/${sessionId}`;

    const response = NextResponse.json({ session, shareUrl });
    // Set partner token as HttpOnly cookie on the initiator too (they vote as initiator, not via cookie)
    return response;
  } catch (err) {
    console.error("[decision-session POST]", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
