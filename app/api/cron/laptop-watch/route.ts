import { NextRequest, NextResponse } from "next/server";
import { runLaptopWatch } from "@/lib/laptopWatch";

/**
 * GET /api/cron/laptop-watch
 *
 * Called by Vercel Cron daily (see vercel.json).
 * Can also be triggered manually — curl with the Authorization header.
 *
 * curl https://your-domain.com/api/cron/laptop-watch \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[laptop-watch] Starting run", new Date().toISOString());

  const result = await runLaptopWatch();

  console.log("[laptop-watch] Done", JSON.stringify(result));

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
