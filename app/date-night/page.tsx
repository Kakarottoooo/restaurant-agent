"use client";

/**
 * Date Night — flagship agent experience
 *
 * Wow-moment funnel:
 *   Input → Plan + approval → Live execution → "Your night is ready"
 *
 * UX principles:
 *   • Progressive disclosure — advanced options hidden behind "More options"
 *   • Trust before, during, after — agent explains what it can change
 *   • First success first — get the user to "Your night is ready" fast
 */

import { useState, useEffect, useRef } from "react";
import { loadAutonomySettings } from "@/lib/autonomy";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = "input" | "planning" | "plan" | "executing" | "done";

interface PlanStep {
  index: number;
  emoji: string;
  label: string;
  type: string;
  time?: string;
  venue?: string;
  fallbackCount: number;
  timeFallbackCount: number;
}

interface PlanResponse {
  jobId: string;
  tripLabel: string;
  primaryRestaurant: { name: string; rating: number; reviewCount: number; address: string; cuisine: string };
  fallbackRestaurants: { name: string; rating: number }[];
  planSteps: PlanStep[];
  trustSignals: string[];
  date: string;
  time: string;
  partySize: number;
  location: string;
}

interface LiveStep {
  label: string;
  emoji: string;
  status: "pending" | "loading" | "done" | "error" | "no_availability";
  result?: string;
  handoffUrl?: string;
  adjustment?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VIBES = [
  { value: "romantic",  label: "Romantic",  desc: "Candlelit, intimate, classic" },
  { value: "intimate",  label: "Intimate",  desc: "Cozy, quiet, personal" },
  { value: "upscale",   label: "Upscale",   desc: "Fine dining, impressive" },
  { value: "casual",    label: "Casual",    desc: "Relaxed, neighbourhood gem" },
];

const FOLLOW_UPS = [
  { value: "open",     label: "Surprise me" },
  { value: "cocktail", label: "Drinks after" },
  { value: "dessert",  label: "Dessert spot" },
  { value: "walk",     label: "Evening walk" },
  { value: "none",     label: "Just dinner" },
];

const BUDGETS = [
  { value: "mid-range", label: "$$$",  desc: "~$60–100/person" },
  { value: "luxury",    label: "$$$$", desc: "$100+/person" },
];

// ── Helper ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "pm" : "am";
  const h12 = (h ?? 0) % 12 || 12;
  return `${h12}:${m?.toString().padStart(2, "0")}${ampm}`;
}

function starRating(r: number) {
  return "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DateNightPage() {
  const [phase, setPhase] = useState<Phase>("input");

  // Form state
  const [location, setLocation]       = useState("New York");
  const [date, setDate]               = useState(todayISO());
  const [time, setTime]               = useState("19:30");
  const [partySize, setPartySize]     = useState(2);
  const [vibe, setVibe]               = useState("romantic");
  const [budget, setBudget]           = useState("mid-range");
  const [followUp, setFollowUp]       = useState("open");
  const [restaurant, setRestaurant]   = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Plan state
  const [plan, setPlan]   = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execution state
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session ID
  const [sessionId] = useState(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("session_id") ?? crypto.randomUUID())
      : crypto.randomUUID()
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("session_id", sessionId);
    }
  }, [sessionId]);

  // ── Phase: Input → Plan ─────────────────────────────────────────────────

  async function generatePlan() {
    setError(null);
    setPhase("planning");

    const autonomySettings = loadAutonomySettings();

    try {
      const res = await fetch("/api/date-night/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          location,
          date,
          time,
          partySize,
          vibe,
          budget,
          followUp,
          targetRestaurant: restaurant || undefined,
          autonomySettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as PlanResponse;
      setPlan(data);
      setPhase("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("input");
    }
  }

  // ── Phase: Approve → Execute ────────────────────────────────────────────

  async function approvePlan() {
    if (!plan) return;
    setPhase("executing");

    // Initialise live steps from the plan
    setLiveSteps(plan.planSteps.map((s) => ({
      label: s.label,
      emoji: s.emoji,
      status: "pending",
    })));

    // Start the job (fire-and-forget on server)
    fetch(`/api/booking-jobs/${plan.jobId}/start`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});

    // Poll for status
    startPolling(plan.jobId);
  }

  function startPolling(jobId: string) {
    async function poll() {
      try {
        const res  = await fetch(`/api/booking-jobs/${jobId}`);
        const data = await res.json() as { job?: { status: string; steps: { status: string; handoff_url?: string; error?: string; decisionLog?: { message: string; type: string }[] }[] } };
        const job  = data.job;

        if (!job) return;

        setLiveSteps(job.steps.map((s, i) => ({
          label: plan?.planSteps[i]?.label ?? `Step ${i + 1}`,
          emoji: plan?.planSteps[i]?.emoji ?? "📌",
          status: s.status as LiveStep["status"],
          handoffUrl: s.handoff_url,
          adjustment: s.decisionLog?.find((l) => l.type === "time_adjusted" || l.type === "venue_switched")?.message,
        })));

        if (job.status === "done" || job.status === "failed") {
          setPhase("done");
          return;
        }
      } catch {
        // silently continue polling
      }

      pollRef.current = setTimeout(poll, 2500);
    }

    poll();
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f0e8", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#666",
              fontSize: 13,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #222",
              background: "#111",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#C9A84C";
              (e.currentTarget as HTMLElement).style.color = "#C9A84C";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#222";
              (e.currentTarget as HTMLElement).style.color = "#666";
            }}
          >
            ← Home
          </a>
          <a href="/" style={{ color: "#C9A84C", fontWeight: 700, fontSize: 18, textDecoration: "none", letterSpacing: "0.02em" }}>
            Onegent
          </a>
        </div>
        <a href="/trips" style={{ color: "#888", fontSize: 14, textDecoration: "none" }}>
          My bookings →
        </a>
      </nav>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ── Phase: Input ──────────────────────────────────────────────── */}
        {phase === "input" && (
          <div>
            <div style={{ marginBottom: 40 }}>
              <p style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                Date Night Agent
              </p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, lineHeight: 1.15, marginBottom: 16, color: "#f5f0e8" }}>
                Tell us your vibe.
                <br />
                <span style={{ color: "#C9A84C" }}>We'll handle the rest.</span>
              </h1>
              <p style={{ color: "#999", fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>
                Describe your night — Onegent plans the venue, handles the booking, adjusts when things change, and keeps watching after you close the app.
              </p>
            </div>

            {error && (
              <div style={{ background: "#2a1212", border: "1px solid #5a2020", borderRadius: 10, padding: "12px 16px", marginBottom: 24, color: "#ff8a8a", fontSize: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Location + Date + Time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FormField label="City">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="New York"
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Date">
                  <input
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Time">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              {/* Vibe */}
              <FormField label="Vibe">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {VIBES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => setVibe(v.value)}
                      style={{
                        ...chipStyle,
                        background: vibe === v.value ? "#C9A84C" : "#111",
                        color: vibe === v.value ? "#000" : "#ccc",
                        borderColor: vibe === v.value ? "#C9A84C" : "#2a2a2a",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 2,
                        padding: "10px 12px",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{v.label}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{v.desc}</span>
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Budget + Party size */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Budget">
                  <div style={{ display: "flex", gap: 8 }}>
                    {BUDGETS.map((b) => (
                      <button
                        key={b.value}
                        onClick={() => setBudget(b.value)}
                        style={{
                          ...chipStyle,
                          flex: 1,
                          background: budget === b.value ? "#C9A84C" : "#111",
                          color: budget === b.value ? "#000" : "#ccc",
                          borderColor: budget === b.value ? "#C9A84C" : "#2a2a2a",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{b.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{b.desc}</span>
                      </button>
                    ))}
                  </div>
                </FormField>
                <FormField label="Party size">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setPartySize(Math.max(1, partySize - 1))} style={counterBtn}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{partySize}</span>
                    <button onClick={() => setPartySize(Math.min(12, partySize + 1))} style={counterBtn}>+</button>
                  </div>
                </FormField>
              </div>

              {/* After-dinner */}
              <FormField label="After dinner">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {FOLLOW_UPS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFollowUp(f.value)}
                      style={{
                        ...chipStyle,
                        background: followUp === f.value ? "#C9A84C" : "#111",
                        color: followUp === f.value ? "#000" : "#ccc",
                        borderColor: followUp === f.value ? "#C9A84C" : "#2a2a2a",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{showAdvanced ? "▾" : "▸"}</span> {showAdvanced ? "Hide" : "More options"}
              </button>

              {showAdvanced && (
                <FormField label="Restaurant in mind (optional)">
                  <input
                    value={restaurant}
                    onChange={(e) => setRestaurant(e.target.value)}
                    placeholder="Leave blank and we'll find the best option"
                    style={inputStyle}
                  />
                </FormField>
              )}

              <button
                onClick={generatePlan}
                style={{
                  marginTop: 8,
                  background: "#C9A84C",
                  color: "#000",
                  border: "none",
                  borderRadius: 12,
                  padding: "16px 32px",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                  letterSpacing: "0.02em",
                }}
              >
                Plan my night →
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Planning ───────────────────────────────────────────── */}
        {phase === "planning" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>🌙</div>
            <p style={{ fontSize: 20, color: "#C9A84C", fontWeight: 600, marginBottom: 8 }}>Planning your night…</p>
            <p style={{ color: "#666", fontSize: 14 }}>Finding the best restaurants in {location}</p>
            <PulseBar />
          </div>
        )}

        {/* ── Phase: Plan approval ─────────────────────────────────────── */}
        {phase === "plan" && plan && (
          <div>
            <p style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
              Here's your night
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
              {plan.primaryRestaurant.name}
            </h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
              {formatDate(plan.date)} · {fmtTime(plan.time)} · {plan.partySize} guests
              {plan.primaryRestaurant.cuisine ? ` · ${plan.primaryRestaurant.cuisine}` : ""}
            </p>

            {/* Restaurant card */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{plan.primaryRestaurant.name}</p>
                  <p style={{ color: "#C9A84C", fontSize: 13, marginBottom: 2 }}>
                    {starRating(plan.primaryRestaurant.rating)} {plan.primaryRestaurant.rating.toFixed(1)} ({plan.primaryRestaurant.reviewCount?.toLocaleString()} reviews)
                  </p>
                  <p style={{ color: "#666", fontSize: 13 }}>{plan.primaryRestaurant.address}</p>
                </div>
                {plan.fallbackRestaurants.length > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#555", fontSize: 11, marginBottom: 6 }}>Backups ready</p>
                    {plan.fallbackRestaurants.slice(0, 2).map((r) => (
                      <p key={r.name} style={{ color: "#666", fontSize: 12 }}>↪ {r.name} ({r.rating.toFixed(1)}★)</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Plan steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {plan.planSteps.map((step) => (
                <div key={step.index} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#0f0f0f", borderRadius: 10, border: "1px solid #1a1a1a" }}>
                  <span style={{ fontSize: 22 }}>{step.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{step.label}</p>
                    {step.time && <p style={{ color: "#888", fontSize: 12 }}>{fmtTime(step.time)}</p>}
                  </div>
                  {step.fallbackCount > 0 && (
                    <span style={{ color: "#555", fontSize: 11 }}>{step.fallbackCount} backup{step.fallbackCount > 1 ? "s" : ""}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Trust signals */}
            {plan.trustSignals.length > 0 && (
              <div style={{ background: "#0c1a0c", border: "1px solid #1a3a1a", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
                <p style={{ color: "#4a9a4a", fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  What the agent can do automatically
                </p>
                {plan.trustSignals.map((s, i) => (
                  <p key={i} style={{ color: "#6ab86a", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: i < plan.trustSignals.length - 1 ? 4 : 0 }}>
                    <span>✓</span> {s}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={approvePlan}
                style={{
                  flex: 1,
                  background: "#C9A84C",
                  color: "#000",
                  border: "none",
                  borderRadius: 12,
                  padding: "16px 24px",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Make this my night →
              </button>
              <button
                onClick={() => setPhase("input")}
                style={{
                  background: "#111",
                  color: "#888",
                  border: "1px solid #222",
                  borderRadius: 12,
                  padding: "16px 20px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Adjust
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Executing ─────────────────────────────────────────── */}
        {phase === "executing" && (
          <div>
            <p style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
              Agent working…
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, marginBottom: 32 }}>
              Booking your night
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {liveSteps.map((step, i) => (
                <ExecutionStep key={i} step={step} />
              ))}
            </div>
            <p style={{ color: "#555", fontSize: 13, marginTop: 24, textAlign: "center" }}>
              You can close this tab — the agent will keep working and notify you when done.
            </p>
          </div>
        )}

        {/* ── Phase: Done ──────────────────────────────────────────────── */}
        {phase === "done" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🌙</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: "#C9A84C", marginBottom: 8 }}>
                Your night is ready.
              </h2>
              <p style={{ color: "#888", fontSize: 15 }}>
                Everything is booked — the agent is watching for changes.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {liveSteps.map((step, i) => (
                <DoneStep key={i} step={step} />
              ))}
            </div>

            {/* Monitoring signal */}
            <div style={{ background: "#0c1219", border: "1px solid #1a2a3a", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
              <p style={{ color: "#4a8abf", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                🔭  Active monitoring on
              </p>
              <p style={{ color: "#6a9abf", fontSize: 13 }}>
                Onegent will watch your reservations and alert you if anything changes — cancellations, time shifts, or better availability.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <a
                href="/trips"
                style={{
                  flex: 1,
                  background: "#C9A84C",
                  color: "#000",
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                View in My Bookings
              </a>
              <button
                onClick={() => { setPlan(null); setLiveSteps([]); setPhase("input"); }}
                style={{
                  background: "#111",
                  color: "#888",
                  border: "1px solid #222",
                  borderRadius: 12,
                  padding: "14px 20px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Plan another night
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "#666", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function ExecutionStep({ step }: { step: LiveStep }) {
  const isDone    = step.status === "done";
  const isLoading = step.status === "loading";
  const isFailed  = step.status === "error" || step.status === "no_availability";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 16px",
      background: isDone ? "#0d1a0d" : isLoading ? "#0f0f14" : "#0f0f0f",
      borderRadius: 12,
      border: `1px solid ${isDone ? "#1a3a1a" : isLoading ? "#2a2a4a" : "#1a1a1a"}`,
      transition: "all 0.3s ease",
    }}>
      <span style={{ fontSize: 22 }}>{step.emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: isDone ? "#6ab86a" : isLoading ? "#aaa" : "#666", marginBottom: step.adjustment ? 2 : 0 }}>
          {step.label}
        </p>
        {step.adjustment && (
          <p style={{ color: "#C9A84C", fontSize: 12 }}>↻ {step.adjustment}</p>
        )}
      </div>
      <span style={{ fontSize: 18 }}>
        {isDone ? "✓" : isLoading ? <Spinner /> : isFailed ? "✗" : "·"}
      </span>
    </div>
  );
}

function DoneStep({ step }: { step: LiveStep }) {
  const isDone   = step.status === "done";
  const isFailed = step.status === "error" || step.status === "no_availability";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 16px",
      background: isDone ? "#0d1a0d" : "#1a0e0e",
      borderRadius: 12,
      border: `1px solid ${isDone ? "#1a3a1a" : "#3a1a1a"}`,
    }}>
      <span style={{ fontSize: 22 }}>{step.emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: isDone ? "#6ab86a" : "#bf6a6a", marginBottom: step.adjustment ? 2 : 0 }}>
          {step.label}
        </p>
        {step.adjustment && (
          <p style={{ color: "#C9A84C", fontSize: 12 }}>↻ {step.adjustment}</p>
        )}
        {isFailed && (
          <p style={{ color: "#bf6a6a", fontSize: 12 }}>Book manually ↗</p>
        )}
      </div>
      {isDone && step.handoffUrl && (
        <a
          href={step.handoffUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            background: "#C9A84C",
            color: "#000",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Confirm →
        </a>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid #333",
      borderTop: "2px solid #C9A84C",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

function PulseBar() {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 32 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          width: 4,
          height: 24,
          background: "#C9A84C",
          borderRadius: 2,
          opacity: 0.3,
          animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.2;transform:scaleY(.6)} 50%{opacity:.9;transform:scaleY(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#f5f0e8",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
};

const chipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #2a2a2a",
  cursor: "pointer",
  fontSize: 13,
  transition: "all 0.15s ease",
};

const counterBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#f5f0e8",
  fontSize: 20,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
