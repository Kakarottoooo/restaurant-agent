"use client";

/**
 * /insights — Learned Preferences & Memory
 *
 * Full-page version of the InsightsPanel from My Trips.
 * Four sections:
 *   Overview    — policy bias, negative memory, preference pills
 *   Scenarios   — per-context acceptance rates
 *   Patterns    — stated vs actual, satisfaction predictors, override triggers
 *   Profile     — group/relationship editor
 */

import { useState, useEffect } from "react";
import GlobalNav from "@/components/GlobalNav";
import type { PolicyBias, UserPreferenceProfile } from "@/lib/policy";
import type { ScenarioMemory, PatternMemory, RelationshipProfile, RelationshipType } from "@/lib/memory";
import type { AgentFeedbackStats } from "@/lib/db";

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("session_id", id); }
  return id;
}

type Tab = "overview" | "scenarios" | "patterns" | "profile";

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700,
      color: "var(--text-muted, #aaa)", textTransform: "uppercase",
      letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </p>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: "green" | "red" | "gold" }) {
  const bg = accent === "green" ? "rgba(22,163,74,0.04)"
           : accent === "red"   ? "rgba(220,38,38,0.04)"
           : accent === "gold"  ? "rgba(201,168,76,0.06)"
           : "var(--card-2, #f9f9f9)";
  const border = accent === "green" ? "rgba(22,163,74,0.15)"
               : accent === "red"   ? "rgba(220,38,38,0.15)"
               : accent === "gold"  ? "rgba(201,168,76,0.2)"
               : "var(--border, #e5e7eb)";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12,
      border: `0.5px solid ${border}`, background: bg }}>
      {children}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: "var(--border, #e5e7eb)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: color,
        borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

function Pill({ children, color, bg }: { children: string; color: string; bg: string }) {
  return (
    <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
      color, background: bg, borderRadius: 6, padding: "2px 8px" }}>
      {children}
    </span>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ stats, policy, profile }: {
  stats: AgentFeedbackStats | null;
  policy: PolicyBias | null;
  profile: UserPreferenceProfile | null;
}) {
  if (!stats && !policy) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🧠</p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 14,
          color: "var(--text-primary, #111)", marginBottom: 6 }}>
          Nothing learned yet
        </p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)", lineHeight: 1.6 }}>
          Complete a few trips and give feedback — Onegent will start building your personal preference profile.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Feedback events", value: stats.totalEvents },
            { label: "Accepted",        value: stats.accepted ?? 0 },
            { label: "Overridden",      value: stats.manual_override ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: "12px", borderRadius: 10, textAlign: "center",
              border: "0.5px solid var(--border, #e5e7eb)", background: "var(--card, #fff)",
            }}>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 22, fontWeight: 800,
                color: "var(--text-primary, #111)", marginBottom: 2 }}>
                {value}
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
                color: "var(--text-muted, #aaa)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Confidence */}
      {profile && (
        <Card accent={profile.confidenceLevel === "high" ? "green" : profile.confidenceLevel === "low" ? "red" : undefined}>
          <SectionLabel>Profile confidence</SectionLabel>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 700,
            color: "var(--text-primary, #111)", marginBottom: 4, textTransform: "capitalize" }}>
            {profile.confidenceLevel}
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
            color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
            {profile.confidenceLevel === "high"
              ? "The agent has a strong picture of your preferences and makes confident adjustments."
              : profile.confidenceLevel === "medium"
              ? "The agent is building your profile. A few more trips will sharpen its decisions."
              : "Not enough data yet. The agent defaults to conservative behaviour until it learns more."}
          </p>
        </Card>
      )}

      {/* Negative memory */}
      {profile && profile.negatives.length > 0 && (
        <div>
          <SectionLabel>Venues & providers the agent deprioritises</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {profile.negatives.map((n) => (
              <Pill key={n.entity}
                color={n.severity === "strong" ? "rgba(220,38,38,0.85)" : "rgba(234,88,12,0.8)"}
                bg={n.severity === "strong" ? "rgba(220,38,38,0.07)" : "rgba(234,88,12,0.07)"}>
                {n.entity} ({Math.round(n.overrideRate * 100)}% override)
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* Preferred providers */}
      {profile && profile.preferredProviders.length > 0 && (
        <div>
          <SectionLabel>Preferred providers</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {profile.preferredProviders.map((p) => (
              <Pill key={p} color="rgba(22,163,74,0.85)" bg="rgba(22,163,74,0.07)">{p}</Pill>
            ))}
          </div>
        </div>
      )}

      {/* Tolerance summary */}
      {profile && (
        <div>
          <SectionLabel>Tolerance</SectionLabel>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "Time adjust",  value: profile.timeAdjustTolerance,  color: "rgba(234,88,12,0.7)" },
              { label: "Venue switch", value: profile.venueSwitchTolerance, color: "#6366f1" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  color: "var(--text-muted, #aaa)", marginBottom: 4 }}>{label}</p>
                <Bar value={value} color={color} />
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  color: "var(--text-secondary, #666)", marginTop: 3 }}>
                  {Math.round(value * 100)}% acceptance
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to metrics */}
      <a href="/metrics" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10,
        border: "0.5px solid var(--border, #e5e7eb)",
        textDecoration: "none",
      }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600,
          color: "var(--text-primary, #111)" }}>
          📊 View full KPI dashboard
        </p>
        <span style={{ color: "var(--gold, #C9A84C)", fontSize: 13 }}>→</span>
      </a>
    </div>
  );
}

// ── Scenarios tab ──────────────────────────────────────────────────────────

function ScenariosTab({ taskMemory }: { taskMemory: ScenarioMemory[] }) {
  if (taskMemory.length === 0) {
    return (
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13,
        color: "var(--text-muted, #aaa)", fontStyle: "italic" }}>
        Complete trips across different scenarios to see how your preferences vary by context.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
        color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
        Your preferences aren&apos;t global — they shift by scenario. Here&apos;s what the agent has learned per context.
      </p>
      {taskMemory.map((mem) => (
        <Card key={`${mem.scenario}-${mem.stepType}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill color="#8b5cf6" bg="rgba(139,92,246,0.08)">{mem.scenarioLabel}</Pill>
              <Pill color="var(--text-secondary, #666)" bg="var(--border, #e5e7eb)">{mem.stepType}</Pill>
            </div>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
              color: "var(--text-muted, #aaa)" }}>
              {mem.totalEvents} events
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13,
            color: "var(--text-primary, #111)", marginBottom: 10, lineHeight: 1.5 }}>
            {mem.keyInsight}
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            {mem.timeAdjustAcceptance !== null && (
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
                  color: "var(--text-muted, #aaa)", marginBottom: 4 }}>Time adjust acceptance</p>
                <Bar value={mem.timeAdjustAcceptance} color="rgba(234,88,12,0.7)" />
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  color: "rgba(234,88,12,0.8)", marginTop: 3 }}>
                  {Math.round(mem.timeAdjustAcceptance * 100)}%
                </p>
              </div>
            )}
            {mem.venueSwitchAcceptance !== null && (
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
                  color: "var(--text-muted, #aaa)", marginBottom: 4 }}>Venue switch acceptance</p>
                <Bar value={mem.venueSwitchAcceptance} color="#6366f1" />
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  color: "#6366f1", marginTop: 3 }}>
                  {Math.round(mem.venueSwitchAcceptance * 100)}%
                </p>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Patterns tab ───────────────────────────────────────────────────────────

function PatternsTab({ patternMemory }: { patternMemory: PatternMemory | null }) {
  if (!patternMemory) {
    return (
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13,
        color: "var(--text-muted, #aaa)", fontStyle: "italic" }}>
        Complete more trips with feedback to build your behavioural fingerprint.
      </p>
    );
  }

  const { statedVsActual, satisfactionPredictors, overrideTriggers } = patternMemory;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Stated vs actual */}
      <div>
        <SectionLabel>Stated vs actual tolerance</SectionLabel>
        <Card accent={statedVsActual.conclusion === "more_strict" ? "red"
                   : statedVsActual.conclusion === "more_liberal" ? "green" : undefined}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13,
            color: "var(--text-primary, #111)", marginBottom: 8, lineHeight: 1.5 }}>
            {statedVsActual.insight}
          </p>
          {statedVsActual.actualAcceptanceRate !== null && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  color: "var(--text-muted, #aaa)" }}>Actual acceptance rate</span>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11,
                  fontWeight: 700, color: "var(--text-primary, #111)" }}>
                  {Math.round(statedVsActual.actualAcceptanceRate * 100)}%
                </span>
              </div>
              <Bar
                value={statedVsActual.actualAcceptanceRate}
                color={statedVsActual.conclusion === "more_strict"
                  ? "rgba(220,38,38,0.6)" : "rgba(22,163,74,0.7)"}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Satisfaction predictors */}
      {satisfactionPredictors.length > 0 && (
        <div>
          <SectionLabel>What drives your satisfaction</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {satisfactionPredictors.map((pred) => (
              <div key={pred.agentDecision} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10,
                border: "0.5px solid var(--border, #e5e7eb)",
                background: "var(--card-2, #f9f9f9)",
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
                    color: "var(--text-secondary, #666)", lineHeight: 1.4 }}>
                    {pred.insight}
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
                    color: "var(--text-muted, #aaa)", marginTop: 2 }}>
                    {pred.count} events
                  </p>
                </div>
                {pred.avgScore !== null && (
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{
                      fontFamily: "var(--font-dm-sans)", fontSize: 18, fontWeight: 800,
                      color: pred.avgScore >= 0.7 ? "rgba(22,163,74,0.85)"
                           : pred.avgScore >= 0.4 ? "var(--gold, #C9A84C)"
                           : "rgba(220,38,38,0.8)",
                    }}>
                      {Math.round(pred.avgScore * 100)}%
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Override triggers */}
      {overrideTriggers.length > 0 && (
        <div>
          <SectionLabel>When you take control</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {overrideTriggers.map((t, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0",
                borderBottom: i < overrideTriggers.length - 1
                  ? "0.5px solid var(--border, #e5e7eb)" : "none",
              }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
                  color: "var(--text-secondary, #666)", flex: 1, paddingRight: 12 }}>
                  {t.description}
                </p>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 700,
                  color: "rgba(220,38,38,0.8)", flexShrink: 0 }}>
                  {Math.round(t.overrideRate * 100)}% override
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile tab ────────────────────────────────────────────────────────────

function ProfileTab({ sessionId, relationship, onSave }: {
  sessionId: string;
  relationship: RelationshipProfile | null;
  onSave: (r: RelationshipProfile) => void;
}) {
  const [form, setForm] = useState({
    name: relationship?.name ?? "",
    type: (relationship?.type ?? "solo") as RelationshipType,
    constraints: relationship?.constraints.join(", ") ?? "",
    avoid_types: relationship?.avoid_types.join(", ") ?? "",
    notes: relationship?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const TYPES: RelationshipType[] = ["solo", "couple", "friends", "family"];

  async function save() {
    setSaving(true);
    const id = relationship?.id ?? crypto.randomUUID();
    const payload: RelationshipProfile = {
      id,
      name: form.name,
      type: form.type,
      session_ids: [sessionId],
      constraints: form.constraints.split(",").map((s) => s.trim()).filter(Boolean),
      avoid_types: form.avoid_types.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes,
      created_at: relationship?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const url    = relationship ? `/api/relationships/${id}` : "/api/relationships";
    const method = relationship ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    onSave(payload);
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box",
    border: "0.5px solid var(--border, #e5e7eb)", background: "var(--card, #fff)",
    fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13,
        color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
        Tell Onegent who you&apos;re booking for. It uses this to filter venues, respect constraints, and remember what worked.
      </p>

      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Profile name
        </p>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Alex & Jordan, Family trip, College crew"
          style={inputStyle}
        />
      </div>

      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Group type
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {TYPES.map((t) => (
            <button key={t} onClick={() => setForm((f) => ({ ...f, type: t }))} style={{
              flex: 1, padding: "7px 4px", borderRadius: 8, cursor: "pointer", textTransform: "capitalize",
              fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: form.type === t ? 700 : 400,
              border: form.type === t ? "1.5px solid var(--gold, #C9A84C)" : "0.5px solid var(--border, #e5e7eb)",
              background: form.type === t ? "rgba(201,168,76,0.08)" : "var(--card, #fff)",
              color: form.type === t ? "var(--gold, #C9A84C)" : "var(--text-secondary, #666)",
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Always needs (comma-separated)
        </p>
        <input
          value={form.constraints}
          onChange={(e) => setForm((f) => ({ ...f, constraints: e.target.value }))}
          placeholder="e.g. parking, quiet venue, vegetarian option"
          style={inputStyle}
        />
      </div>

      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Always avoids (comma-separated)
        </p>
        <input
          value={form.avoid_types}
          onChange={(e) => setForm((f) => ({ ...f, avoid_types: e.target.value }))}
          placeholder="e.g. chains, loud music, late nights"
          style={inputStyle}
        />
      </div>

      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Notes
        </p>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Anything else the agent should know…"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !form.name}
        style={{
          padding: "11px", borderRadius: 10, border: "none", cursor: saving ? "wait" : "pointer",
          backgroundColor: "var(--gold, #C9A84C)", color: "#fff",
          fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 700,
          opacity: !form.name ? 0.5 : 1,
        }}
      >
        {saving ? "Saving…" : relationship ? "Update profile" : "Save profile"}
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats]               = useState<AgentFeedbackStats | null>(null);
  const [policy, setPolicy]             = useState<PolicyBias | null>(null);
  const [profile, setProfile]           = useState<UserPreferenceProfile | null>(null);
  const [taskMemory, setTaskMemory]     = useState<ScenarioMemory[]>([]);
  const [patternMemory, setPatternMemory] = useState<PatternMemory | null>(null);
  const [relationship, setRelationship] = useState<RelationshipProfile | null>(null);
  const [sessionId] = useState(getSessionId);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/booking-feedback?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
      fetch(`/api/memory?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
    ])
      .then(([feedbackData, memoryData]) => {
        setStats(feedbackData.stats ?? null);
        setPolicy(memoryData.bias ?? null);
        setProfile(memoryData.profile ?? null);
        setTaskMemory(memoryData.taskMemory ?? []);
        setPatternMemory(memoryData.patternMemory ?? null);
        setRelationship(memoryData.relationship ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview"  },
    { id: "scenarios", label: "Scenarios" },
    { id: "patterns",  label: "Patterns"  },
    { id: "profile",   label: "Profile"   },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)" }}>
      <GlobalNav active="insights" />

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 700,
            color: "var(--text-primary, #111)", marginBottom: 4 }}>
            Insights
          </h1>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)" }}>
            {loading ? "Loading…" : stats
              ? `${stats.totalEvents} feedback events · Onegent is learning your preferences`
              : "Complete trips and give feedback to build your profile"}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--border, #e5e7eb)", marginBottom: 24, gap: 0 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "10px 4px", background: "none", border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--gold, #C9A84C)" : "2px solid transparent",
              fontFamily: "var(--font-dm-sans)", fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? "var(--gold, #C9A84C)" : "var(--text-muted, #aaa)",
              cursor: "pointer", transition: "color 0.15s",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-muted, #aaa)" }}>
            Loading…
          </p>
        ) : (
          <>
            {activeTab === "overview"  && <OverviewTab stats={stats} policy={policy} profile={profile} />}
            {activeTab === "scenarios" && <ScenariosTab taskMemory={taskMemory} />}
            {activeTab === "patterns"  && <PatternsTab patternMemory={patternMemory} />}
            {activeTab === "profile"   && (
              <ProfileTab
                sessionId={sessionId}
                relationship={relationship}
                onSave={setRelationship}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
