"use client";

/**
 * /metrics — Product KPI dashboard
 *
 * Shows the 5 agent product metrics:
 *   1. Plan approval rate
 *   2. Autonomous completion rate
 *   3. Manual intervention by step type
 *   4. Acceptance after adjustment
 *   5. Repeat usage by scenario
 */

import { useState, useEffect } from "react";

interface MetricsData {
  planApprovalRate: number | null;
  autonomousCompletionRate: number | null;
  acceptanceAfterAdjustment: number | null;
  repeatUsageRate: number | null;
  manualInterventionByStep: { stepType: string; interventionRate: number; count: number }[];
  adjustmentBreakdown: {
    timeAdjust: { count: number; acceptanceRate: number | null };
    venueSwitch: { count: number; acceptanceRate: number | null };
  };
  repeatByScenario: { scenario: string; totalSessions: number; repeatSessions: number; repeatRate: number }[];
  totalJobs: number;
  totalEvents: number;
  health: { planApproval: string; autonomousCompletion: string; adjustmentAcceptance: string };
}

function pct(v: number | null) {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

function healthColor(h: string) {
  return h === "good" ? "#4ade80" : h === "ok" ? "#facc15" : h === "poor" ? "#f87171" : "#6b7280";
}

function healthDot(h: string) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: healthColor(h), marginRight: 6 }} />;
}

function KpiCard({ title, value, sub, health }: { title: string; value: string; sub?: string; health?: string }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "20px 24px" }}>
      <p style={{ color: "#666", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 36, fontWeight: 800, color: "#f5f0e8", marginBottom: 4, fontFamily: "monospace" }}>{value}</p>
      {health && <p style={{ fontSize: 12, color: healthColor(health) }}>{healthDot(health)}{health === "no_data" ? "No data yet" : health}</p>}
      {sub && <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function Bar({ value, color = "#C9A84C" }: { value: number; color?: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "#1e1e1e", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMode, setSessionMode] = useState(false);

  useEffect(() => {
    const sessionId = typeof window !== "undefined" ? localStorage.getItem("session_id") : null;
    const url = sessionMode && sessionId
      ? `/api/metrics?session_id=${encodeURIComponent(sessionId)}`
      : "/api/metrics?aggregate=true";

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionMode]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f0e8", fontFamily: "'DM Sans', sans-serif" }}>
      <nav style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a1a" }}>
        <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: "#C9A84C", textDecoration: "none", letterSpacing: "-0.01em" }}>
          Onegent<span style={{ color: "#f5f0e8" }}>.</span>
        </a>
        <div style={{ display: "flex", gap: 8 }}>
          {["Aggregate", "My session"].map((label, i) => (
            <button
              key={label}
              onClick={() => setSessionMode(i === 1)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #222", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: sessionMode === (i === 1) ? "#C9A84C" : "#111",
                color:      sessionMode === (i === 1) ? "#000" : "#888",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: "#C9A84C", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Agent Product Metrics</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, marginBottom: 4 }}>KPI Dashboard</h1>
          {data && <p style={{ color: "#555", fontSize: 13 }}>{data.totalJobs} jobs · {data.totalEvents} feedback events</p>}
        </div>

        {loading && <p style={{ color: "#555" }}>Loading…</p>}

        {data && !loading && (
          <>
            {/* Top KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
              <KpiCard
                title="Plan approval rate"
                value={pct(data.planApprovalRate)}
                sub="Jobs started vs created"
                health={data.health.planApproval}
              />
              <KpiCard
                title="Autonomous completion"
                value={pct(data.autonomousCompletionRate)}
                sub="Done without overrides"
                health={data.health.autonomousCompletion}
              />
              <KpiCard
                title="Acceptance after adjustment"
                value={pct(data.acceptanceAfterAdjustment)}
                sub="User kept agent's change"
                health={data.health.adjustmentAcceptance}
              />
              <KpiCard
                title="Repeat usage"
                value={pct(data.repeatUsageRate)}
                sub="Sessions with >1 job"
              />
            </div>

            {/* Adjustment breakdown */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <p style={{ color: "#666", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Adjustment acceptance</p>
              {[
                { label: "Time adjust", d: data.adjustmentBreakdown.timeAdjust },
                { label: "Venue switch", d: data.adjustmentBreakdown.venueSwitch },
              ].map(({ label, d }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <p style={{ width: 100, fontSize: 13, color: "#888", flexShrink: 0 }}>{label}</p>
                  <Bar value={d.acceptanceRate ?? 0} color={d.acceptanceRate && d.acceptanceRate >= 0.6 ? "#4ade80" : "#facc15"} />
                  <p style={{ width: 60, textAlign: "right", fontSize: 13, color: "#aaa", flexShrink: 0 }}>
                    {pct(d.acceptanceRate)} <span style={{ color: "#444" }}>({d.count})</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Manual intervention by step type */}
            {data.manualInterventionByStep.length > 0 && (
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
                <p style={{ color: "#666", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  Manual intervention rate by step
                </p>
                {data.manualInterventionByStep.map(({ stepType, interventionRate, count }) => (
                  <div key={stepType} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <p style={{ width: 100, fontSize: 13, color: "#888", flexShrink: 0, textTransform: "capitalize" }}>{stepType}</p>
                    <Bar value={interventionRate} color={interventionRate >= 0.5 ? "#f87171" : interventionRate >= 0.25 ? "#facc15" : "#4ade80"} />
                    <p style={{ width: 60, textAlign: "right", fontSize: 13, color: "#aaa", flexShrink: 0 }}>
                      {pct(interventionRate)} <span style={{ color: "#444" }}>({count})</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Repeat usage by scenario */}
            {data.repeatByScenario.length > 0 && (
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "20px 24px" }}>
                <p style={{ color: "#666", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  Repeat usage by scenario
                </p>
                {data.repeatByScenario.map(({ scenario, totalSessions, repeatSessions, repeatRate }) => (
                  <div key={scenario} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <p style={{ width: 120, fontSize: 13, color: "#888", flexShrink: 0, textTransform: "capitalize" }}>
                      {scenario.replace("_", " ")}
                    </p>
                    <Bar value={repeatRate} color="#C9A84C" />
                    <p style={{ width: 80, textAlign: "right", fontSize: 13, color: "#aaa", flexShrink: 0 }}>
                      {repeatSessions}/{totalSessions} <span style={{ color: "#444" }}>return</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
