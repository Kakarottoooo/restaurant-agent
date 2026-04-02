"use client";

import { useState, useEffect } from "react";
import { loadAutonomySettings, saveAutonomySettings, DEFAULT_AUTONOMY } from "@/lib/autonomy";
import type { AgentAutonomySettings } from "@/lib/autonomy";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when settings are saved so the caller can read fresh values. */
  onSave?: (settings: AgentAutonomySettings) => void;
}

// ── Small UI atoms ─────────────────────────────────────────────────────────

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 13 }}>{title}</p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", marginTop: 1 }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "0.5px solid var(--border, #e5e7eb)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 500 }}>{label}</p>
        {hint && <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", marginTop: 1 }}>{hint}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: value ? "var(--gold, #D4A34B)" : "var(--border, #e5e7eb)",
        border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

function Select<T extends string | number>({
  value, options, onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.value) === raw);
        if (opt) onChange(opt.value);
      }}
      style={{
        fontFamily: "var(--font-dm-sans)", fontSize: 11,
        border: "0.5px solid var(--border, #e5e7eb)",
        borderRadius: 6, padding: "4px 8px",
        background: "var(--card, #fff)",
        color: "var(--text-primary, #111)",
        cursor: "pointer", outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Preview sentence ────────────────────────────────────────────────────────

function RestaurantPreview({ s }: { s: AgentAutonomySettings["restaurant"] }) {
  const parts: string[] = [];
  if (s.timeWindowMinutes === 0) {
    parts.push("never adjust the time");
  } else {
    parts.push(`adjust time up to ±${s.timeWindowMinutes} min (between ${s.earliestTimeHHMM} and ${s.latestTimeHHMM})`);
  }
  parts.push(s.allowVenueSwitch ? "switch venues if needed" : "never switch venues");
  return (
    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", fontStyle: "italic", lineHeight: 1.5 }}>
      Agent will {parts.join(" and ")}.
    </p>
  );
}

function HotelPreview({ s }: { s: AgentAutonomySettings["hotel"] }) {
  const parts: string[] = [];
  parts.push(s.budgetFlexPct === 0 ? "stay strictly within budget" : `go up to +${s.budgetFlexPct}% over budget`);
  parts.push(s.allowAreaSwitch ? "switch to same-city alternatives" : "never switch neighborhoods");
  parts.push(s.minStarRating > 0 ? `only book hotels rated ${s.minStarRating}★ or above` : "accept any rating");
  return (
    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", fontStyle: "italic", lineHeight: 1.5 }}>
      Agent will {parts.join(", ")}.
    </p>
  );
}

function FlightPreview({ s }: { s: AgentAutonomySettings["flight"] }) {
  const parts: string[] = [];
  parts.push(s.departureFlexMinutes === 0 ? "never change departure time" : `shift departure up to ±${s.departureFlexMinutes} min`);
  parts.push(s.allowLayover ? "try 1-stop options if no direct" : "direct flights only");
  parts.push(s.allowAlternateAirport ? "try nearby airports (e.g. JFK↔LGA↔EWR)" : "same airport only");
  return (
    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", fontStyle: "italic", lineHeight: 1.5 }}>
      Agent will {parts.join(", ")}.
    </p>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

export function AutonomySettingsModal({ open, onClose, onSave }: Props) {
  const [settings, setSettings] = useState<AgentAutonomySettings>(DEFAULT_AUTONOMY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setSettings(loadAutonomySettings());
      setSaved(false);
    }
  }, [open]);

  if (!open) return null;

  function update<K extends keyof AgentAutonomySettings>(
    section: K,
    patch: Partial<AgentAutonomySettings[K]>
  ) {
    setSaved(false);
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  function handleSave() {
    saveAutonomySettings(settings);
    setSaved(true);
    onSave?.(settings);
    setTimeout(onClose, 600);
  }

  function handleReset() {
    setSettings(DEFAULT_AUTONOMY);
    setSaved(false);
  }

  const r = settings.restaurant;
  const h = settings.hotel;
  const f = settings.flight;

  const timeWindowOptions: Array<{ value: 0 | 30 | 60 | 90; label: string }> = [
    { value: 0, label: "Off — never adjust" },
    { value: 30, label: "±30 min" },
    { value: 60, label: "±60 min" },
    { value: 90, label: "±90 min" },
  ];

  const budgetFlexOptions: Array<{ value: 0 | 10 | 20; label: string }> = [
    { value: 0, label: "No flex — strict budget" },
    { value: 10, label: "Up to +10%" },
    { value: 20, label: "Up to +20%" },
  ];

  const minRatingOptions: Array<{ value: 0 | 3 | 3.5 | 4 | 4.5; label: string }> = [
    { value: 0, label: "Any rating" },
    { value: 3, label: "3.0★ minimum" },
    { value: 3.5, label: "3.5★ minimum" },
    { value: 4, label: "4.0★ minimum" },
    { value: 4.5, label: "4.5★ minimum" },
  ];

  const deptFlexOptions: Array<{ value: 0 | 60 | 120; label: string }> = [
    { value: 0, label: "Off — exact time only" },
    { value: 60, label: "±1 hour" },
    { value: 120, label: "±2 hours" },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--card, #fff)", borderRadius: 20, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", border: "0.5px solid var(--border, #e5e7eb)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid var(--border, #e5e7eb)" }}>
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 15 }}>
              Agent Permissions
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", marginTop: 2 }}>
              Set what the agent can decide on your behalf
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleReset} style={{ background: "none", border: "0.5px solid var(--border, #e5e7eb)", borderRadius: 8, padding: "4px 10px", fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", cursor: "pointer" }}>
              Reset
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted, #888)", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Restaurant ── */}
            <div>
              <SectionHeader emoji="🍽" title="Restaurant" subtitle="Controls what the agent tries when your first-choice time or venue isn't available." />

              <Row label="Time adjustment window" hint="How far the agent may shift your requested time.">
                <Select value={r.timeWindowMinutes} options={timeWindowOptions} onChange={(v) => update("restaurant", { timeWindowMinutes: v })} />
              </Row>

              <Row label="Earliest acceptable time">
                <input type="time" value={r.earliestTimeHHMM} onChange={(e) => update("restaurant", { earliestTimeHHMM: e.target.value })}
                  style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, border: "0.5px solid var(--border, #e5e7eb)", borderRadius: 6, padding: "4px 6px" }} />
              </Row>

              <Row label="Latest acceptable time">
                <input type="time" value={r.latestTimeHHMM} onChange={(e) => update("restaurant", { latestTimeHHMM: e.target.value })}
                  style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, border: "0.5px solid var(--border, #e5e7eb)", borderRadius: 6, padding: "4px 6px" }} />
              </Row>

              <Row label="Switch to alternative venue" hint="Try backup restaurants from your plan if the primary fails.">
                <Toggle value={r.allowVenueSwitch} onChange={(v) => update("restaurant", { allowVenueSwitch: v })} />
              </Row>

              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "var(--card-2, #f9f9f9)" }}>
                <RestaurantPreview s={r} />
              </div>
            </div>

            {/* ── Hotel ── */}
            <div>
              <SectionHeader emoji="🏨" title="Hotel" subtitle="Controls budget flexibility and area switching for hotel bookings." />

              <Row label="Budget flexibility" hint="Agent may book slightly over your stated budget.">
                <Select value={h.budgetFlexPct} options={budgetFlexOptions} onChange={(v) => update("hotel", { budgetFlexPct: v })} />
              </Row>

              <Row label="Switch to alternative area" hint="Try hotels in the same city but different neighborhood.">
                <Toggle value={h.allowAreaSwitch} onChange={(v) => update("hotel", { allowAreaSwitch: v })} />
              </Row>

              <Row label="Minimum star rating" hint="Agent will skip hotels below this threshold.">
                <Select value={h.minStarRating} options={minRatingOptions} onChange={(v) => update("hotel", { minStarRating: v })} />
              </Row>

              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "var(--card-2, #f9f9f9)" }}>
                <HotelPreview s={h} />
              </div>
            </div>

            {/* ── Flight ── */}
            <div>
              <SectionHeader emoji="✈" title="Flight" subtitle="Controls departure flexibility, layovers, and airport alternatives." />

              <Row label="Departure time flexibility" hint="How much the agent may shift your departure window.">
                <Select value={f.departureFlexMinutes} options={deptFlexOptions} onChange={(v) => update("flight", { departureFlexMinutes: v })} />
              </Row>

              <Row label="Allow layovers" hint="Try 1-stop options when no direct flights are found.">
                <Toggle value={f.allowLayover} onChange={(v) => update("flight", { allowLayover: v })} />
              </Row>

              <Row label="Try nearby airports" hint="e.g. JFK ↔ LGA ↔ EWR · LAX ↔ BUR · SFO ↔ OAK">
                <Toggle value={f.allowAlternateAirport} onChange={(v) => update("flight", { allowAlternateAirport: v })} />
              </Row>

              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "var(--card-2, #f9f9f9)" }}>
                <FlightPreview s={f} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "0.5px solid var(--border, #e5e7eb)" }}>
          <button
            onClick={handleSave}
            style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              backgroundColor: saved ? "rgba(22,163,74,0.85)" : "var(--gold, #D4A34B)",
              color: "#fff", fontFamily: "var(--font-dm-sans)", fontSize: 13,
              fontWeight: 600, cursor: "pointer", transition: "background 0.2s",
            }}
          >
            {saved ? "Saved ✓" : "Save permissions"}
          </button>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)", textAlign: "center", marginTop: 6 }}>
            These settings apply to all future autopilot runs. The agent will explain every decision it makes.
          </p>
        </div>
      </div>
    </div>
  );
}
