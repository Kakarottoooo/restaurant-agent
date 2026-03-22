import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getScenarioEventsSnapshot,
  requireInternalAnalyticsAccess,
  resolveScenarioEventsQuery,
} from "@/lib/scenarioEvents";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatScenarioLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEventLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function buildHref(
  days: number,
  scenario?: string,
  limit?: number
) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (scenario) params.set("scenario", scenario);
  if (limit) params.set("limit", String(limit));
  return `/internal/scenario-events?${params.toString()}`;
}

function buildApiHref(days: number, scenario?: string, limit?: number) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (scenario) params.set("scenario", scenario);
  if (limit) params.set("limit", String(limit));
  return `/api/internal/scenario-events?${params.toString()}`;
}

export default async function ScenarioEventsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const access = await requireInternalAnalyticsAccess();

  if (!access.allowed) {
    if (access.status === 401) {
      return (
        <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text-primary)]">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(44,36,22,0.08)]">
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Internal Analytics
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[var(--text-primary)]">
              Sign in required
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              This internal view is only available to signed-in users.
            </p>
          </div>
        </main>
      );
    }

    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = resolveScenarioEventsQuery(resolvedSearchParams);
  const snapshot = await getScenarioEventsSnapshot(filters);
  const activeScenario = snapshot.filters.scenario;
  const byTypeLookup = new Map<string, number>();

  for (const row of snapshot.by_type) {
    byTypeLookup.set(`${row.scenario}:${row.event_type}`, row.count);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(249,246,239,0.92))] p-6 shadow-[0_24px_80px_rgba(44,36,22,0.08)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                Internal Analytics
              </p>
              <h1 className="mt-3 font-serif text-4xl text-[var(--text-primary)]">
                Scenario events
              </h1>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
                Tiny read-only view over <code>scenario_events</code> so we can
                watch plan adoption, backup switches, and action clicks without
                leaving the app.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
                Access: {access.accessMode?.replaceAll("_", " ") ?? "restricted"}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
                Window: last {snapshot.filters.days} days
              </span>
              <Link
                className="rounded-full border border-[var(--gold)] bg-[var(--card)] px-3 py-1.5 font-medium text-[var(--text-primary)] transition hover:bg-[var(--card-2)]"
                href={buildApiHref(snapshot.filters.days, activeScenario, snapshot.filters.limit)}
              >
                Open JSON
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {[7, 14, 30].map((days) => (
              <Link
                key={days}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  snapshot.filters.days === days && !activeScenario
                    ? "bg-[var(--gold)] text-[#2C2416]"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-2)]"
                }`}
                href={buildHref(days)}
              >
                Last {days}d
              </Link>
            ))}
            <Link
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activeScenario === "date_night"
                  ? "bg-[var(--gold)] text-[#2C2416]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-2)]"
              }`}
              href={buildHref(snapshot.filters.days, "date_night")}
            >
              Date Night
            </Link>
            <Link
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activeScenario === "weekend_trip"
                  ? "bg-[var(--gold)] text-[#2C2416]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-2)]"
              }`}
              href={buildHref(snapshot.filters.days, "weekend_trip")}
            >
              Weekend Trip
            </Link>
            <Link
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activeScenario === "city_trip"
                  ? "bg-[var(--gold)] text-[#2C2416]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-2)]"
              }`}
              href={buildHref(snapshot.filters.days, "city_trip")}
            >
              City Trip
            </Link>
            <Link
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activeScenario === "big_purchase"
                  ? "bg-[var(--gold)] text-[#2C2416]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-2)]"
              }`}
              href={buildHref(snapshot.filters.days, "big_purchase")}
            >
              Big Purchase
            </Link>
            <Link
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--card-2)]"
              href={buildHref(snapshot.filters.days)}
            >
              Clear filter
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Plan views",
              value: snapshot.totals.plan_views,
              helper: `${snapshot.totals.unique_plans} unique plans`,
            },
            {
              label: "Approvals",
              value: snapshot.totals.approvals,
              helper: formatPercent(snapshot.totals.approval_rate_pct),
            },
            {
              label: "Backup promotions",
              value: snapshot.totals.backup_promotions,
              helper: `${snapshot.totals.unique_sessions} sessions`,
            },
            {
              label: "Action clicks",
              value: snapshot.totals.action_clicks,
              helper: `${snapshot.totals.total_events} total events`,
            },
            {
              label: "Negative feedback",
              value: snapshot.totals.negative_feedback,
              helper: "request changes / not quite right",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_18px_48px_rgba(44,36,22,0.06)]"
            >
              <p className="text-sm text-[var(--text-secondary)]">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{metric.helper}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_48px_rgba(44,36,22,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-[var(--text-primary)]">
                  By scenario
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Approval and switch signals grouped by scenario.
                </p>
              </div>
            </div>

            {snapshot.by_scenario.length === 0 ? (
              <p className="mt-6 rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--card-2)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                No scenario events matched the current filter yet.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--text-muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-3 pr-4 font-medium">Scenario</th>
                      <th className="pb-3 pr-4 font-medium">Views</th>
                      <th className="pb-3 pr-4 font-medium">Approvals</th>
                      <th className="pb-3 pr-4 font-medium">Approval rate</th>
                      <th className="pb-3 pr-4 font-medium">Backup swaps</th>
                      <th className="pb-3 pr-4 font-medium">Actions</th>
                      <th className="pb-3 font-medium">Negative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.by_scenario.map((row) => (
                      <tr
                        key={row.scenario}
                        className="border-b border-[rgba(201,168,76,0.12)] align-top last:border-b-0"
                      >
                        <td className="py-4 pr-4">
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              {formatScenarioLabel(row.scenario)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {row.unique_sessions} sessions · {row.unique_plans} plans
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-[var(--text-primary)]">
                          {row.plan_views}
                        </td>
                        <td className="py-4 pr-4 text-[var(--text-primary)]">
                          {row.approvals}
                        </td>
                        <td className="py-4 pr-4 text-[var(--text-primary)]">
                          {formatPercent(row.approval_rate_pct)}
                        </td>
                        <td className="py-4 pr-4 text-[var(--text-primary)]">
                          {row.backup_promotions}
                        </td>
                        <td className="py-4 pr-4 text-[var(--text-primary)]">
                          {row.action_clicks}
                        </td>
                        <td className="py-4 text-[var(--text-primary)]">
                          {row.negative_feedback}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_48px_rgba(44,36,22,0.06)]">
              <h2 className="font-serif text-2xl text-[var(--text-primary)]">
                Top actions
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Which action rail items are actually getting clicked.
              </p>

              {snapshot.top_actions.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                  No action clicks in this window.
                </p>
              ) : (
                <div className="mt-6 flex flex-wrap gap-2">
                  {snapshot.top_actions.map((row) => (
                    <span
                      key={row.action_id}
                      className="rounded-full border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      {row.action_id} · {row.count}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_48px_rgba(44,36,22,0.06)]">
              <h2 className="font-serif text-2xl text-[var(--text-primary)]">
                Event mix
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Quick glance at the shape of each scenario funnel.
              </p>

              <div className="mt-5 space-y-4">
                {snapshot.by_scenario.map((scenarioRow) => (
                  <div
                    key={scenarioRow.scenario}
                    className="rounded-[20px] border border-[rgba(201,168,76,0.14)] bg-[var(--card-2)] p-4"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {formatScenarioLabel(scenarioRow.scenario)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        "plan_viewed",
                        "plan_approved",
                        "backup_promoted",
                        "action_clicked",
                        "feedback_negative",
                      ].map((eventType) => (
                        <span
                          key={eventType}
                          className="rounded-full bg-[var(--card)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                        >
                          {formatEventLabel(eventType)} ·{" "}
                          {byTypeLookup.get(`${scenarioRow.scenario}:${eventType}`) ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_48px_rgba(44,36,22,0.06)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl text-[var(--text-primary)]">
                Recent events
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Latest raw rows for quick debugging and sanity checks.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Generated {new Date(snapshot.generated_at).toLocaleString("en-US")}
            </p>
          </div>

          {snapshot.recent_events.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              No rows yet for the current filter.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[var(--text-muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">Scenario</th>
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 pr-4 font-medium">Action / Option</th>
                    <th className="pb-3 pr-4 font-medium">Query</th>
                    <th className="pb-3 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recent_events.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[rgba(201,168,76,0.12)] align-top last:border-b-0"
                    >
                      <td className="py-4 pr-4 text-[var(--text-secondary)]">
                        {new Date(row.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 pr-4 font-medium text-[var(--text-primary)]">
                        {formatScenarioLabel(row.scenario)}
                      </td>
                      <td className="py-4 pr-4 text-[var(--text-primary)]">
                        {formatEventLabel(row.event_type)}
                      </td>
                      <td className="py-4 pr-4 text-[var(--text-secondary)]">
                        {row.action_id ?? row.option_id ?? "—"}
                      </td>
                      <td className="py-4 pr-4 text-[var(--text-secondary)]">
                        {truncate(row.query_text, 70)}
                      </td>
                      <td className="py-4 text-[var(--text-secondary)]">
                        {truncate(
                          row.metadata_json
                            ? JSON.stringify(row.metadata_json)
                            : null,
                          90
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
