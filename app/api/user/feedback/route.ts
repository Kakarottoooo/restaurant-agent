import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { FeedbackRecord } from "@/lib/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT restaurant_id, restaurant_name, query, satisfied, issues, created_at
      FROM feedback
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ feedback: result.rows });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

async function insertFeedback(userId: string, record: FeedbackRecord) {
  // Convert issues array to PostgreSQL array literal string
  const issuesStr = record.issues && record.issues.length > 0
    ? `{${record.issues.map((i) => `"${i.replace(/"/g, '\\"')}"`).join(",")}}`
    : "{}";

  await sql.query(
    `INSERT INTO feedback (user_id, restaurant_id, restaurant_name, query, satisfied, issues, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7)`,
    [userId, record.restaurant_id, record.restaurant_name, record.query ?? "", record.satisfied, issuesStr, record.created_at]
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Bulk import from localStorage migration
  if (body.bulk) {
    const records: FeedbackRecord[] = body.bulk;
    try {
      for (const record of records) {
        await insertFeedback(userId, record);
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  }

  // Single feedback record
  const record = body as FeedbackRecord;
  if (!record?.restaurant_id) {
    return NextResponse.json({ error: "Missing record" }, { status: 400 });
  }

  try {
    await insertFeedback(userId, record);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
