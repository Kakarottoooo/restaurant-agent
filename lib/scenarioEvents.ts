import { auth } from "@clerk/nextjs/server";
import { ensureScenarioEventsTable, sql } from "@/lib/db";
import { ScenarioTelemetryEventType, ScenarioType } from "@/lib/types";

const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const VALID_SCENARIOS = new Set<ScenarioType>([
  "date_night",
  "weekend_trip",
  "big_purchase",
]);

type InternalAnalyticsAccessMode =
  | "no_auth_configured"
  | "signed_in"
  | "allowlist";

export interface InternalAnalyticsAccess {
  allowed: boolean;
  status: 200 | 401 | 403;
  reason?: "sign_in_required" | "not_allowed";
  accessMode?: InternalAnalyticsAccessMode;
  userId?: string | null;
}

export interface ScenarioEventsQuery {
  days: number;
  limit: number;
  scenario?: ScenarioType;
}

export interface ScenarioEventsTotals {
  total_events: number;
  unique_sessions: number;
  unique_plans: number;
  plan_views: number;
  approvals: number;
  backup_promotions: number;
  action_clicks: number;
  negative_feedback: number;
  approval_rate_pct: number;
}

export interface ScenarioEventsByScenarioRow {
  scenario: ScenarioType;
  unique_sessions: number;
  unique_plans: number;
  plan_views: number;
  approvals: number;
  backup_promotions: number;
  action_clicks: number;
  negative_feedback: number;
  approval_rate_pct: number;
}

export interface ScenarioEventsByTypeRow {
  scenario: ScenarioType;
  event_type: ScenarioTelemetryEventType;
  count: number;
}

export interface ScenarioEventsTopActionRow {
  action_id: string;
  count: number;
}

export interface ScenarioEventsRecentRow {
  id: number;
  created_at: string;
  scenario: ScenarioType;
  event_type: ScenarioTelemetryEventType;
  session_id: string;
  plan_id: string;
  option_id: string | null;
  action_id: string | null;
  request_id: string | null;
  query_text: string | null;
  metadata_json: Record<string, unknown> | null;
  user_id: string | null;
}

export interface ScenarioEventsSnapshot {
  generated_at: string;
  filters: ScenarioEventsQuery;
  totals: ScenarioEventsTotals;
  by_scenario: ScenarioEventsByScenarioRow[];
  by_type: ScenarioEventsByTypeRow[];
  top_actions: ScenarioEventsTopActionRow[];
  recent_events: ScenarioEventsRecentRow[];
}

function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
      process.env.CLERK_SECRET_KEY?.startsWith("sk_")
  );
}

function parseAllowlist(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInt(
  value: string | string[] | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function normalizeScenario(
  value: string | string[] | undefined
): ScenarioType | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return VALID_SCENARIOS.has(raw as ScenarioType)
    ? (raw as ScenarioType)
    : undefined;
}

function getParam(
  input:
    | URLSearchParams
    | Record<string, string | string[] | undefined>,
  key: string
) {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  return input[key];
}

function buildWhereClause(filters: ScenarioEventsQuery) {
  const values: Array<string | number> = [filters.days];
  let whereClause = "created_at >= NOW() - ($1::int * INTERVAL '1 day')";

  if (filters.scenario) {
    values.push(filters.scenario);
    whereClause += ` AND scenario = $${values.length}`;
  }

  return { whereClause, values };
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function resolveScenarioEventsQuery(
  input:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | undefined
): ScenarioEventsQuery {
  const source = input ?? {};
  return {
    days: clampInt(getParam(source, "days"), DEFAULT_DAYS, 1, 90),
    limit: clampInt(getParam(source, "limit"), DEFAULT_LIMIT, 1, MAX_LIMIT),
    scenario: normalizeScenario(getParam(source, "scenario")),
  };
}

export async function requireInternalAnalyticsAccess(): Promise<InternalAnalyticsAccess> {
  if (!isClerkConfigured()) {
    // Allow in development only — never expose unauthenticated analytics in production
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        status: 403,
        reason: "not_allowed",
      };
    }
    return {
      allowed: true,
      status: 200,
      accessMode: "no_auth_configured",
      userId: null,
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      allowed: false,
      status: 401,
      reason: "sign_in_required",
    };
  }

  const allowlist = parseAllowlist(process.env.INTERNAL_ANALYTICS_USER_IDS);
  if (allowlist.length > 0 && !allowlist.includes(userId)) {
    return {
      allowed: false,
      status: 403,
      reason: "not_allowed",
      userId,
    };
  }

  return {
    allowed: true,
    status: 200,
    accessMode: allowlist.length > 0 ? "allowlist" : "signed_in",
    userId,
  };
}

export async function getScenarioEventsSnapshot(
  filters: ScenarioEventsQuery
): Promise<ScenarioEventsSnapshot> {
  await ensureScenarioEventsTable();

  const { whereClause, values } = buildWhereClause(filters);

  const totalsResult = await sql.query<ScenarioEventsTotals>(
    `
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(DISTINCT session_id)::int AS unique_sessions,
        COUNT(DISTINCT plan_id)::int AS unique_plans,
        COUNT(*) FILTER (WHERE event_type = 'plan_viewed')::int AS plan_views,
        COUNT(*) FILTER (WHERE event_type = 'plan_approved')::int AS approvals,
        COUNT(*) FILTER (WHERE event_type = 'backup_promoted')::int AS backup_promotions,
        COUNT(*) FILTER (WHERE event_type = 'action_clicked')::int AS action_clicks,
        COUNT(*) FILTER (WHERE event_type = 'feedback_negative')::int AS negative_feedback,
        COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (WHERE event_type = 'plan_approved')::numeric
              / NULLIF(COUNT(*) FILTER (WHERE event_type = 'plan_viewed'), 0)
            ) * 100,
            1
          ),
          0
        ) AS approval_rate_pct
      FROM scenario_events
      WHERE ${whereClause}
    `,
    values
  );

  const byScenarioResult = await sql.query<ScenarioEventsByScenarioRow>(
    `
      SELECT
        scenario,
        COUNT(DISTINCT session_id)::int AS unique_sessions,
        COUNT(DISTINCT plan_id)::int AS unique_plans,
        COUNT(*) FILTER (WHERE event_type = 'plan_viewed')::int AS plan_views,
        COUNT(*) FILTER (WHERE event_type = 'plan_approved')::int AS approvals,
        COUNT(*) FILTER (WHERE event_type = 'backup_promoted')::int AS backup_promotions,
        COUNT(*) FILTER (WHERE event_type = 'action_clicked')::int AS action_clicks,
        COUNT(*) FILTER (WHERE event_type = 'feedback_negative')::int AS negative_feedback,
        COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (WHERE event_type = 'plan_approved')::numeric
              / NULLIF(COUNT(*) FILTER (WHERE event_type = 'plan_viewed'), 0)
            ) * 100,
            1
          ),
          0
        ) AS approval_rate_pct
      FROM scenario_events
      WHERE ${whereClause}
      GROUP BY scenario
      ORDER BY plan_views DESC, scenario ASC
    `,
    values
  );

  const byTypeResult = await sql.query<ScenarioEventsByTypeRow>(
    `
      SELECT
        scenario,
        event_type,
        COUNT(*)::int AS count
      FROM scenario_events
      WHERE ${whereClause}
      GROUP BY scenario, event_type
      ORDER BY scenario ASC, event_type ASC
    `,
    values
  );

  const topActionsValues = [...values, filters.limit];
  const topActionsResult = await sql.query<ScenarioEventsTopActionRow>(
    `
      SELECT
        action_id,
        COUNT(*)::int AS count
      FROM scenario_events
      WHERE ${whereClause}
        AND event_type = 'action_clicked'
        AND action_id IS NOT NULL
      GROUP BY action_id
      ORDER BY count DESC, action_id ASC
      LIMIT $${topActionsValues.length}
    `,
    topActionsValues
  );

  const recentEventsValues = [...values, filters.limit];
  const recentEventsResult = await sql.query<ScenarioEventsRecentRow>(
    `
      SELECT
        id,
        created_at,
        scenario,
        event_type,
        session_id,
        plan_id,
        option_id,
        action_id,
        request_id,
        query_text,
        metadata_json,
        user_id
      FROM scenario_events
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${recentEventsValues.length}
    `,
    recentEventsValues
  );

  const totals = totalsResult.rows[0] ?? {
    total_events: 0,
    unique_sessions: 0,
    unique_plans: 0,
    plan_views: 0,
    approvals: 0,
    backup_promotions: 0,
    action_clicks: 0,
    negative_feedback: 0,
    approval_rate_pct: 0,
  };

  return {
    generated_at: new Date().toISOString(),
    filters,
    totals: {
      total_events: toNumber(totals.total_events),
      unique_sessions: toNumber(totals.unique_sessions),
      unique_plans: toNumber(totals.unique_plans),
      plan_views: toNumber(totals.plan_views),
      approvals: toNumber(totals.approvals),
      backup_promotions: toNumber(totals.backup_promotions),
      action_clicks: toNumber(totals.action_clicks),
      negative_feedback: toNumber(totals.negative_feedback),
      approval_rate_pct: toNumber(totals.approval_rate_pct),
    },
    by_scenario: byScenarioResult.rows.map((row) => ({
      scenario: row.scenario,
      unique_sessions: toNumber(row.unique_sessions),
      unique_plans: toNumber(row.unique_plans),
      plan_views: toNumber(row.plan_views),
      approvals: toNumber(row.approvals),
      backup_promotions: toNumber(row.backup_promotions),
      action_clicks: toNumber(row.action_clicks),
      negative_feedback: toNumber(row.negative_feedback),
      approval_rate_pct: toNumber(row.approval_rate_pct),
    })),
    by_type: byTypeResult.rows.map((row) => ({
      scenario: row.scenario,
      event_type: row.event_type,
      count: toNumber(row.count),
    })),
    top_actions: topActionsResult.rows.map((row) => ({
      action_id: row.action_id,
      count: toNumber(row.count),
    })),
    recent_events: recentEventsResult.rows.map((row) => ({
      ...row,
      metadata_json: row.metadata_json ?? null,
    })),
  };
}
