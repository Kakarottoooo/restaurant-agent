/**
 * POST /api/booking-autopilot/universal
 *
 * Universal booking endpoint — works on any website.
 * Accepts a starting URL + natural-language task + user profile (or profileId),
 * runs Stagehand (AI browser), and returns the result.
 *
 * Profile security model:
 *   - Pass { profileId: number } to have the server fetch the profile from DB
 *     (card number decrypted server-side, never stored in booking_jobs steps)
 *   - Or pass inline { profile: BookingProfile } for backwards compat
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runBrowserTask } from "../../../../lib/booking-autopilot/stagehand-executor";
import { getBookingProfileById } from "../../../../lib/db";
import type { BrowserTaskInput, BookingProfile } from "../../../../lib/booking-autopilot/types";

export const maxDuration = 300; // 5 min — Vercel Pro allows up to 300s

export async function POST(req: NextRequest) {
  let body: Partial<BrowserTaskInput> & { profileId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.startUrl || !body.task) {
    return NextResponse.json(
      { error: "Missing required fields: startUrl, task" },
      { status: 400 }
    );
  }

  // Resolve profile: prefer DB lookup by profileId (secure), fall back to inline
  let profile: BookingProfile = body.profile ?? { first_name: "", last_name: "", email: "", phone: "" };

  if (body.profileId) {
    const { userId } = await auth();
    if (userId) {
      const dbProfile = await getBookingProfileById(body.profileId, userId, true);
      if (dbProfile) {
        profile = {
          first_name: dbProfile.first_name,
          last_name: dbProfile.last_name,
          email: dbProfile.email,
          phone: dbProfile.phone,
          address_line1: dbProfile.address_line1,
          city: dbProfile.city,
          state: dbProfile.state,
          zip: dbProfile.zip,
          country: dbProfile.country,
          card_name: dbProfile.card_name,
          card_number: dbProfile.card_number,
          card_expiry: dbProfile.card_expiry,
        };
      }
    }
  }

  const input: BrowserTaskInput = {
    startUrl: body.startUrl,
    task: body.task,
    profile,
    jobId: body.jobId ?? "manual",
    stepIndex: body.stepIndex ?? 0,
    agentModel: body.agentModel,
  };

  const result = await runBrowserTask(input);
  return NextResponse.json(result);
}
