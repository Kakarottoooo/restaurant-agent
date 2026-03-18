import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const r = searchParams.get("r");

  if (!r) {
    return NextResponse.json({ error: "Missing r parameter" }, { status: 400 });
  }

  try {
    const decoded = Buffer.from(r, "base64").toString("utf-8");
    const data = JSON.parse(decoded);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
  }
}
