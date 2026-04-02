"use client";

/**
 * /permissions — Agent autonomy & permission controls
 *
 * Four sections:
 *   1. Autopilot Level     — how much the agent does without asking
 *   2. Time Flexibility    — how far the agent can shift times
 *   3. Option Switching    — can the agent swap venues / hotels / airlines
 *   4. Budget Elasticity   — can the agent spend a bit more to close a booking
 *   5. Hard Limits         — absolute constraints the agent must never cross
 *
 * All settings auto-save to localStorage on every change.
 */

import { useState, useEffect, useCallback } from "react";
import GlobalNav from "@/components/GlobalNav";
import { useLanguage } from "@/app/hooks/useLanguage";
import {
  loadAutonomySettings,
  saveAutonomySettings,
  DEFAULT_AUTONOMY,
  type AgentAutonomySettings,
  type AutopilotLevel,
} from "@/lib/autonomy";

// ── Deep merge helper ──────────────────────────────────────────────────────

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const result = { ...(base as object) } as Record<string, unknown>;
  for (const key of Object.keys(patch as object)) {
    const pv = (patch as Record<string, unknown>)[key];
    const bv = (base as Record<string, unknown>)[key];
    if (pv && typeof pv === "object" && !Array.isArray(pv) && bv && typeof bv === "object")
      result[key] = deepMerge(bv, pv);
    else
      result[key] = pv;
  }
  return result as T;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700,
      color: "var(--text-muted, #aaa)", textTransform: "uppercase",
      letterSpacing: "0.08em", marginBottom: 12, marginTop: 28,
    }}>
      {children}
    </p>
  );
}

function SubLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
      color: "var(--text-muted, #aaa)", textTransform: "uppercase",
      letterSpacing: "0.06em", marginBottom: 8, marginTop: 16,
    }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: "var(--font-dm-sans)", fontSize: 12,
      color: "var(--text-secondary, #666)", marginBottom: 6,
    }}>
      {children}
    </p>
  );
}

// Segmented pill control
function Seg<T extends number | string>({
  options, value, onChange,
}: { options: { v: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
            padding: "5px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            fontFamily: "var(--font-dm-sans)", fontWeight: active ? 700 : 400,
            border: "none",
            backgroundColor: active ? "var(--gold, #C9A84C)" : "var(--card, #f5f5f4)",
            color: active ? "#fff" : "var(--text-secondary, #666)",
            transition: "background 0.15s, color 0.15s",
          }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// Toggle switch
function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <div
      onClick={onChange}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
        border: "0.5px solid var(--border, #e5e7eb)",
        backgroundColor: "var(--card, #fff)",
        userSelect: "none",
      }}
    >
      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)", marginBottom: desc ? 2 : 0 }}>
          {label}
        </p>
        {desc && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>{desc}</p>
        )}
      </div>
      {/* Track */}
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginLeft: 12,
        backgroundColor: on ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)",
        position: "relative", transition: "background 0.2s",
      }}>
        {/* Thumb */}
        <div style={{
          position: "absolute", top: 2, left: 2, width: 16, height: 16,
          borderRadius: "50%", backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          transform: on ? "translateX(16px)" : "translateX(0)",
          transition: "transform 0.2s",
        }} />
      </div>
    </div>
  );
}

// Star rating — maps 5 star buttons to the discrete values [0, 3, 3.5, 4, 4.5]
const STAR_VALUES = [0, 3, 3.5, 4, 4.5] as const;

function StarRating({ value, onChange, hint }: { value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {STAR_VALUES.map((sv, i) => (
          <button
            key={sv}
            onClick={() => onChange(sv)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
              fontSize: 24, lineHeight: 1,
              color: value >= sv && value > 0 ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)",
              transition: "color 0.15s",
            }}
            title={`${sv} stars`}
          >
            {i < 2 ? "★" : i === 2 ? "⭑" : "★"}
          </button>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>{hint}</p>
    </div>
  );
}

// Autopilot card
interface AutopilotCardProps {
  level: AutopilotLevel;
  selected: boolean;
  onSelect: () => void;
  emoji: string;
  title: string;
  desc: string;
}
function AutopilotCard({ level: _level, selected, onSelect, emoji, title, desc }: AutopilotCardProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0, borderRadius: 14, padding: "16px 14px", cursor: "pointer",
        border: selected ? "1.5px solid var(--gold, #C9A84C)" : "0.5px solid var(--border, #e5e7eb)",
        backgroundColor: selected ? "rgba(201,168,76,0.06)" : "var(--card, #fff)",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
      <p style={{
        fontFamily: "var(--font-playfair, serif)", fontSize: 13, fontWeight: 700,
        color: selected ? "var(--gold, #C9A84C)" : "var(--text-primary, #111)",
        marginBottom: 4,
      }}>{title}</p>
      <p style={{
        fontFamily: "var(--font-dm-sans)", fontSize: 11.5,
        color: "var(--text-secondary, #666)", lineHeight: 1.5,
      }}>{desc}</p>
    </div>
  );
}

// Collapsible behavior explainer
function BehaviorCard({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: 12, border: "0.5px solid var(--border, #e5e7eb)",
      backgroundColor: "var(--card, #fff)", overflow: "hidden", marginTop: 16,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600,
          color: "var(--text-primary, #111)",
        }}
      >
        {title}
        <span style={{ color: "var(--text-muted, #aaa)", fontSize: 12, marginLeft: 8 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--border, #e5e7eb)" }}>
          <ul style={{ margin: "10px 0 0 0", padding: "0 0 0 16px" }}>
            {items.map((item, i) => (
              <li key={i} style={{
                fontFamily: "var(--font-dm-sans)", fontSize: 12.5,
                color: "var(--text-secondary, #666)", lineHeight: 1.6, marginBottom: 4,
              }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Time input
function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 8, boxSizing: "border-box",
          border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
          fontFamily: "var(--font-dm-sans)", fontSize: 13,
          color: "var(--text-primary, #111)", outline: "none",
        }}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [settings, setSettings] = useState<AgentAutonomySettings>(DEFAULT_AUTONOMY);
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const { t } = useLanguage();
  const tp = t.permissions;

  useEffect(() => {
    setSettings(loadAutonomySettings());
    setMounted(true);
  }, []);

  const update = useCallback((patch: unknown) => {
    setSettings((prev) => {
      const next = deepMerge(prev, patch);
      saveAutonomySettings(next);
      return next;
    });
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)" }}>
        <GlobalNav active="other" />
      </div>
    );
  }

  const { restaurant: r, hotel: h, flight: f, activity: a } = settings;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)" }}>
      <GlobalNav active="other" />

      <main style={{ maxWidth: 580, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <h1 style={{
            fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 700,
            color: "var(--text-primary, #111)", marginBottom: 6,
          }}>
            {tp.title}
          </h1>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)" }}>
            {tp.subtitle}
          </p>
        </div>

        {/* ── Section 1: Autopilot Level ── */}
        <SectionLabel>{tp.autopilotLabel}</SectionLabel>
        <div style={{ display: "flex", gap: 10 }}>
          {([
            { level: "ask"   as AutopilotLevel, emoji: "🤔", title: tp.autopilotAsk,   desc: tp.autopilotAskDesc },
            { level: "smart" as AutopilotLevel, emoji: "⚡", title: tp.autopilotSmart, desc: tp.autopilotSmartDesc },
            { level: "full"  as AutopilotLevel, emoji: "🚀", title: tp.autopilotFull,  desc: tp.autopilotFullDesc },
          ] as const).map(({ level, emoji, title, desc }) => (
            <AutopilotCard
              key={level}
              level={level}
              emoji={emoji}
              title={title}
              desc={desc}
              selected={settings.autopilot === level}
              onSelect={() => update({ autopilot: level })}
            />
          ))}
        </div>

        {/* Behavior explainer */}
        <BehaviorCard
          title={tp.behaviorTitle}
          items={[tp.behaviorTimeWindow, tp.behaviorVenueSwitch, tp.behaviorBudget, tp.behaviorStarRating]}
        />

        {/* ── Section 2: Time Flexibility ── */}
        <SectionLabel>{tp.sectionTime}</SectionLabel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FieldLabel>{tp.restaurantWindow}</FieldLabel>
            <Seg
              options={[
                { v: 0,  l: tp.off },
                { v: 30, l: tp.s30min },
                { v: 60, l: tp.s60min },
                { v: 90, l: tp.s90min },
              ]}
              value={r.timeWindowMinutes}
              onChange={(v) => update({ restaurant: { timeWindowMinutes: v } })}
            />
          </div>

          <div>
            <FieldLabel>{tp.flightWindow}</FieldLabel>
            <Seg
              options={[
                { v: 0,   l: tp.off },
                { v: 60,  l: tp.s1h },
                { v: 120, l: tp.s2h },
                { v: 180, l: tp.s3h },
              ]}
              value={f.departureFlexMinutes}
              onChange={(v) => update({ flight: { departureFlexMinutes: v } })}
            />
          </div>

          <div>
            <FieldLabel>{tp.activityWindow}</FieldLabel>
            <Seg
              options={[
                { v: 0,  l: tp.off },
                { v: 30, l: tp.s30min },
                { v: 60, l: tp.s60min },
                { v: 90, l: tp.s90min },
              ]}
              value={a.timeWindowMinutes}
              onChange={(v) => update({ activity: { timeWindowMinutes: v } })}
            />
          </div>
        </div>

        {/* ── Section 3: Option Switching ── */}
        <SectionLabel>{tp.sectionSwitching}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Toggle
            on={r.allowVenueSwitch}
            label={tp.restaurantVenueSwitch}
            onChange={() => update({ restaurant: { allowVenueSwitch: !r.allowVenueSwitch } })}
          />
          <Toggle
            on={h.allowAreaSwitch}
            label={tp.hotelAreaSwitch}
            onChange={() => update({ hotel: { allowAreaSwitch: !h.allowAreaSwitch } })}
          />
          <Toggle
            on={h.allowCrossRegion}
            label={tp.hotelCrossRegion}
            onChange={() => update({ hotel: { allowCrossRegion: !h.allowCrossRegion } })}
          />
          <Toggle
            on={f.allowLayover}
            label={tp.flightLayover}
            onChange={() => update({ flight: { allowLayover: !f.allowLayover } })}
          />
          <Toggle
            on={f.allowAlternateAirport}
            label={tp.flightAltAirport}
            onChange={() => update({ flight: { allowAlternateAirport: !f.allowAlternateAirport } })}
          />
          <Toggle
            on={a.allowVenueSwitch}
            label={tp.activityVenueSwitch}
            onChange={() => update({ activity: { allowVenueSwitch: !a.allowVenueSwitch } })}
          />
        </div>

        {/* ── Section 4: Budget Elasticity ── */}
        <SectionLabel>{tp.sectionBudget}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FieldLabel>{tp.restaurant}</FieldLabel>
            <Seg
              options={[
                { v: 0,  l: tp.strict },
                { v: 5,  l: tp.p5 },
                { v: 10, l: tp.p10 },
                { v: 20, l: tp.p20 },
              ]}
              value={r.budgetFlexPct}
              onChange={(v) => update({ restaurant: { budgetFlexPct: v } })}
            />
          </div>
          <div>
            <FieldLabel>{tp.hotel}</FieldLabel>
            <Seg
              options={[
                { v: 0,  l: tp.strict },
                { v: 5,  l: tp.p5 },
                { v: 10, l: tp.p10 },
                { v: 20, l: tp.p20 },
              ]}
              value={h.budgetFlexPct}
              onChange={(v) => update({ hotel: { budgetFlexPct: v } })}
            />
          </div>
        </div>

        {/* ── Section 5: Hard Limits ── */}
        <SectionLabel>{tp.sectionHardLimits}</SectionLabel>

        {/* Restaurant hard limits */}
        <SubLabel>{tp.restaurant}</SubLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          <TimeInput
            label={tp.earliestTime}
            value={r.earliestTimeHHMM}
            onChange={(v) => update({ restaurant: { earliestTimeHHMM: v } })}
          />
          <TimeInput
            label={tp.latestTime}
            value={r.latestTimeHHMM}
            onChange={(v) => update({ restaurant: { latestTimeHHMM: v } })}
          />
        </div>
        <Toggle
          on={r.requireIndoor}
          label={tp.restaurantIndoor}
          onChange={() => update({ restaurant: { requireIndoor: !r.requireIndoor } })}
        />

        {/* Hotel hard limits */}
        <SubLabel>{tp.hotel}</SubLabel>
        <div style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 12, border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)" }}>
          <FieldLabel>{tp.minStarRating}</FieldLabel>
          <StarRating
            value={h.minStarRating}
            onChange={(v) => update({ hotel: { minStarRating: v } })}
            hint={tp.minStarValue(h.minStarRating)}
          />
        </div>
        <Toggle
          on={h.requireParking}
          label={tp.hotelParking}
          onChange={() => update({ hotel: { requireParking: !h.requireParking } })}
        />

        {/* Activity hard limits */}
        <SubLabel>{tp.activity}</SubLabel>
        <Toggle
          on={a.requireIndoor}
          label={tp.activityIndoor}
          onChange={() => update({ activity: { requireIndoor: !a.requireIndoor } })}
        />

        {/* Auto-save notice */}
        <p style={{
          fontFamily: "var(--font-dm-sans)", fontSize: 12,
          color: saved ? "var(--gold, #C9A84C)" : "var(--text-muted, #aaa)",
          textAlign: "center", marginTop: 36,
          transition: "color 0.3s",
        }}>
          {saved ? "✓ " : ""}{tp.autoSaved}
        </p>
      </main>
    </div>
  );
}
