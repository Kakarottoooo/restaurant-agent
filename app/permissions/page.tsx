"use client";

/**
 * /permissions — Unified Settings hub
 *
 * Two tabs:
 *   Taste Profile  — discovered preferences + dietary restrictions
 *   Permissions    — autopilot level, time/switch/budget/hard limits
 *
 * All settings auto-save to localStorage on every change.
 */

import { useState, useEffect, useCallback } from "react";
import GlobalNav from "@/components/GlobalNav";
import { useLanguage } from "@/app/hooks/useLanguage";
import { usePreferences } from "@/app/hooks/usePreferences";
import {
  loadAutonomySettings,
  saveAutonomySettings,
  DEFAULT_AUTONOMY,
  type AgentAutonomySettings,
  type AutopilotLevel,
} from "@/lib/autonomy";

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Shellfish-free", "Halal", "Kosher"];

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

// ── Shared sub-components ──────────────────────────────────────────────────

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
    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", marginBottom: 6 }}>
      {children}
    </p>
  );
}

function Seg<T extends number | string>({ options, value, onChange }: {
  options: { v: T; l: string }[]; value: T; onChange: (v: T) => void;
}) {
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

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <div onClick={onChange} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "11px 14px", borderRadius: 12, cursor: "pointer",
      border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
      userSelect: "none",
    }}>
      <div>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)", marginBottom: desc ? 2 : 0 }}>
          {label}
        </p>
        {desc && <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>{desc}</p>}
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginLeft: 12,
        backgroundColor: on ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)",
        position: "relative", transition: "background 0.2s",
      }}>
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

const STAR_VALUES = [0, 3, 3.5, 4, 4.5] as const;

function StarRating({ value, onChange, hint }: { value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {STAR_VALUES.map((sv, i) => (
          <button key={sv} onClick={() => onChange(sv)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
            fontSize: 24, lineHeight: 1,
            color: value >= sv && value > 0 ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)",
            transition: "color 0.15s",
          }} title={`${sv} stars`}>
            {i < 2 ? "★" : i === 2 ? "⭑" : "★"}
          </button>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>{hint}</p>
    </div>
  );
}

function AutopilotCard({ level: _level, selected, onSelect, emoji, title, desc }: {
  level: AutopilotLevel; selected: boolean; onSelect: () => void;
  emoji: string; title: string; desc: string;
}) {
  return (
    <div onClick={onSelect} style={{
      flex: 1, minWidth: 0, borderRadius: 14, padding: "16px 14px", cursor: "pointer",
      border: selected ? "1.5px solid var(--gold, #C9A84C)" : "0.5px solid var(--border, #e5e7eb)",
      backgroundColor: selected ? "rgba(201,168,76,0.06)" : "var(--card, #fff)",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
      <p style={{
        fontFamily: "var(--font-playfair, serif)", fontSize: 13, fontWeight: 700,
        color: selected ? "var(--gold, #C9A84C)" : "var(--text-primary, #111)", marginBottom: 4,
      }}>{title}</p>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11.5, color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
        {desc}
      </p>
    </div>
  );
}

function BehaviorCard({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: 12, border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)", overflow: "hidden", marginTop: 16 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
        fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600, color: "var(--text-primary, #111)",
      }}>
        {title}
        <span style={{ color: "var(--text-muted, #aaa)", fontSize: 12, marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--border, #e5e7eb)" }}>
          <ul style={{ margin: "10px 0 0 0", padding: "0 0 0 16px" }}>
            {items.map((item, i) => (
              <li key={i} style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12.5, color: "var(--text-secondary, #666)", lineHeight: 1.6, marginBottom: 4 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", padding: "8px 10px", borderRadius: 8, boxSizing: "border-box",
        border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
        fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)", outline: "none",
      }} />
    </div>
  );
}

// ── Booking Profile helpers ────────────────────────────────────────────────

const PROFILE_KEY = "booking_profile";

export interface BookingProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export function loadBookingProfile(): BookingProfile {
  if (typeof window === "undefined") return { first_name: "", last_name: "", email: "", phone: "" };
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
  } catch {
    return { first_name: "", last_name: "", email: "", phone: "" };
  }
}

function saveBookingProfile(p: BookingProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

// ── Booking Profile tab ────────────────────────────────────────────────────

function BookingProfileTab() {
  const [profile, setProfile] = useState<BookingProfile>({ first_name: "", last_name: "", email: "", phone: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadBookingProfile());
  }, []);

  function set(field: keyof BookingProfile, value: string) {
    const next = { ...profile, [field]: value };
    setProfile(next);
    saveBookingProfile(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, boxSizing: "border-box",
    border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
    fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-primary, #111)",
    outline: "none", transition: "border-color 0.15s",
  };

  const isComplete = profile.first_name && profile.last_name && profile.email && profile.phone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderRadius: 12, marginBottom: 24,
        backgroundColor: isComplete ? "rgba(201,168,76,0.08)" : "var(--card, #fff)",
        border: `0.5px solid ${isComplete ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)"}`,
      }}>
        <span style={{ fontSize: 20 }}>{isComplete ? "✅" : "📋"}</span>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)", fontWeight: 600 }}>
            {isComplete ? "Agent can auto-fill booking forms" : "Add your details to enable auto-fill"}
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
            {isComplete
              ? "Agent will fill name, email, and phone on booking sites"
              : "Without a profile the agent stops at the form page"}
          </p>
        </div>
      </div>

      {/* Name row */}
      <SectionLabel>Name</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <FieldLabel>First name</FieldLabel>
          <input
            style={inputStyle}
            value={profile.first_name}
            placeholder="Jane"
            onChange={(e) => set("first_name", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Last name</FieldLabel>
          <input
            style={inputStyle}
            value={profile.last_name}
            placeholder="Smith"
            onChange={(e) => set("last_name", e.target.value)}
          />
        </div>
      </div>

      {/* Contact */}
      <SectionLabel>Contact</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            style={inputStyle}
            type="email"
            value={profile.email}
            placeholder="jane@example.com"
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input
            style={inputStyle}
            type="tel"
            value={profile.phone}
            placeholder="+1 555 000 0000"
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>

      {/* Privacy note */}
      <p style={{
        fontFamily: "var(--font-dm-sans)", fontSize: 11,
        color: "var(--text-muted, #aaa)", marginTop: 24, lineHeight: 1.6,
      }}>
        Stored locally on your device. The agent uses this to pre-fill restaurant and hotel booking forms.
        Payment is always completed by you.
      </p>

      {/* Auto-save */}
      <p style={{
        fontFamily: "var(--font-dm-sans)", fontSize: 12, textAlign: "center", marginTop: 16,
        color: saved ? "var(--gold, #C9A84C)" : "transparent", transition: "color 0.3s",
      }}>
        ✓ Saved
      </p>
    </div>
  );
}

// ── AI Model tab ────────────────────────────────────────────────────────────

export interface AgentModelConfig {
  model: string;
  apiKey: string;
}

// Stagehand tool-based agent uses short model names (no "provider/" prefix)
const MODEL_OPTIONS: { model: string; label: string; provider: string; hint: string }[] = [
  {
    model: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    hint: "Best overall — strong vision & form-filling, widely supported",
  },
  {
    model: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    hint: "Fast & free tier available",
  },
  {
    model: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    hint: "Best reasoning accuracy",
  },
];

export function loadAgentModelConfig(): AgentModelConfig {
  try {
    return JSON.parse(localStorage.getItem("agent_model_config") ?? "{}") as AgentModelConfig;
  } catch { return { model: "", apiKey: "" }; }
}

function saveAgentModelConfig(cfg: AgentModelConfig) {
  localStorage.setItem("agent_model_config", JSON.stringify(cfg));
}

function AgentModelTab() {
  const [cfg, setCfg] = useState<AgentModelConfig>({ model: "", apiKey: "" });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setCfg(loadAgentModelConfig()); }, []);

  function selectModel(model: string) {
    const next = { ...cfg, model };
    setCfg(next);
    saveAgentModelConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function setApiKey(apiKey: string) {
    const next = { ...cfg, apiKey };
    setCfg(next);
    saveAgentModelConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const selectedOption = MODEL_OPTIONS.find((o) => o.model === cfg.model);
  const isReady = !!cfg.model && !!cfg.apiKey;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, boxSizing: "border-box",
    border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
    fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--text-primary, #111)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderRadius: 12, marginBottom: 24,
        backgroundColor: isReady ? "rgba(201,168,76,0.08)" : "var(--card, #fff)",
        border: `0.5px solid ${isReady ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)"}`,
      }}>
        <span style={{ fontSize: 20 }}>{isReady ? "✅" : "🤖"}</span>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-primary, #111)", fontWeight: 600 }}>
            {isReady ? `Using ${selectedOption?.label} for browser automation` : "Choose your AI model"}
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
            {isReady ? "Agent will use this model to navigate booking sites" : "The agent needs a vision model to navigate websites"}
          </p>
        </div>
      </div>

      {/* Model cards */}
      <SectionLabel>Browser Agent Model</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {MODEL_OPTIONS.map((opt) => {
          const active = cfg.model === opt.model;
          return (
            <div key={opt.model} onClick={() => selectModel(opt.model)} style={{
              padding: "14px 16px", borderRadius: 12, cursor: "pointer",
              border: active ? "1.5px solid var(--gold, #C9A84C)" : "0.5px solid var(--border, #e5e7eb)",
              backgroundColor: active ? "rgba(201,168,76,0.06)" : "var(--card, #fff)",
              transition: "border-color 0.15s, background 0.15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <p style={{
                  fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 700,
                  color: active ? "var(--gold, #C9A84C)" : "var(--text-primary, #111)",
                }}>
                  {opt.label}
                </p>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-dm-sans)", fontWeight: 600,
                  padding: "2px 8px", borderRadius: 20,
                  backgroundColor: active ? "var(--gold, #C9A84C)" : "var(--card-2, #f5f5f4)",
                  color: active ? "#fff" : "var(--text-muted, #aaa)",
                }}>
                  {opt.provider}
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11.5, color: "var(--text-secondary, #666)" }}>
                {opt.hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* API key input — shown once a model is selected */}
      {cfg.model && (
        <>
          <SectionLabel>API Key</SectionLabel>
          <FieldLabel>{`${selectedOption?.provider ?? ""} API key`}</FieldLabel>
          <div style={{ position: "relative" }}>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showKey ? "text" : "password"}
              value={cfg.apiKey}
              placeholder="Paste your API key here"
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button onClick={() => setShowKey((v) => !v)} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)",
            }}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", marginTop: 10, lineHeight: 1.6 }}>
            Stored locally on your device and sent directly to the browser agent. Never stored on our servers.
          </p>
        </>
      )}

      <p style={{
        fontFamily: "var(--font-dm-sans)", fontSize: 12, textAlign: "center", marginTop: 20,
        color: saved ? "var(--gold, #C9A84C)" : "transparent", transition: "color 0.3s",
      }}>
        ✓ Saved
      </p>
    </div>
  );
}

// ── Taste Profile tab ──────────────────────────────────────────────────────

function TasteProfileTab() {
  const { profile, updateProfile, updateDiscoveredPreference, removeDiscoveredPreference } = usePreferences();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState("");

  const CAT_META: Record<string, { emoji: string; label: string }> = {
    dining:   { emoji: "🍽", label: "Dining" },
    travel:   { emoji: "✈️", label: "Travel" },
    hotels:   { emoji: "🏨", label: "Hotels" },
    shopping: { emoji: "🛍", label: "Shopping" },
    general:  { emoji: "⭐", label: "General" },
  };

  const discovered = profile.discovered ?? [];
  const hasSignals = discovered.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Discovered preferences */}
      {!hasSignals && (
        <div style={{
          textAlign: "center", padding: "36px 20px", borderRadius: 14,
          border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
            Start chatting — we&apos;ll build your taste profile automatically
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", marginTop: 6 }}>
            Ask about restaurants, hotels, flights, gifts...
          </p>
        </div>
      )}

      {(["dining", "travel", "hotels", "shopping", "general"] as const).map((cat) => {
        const items = discovered.filter((p) => p.category === cat);
        if (items.length === 0) return null;
        const meta = CAT_META[cat];
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <p style={{
              fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700,
              color: "var(--text-muted, #aaa)", textTransform: "uppercase",
              letterSpacing: "0.07em", marginBottom: 10,
            }}>
              {meta.emoji} {meta.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {items.map((pref) => {
                const isEditing = editingId === pref.id;
                const confColor = pref.seen_count >= 3 ? "#22c55e" : pref.seen_count >= 2 ? "#f59e0b" : "var(--text-muted, #aaa)";
                return (
                  <div key={pref.id} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: isEditing ? "5px 8px" : "6px 12px",
                    borderRadius: 24,
                    border: `0.5px solid ${pref.user_confirmed ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)"}`,
                    backgroundColor: pref.user_confirmed ? "rgba(201,168,76,0.08)" : "var(--card, #fff)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    {/* Confidence dot */}
                    <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: confColor, flexShrink: 0 }} />

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingVal}
                        onChange={(e) => setEditingVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingVal.trim()) {
                            updateDiscoveredPreference(pref.id, { value: editingVal.trim(), user_confirmed: true });
                            setEditingId(null);
                          } else if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          fontFamily: "var(--font-dm-sans)", fontSize: 12,
                          color: "var(--text-primary, #111)", background: "none",
                          border: "none", outline: "none", width: 120,
                        }}
                      />
                    ) : (
                      <span title={`Seen ${pref.seen_count}x · ${pref.source}`} style={{
                        fontFamily: "var(--font-dm-sans)", fontSize: 12,
                        color: "var(--text-primary, #111)", maxWidth: 180,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {pref.label}: <span style={{ color: "var(--text-secondary, #666)" }}>{pref.value}</span>
                      </span>
                    )}

                    {/* Edit / confirm */}
                    {!isEditing ? (
                      <button onClick={() => { setEditingId(pref.id); setEditingVal(pref.value); }} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted, #aaa)", padding: "0 1px", fontSize: 11, lineHeight: 1,
                      }}>✏️</button>
                    ) : (
                      <button onClick={() => {
                        if (editingVal.trim()) updateDiscoveredPreference(pref.id, { value: editingVal.trim(), user_confirmed: true });
                        setEditingId(null);
                      }} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--gold, #C9A84C)", padding: "0 1px", fontSize: 12, fontWeight: 700,
                      }}>✓</button>
                    )}

                    {/* Remove */}
                    <button onClick={() => removeDiscoveredPreference(pref.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-muted, #aaa)", padding: "0 1px", fontSize: 13, lineHeight: 1,
                    }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Divider */}
      {hasSignals && <div style={{ height: "0.5px", backgroundColor: "var(--border, #e5e7eb)", margin: "4px 0 20px" }} />}

      {/* Dietary restrictions */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700,
          color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10,
        }}>
          🥗 Dietary restrictions
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DIETARY_OPTIONS.map((d) => {
            const active = profile.dietary_restrictions.includes(d);
            return (
              <button key={d} onClick={() => {
                const next = active
                  ? profile.dietary_restrictions.filter((x) => x !== d)
                  : [...profile.dietary_restrictions, d];
                updateProfile({ dietary_restrictions: next });
              }} style={{
                padding: "6px 14px", borderRadius: 24, cursor: "pointer",
                fontFamily: "var(--font-dm-sans)", fontSize: 12,
                border: `0.5px solid ${active ? "var(--gold, #C9A84C)" : "var(--border, #e5e7eb)"}`,
                backgroundColor: active ? "var(--gold, #C9A84C)" : "var(--card, #fff)",
                color: active ? "#fff" : "var(--text-secondary, #666)",
                transition: "all 0.15s",
              }}>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear all */}
      {hasSignals && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
            {discovered.length} signal{discovered.length !== 1 ? "s" : ""} · Updated {new Date(profile.updated_at).toLocaleDateString()}
          </p>
          <button onClick={() => updateProfile({ discovered: [] })} style={{
            fontFamily: "var(--font-dm-sans)", fontSize: 12,
            color: "var(--text-secondary, #666)", background: "none",
            border: "0.5px solid var(--border, #e5e7eb)", borderRadius: 8,
            padding: "5px 12px", cursor: "pointer",
          }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ── Agent Permissions tab ──────────────────────────────────────────────────

function PermissionsTab({ settings, update, tp }: {
  settings: AgentAutonomySettings;
  update: (patch: unknown) => void;
  tp: ReturnType<typeof useLanguage>["t"]["permissions"];
}) {
  const { restaurant: r, hotel: h, flight: f, activity: a } = settings;

  return (
    <div>
      {/* Autopilot Level */}
      <SectionLabel>{tp.autopilotLabel}</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        {([
          { level: "ask"   as AutopilotLevel, emoji: "🤔", title: tp.autopilotAsk,   desc: tp.autopilotAskDesc },
          { level: "smart" as AutopilotLevel, emoji: "⚡", title: tp.autopilotSmart, desc: tp.autopilotSmartDesc },
          { level: "full"  as AutopilotLevel, emoji: "🚀", title: tp.autopilotFull,  desc: tp.autopilotFullDesc },
        ] as const).map(({ level, emoji, title, desc }) => (
          <AutopilotCard key={level} level={level} emoji={emoji} title={title} desc={desc}
            selected={settings.autopilot === level}
            onSelect={() => update({ autopilot: level })}
          />
        ))}
      </div>

      <BehaviorCard
        title={tp.behaviorTitle}
        items={[tp.behaviorTimeWindow, tp.behaviorVenueSwitch, tp.behaviorBudget, tp.behaviorStarRating]}
      />

      {/* Time Flexibility */}
      <SectionLabel>{tp.sectionTime}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <FieldLabel>{tp.restaurantWindow}</FieldLabel>
          <Seg options={[{v:0,l:tp.off},{v:30,l:tp.s30min},{v:60,l:tp.s60min},{v:90,l:tp.s90min}]}
            value={r.timeWindowMinutes} onChange={(v) => update({ restaurant: { timeWindowMinutes: v } })} />
        </div>
        <div>
          <FieldLabel>{tp.flightWindow}</FieldLabel>
          <Seg options={[{v:0,l:tp.off},{v:60,l:tp.s1h},{v:120,l:tp.s2h},{v:180,l:tp.s3h}]}
            value={f.departureFlexMinutes} onChange={(v) => update({ flight: { departureFlexMinutes: v } })} />
        </div>
        <div>
          <FieldLabel>{tp.activityWindow}</FieldLabel>
          <Seg options={[{v:0,l:tp.off},{v:30,l:tp.s30min},{v:60,l:tp.s60min},{v:90,l:tp.s90min}]}
            value={a.timeWindowMinutes} onChange={(v) => update({ activity: { timeWindowMinutes: v } })} />
        </div>
      </div>

      {/* Option Switching */}
      <SectionLabel>{tp.sectionSwitching}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Toggle on={r.allowVenueSwitch} label={tp.restaurantVenueSwitch}
          onChange={() => update({ restaurant: { allowVenueSwitch: !r.allowVenueSwitch } })} />
        <Toggle on={h.allowAreaSwitch} label={tp.hotelAreaSwitch}
          onChange={() => update({ hotel: { allowAreaSwitch: !h.allowAreaSwitch } })} />
        <Toggle on={h.allowCrossRegion} label={tp.hotelCrossRegion}
          onChange={() => update({ hotel: { allowCrossRegion: !h.allowCrossRegion } })} />
        <Toggle on={f.allowLayover} label={tp.flightLayover}
          onChange={() => update({ flight: { allowLayover: !f.allowLayover } })} />
        <Toggle on={f.allowAlternateAirport} label={tp.flightAltAirport}
          onChange={() => update({ flight: { allowAlternateAirport: !f.allowAlternateAirport } })} />
        <Toggle on={a.allowVenueSwitch} label={tp.activityVenueSwitch}
          onChange={() => update({ activity: { allowVenueSwitch: !a.allowVenueSwitch } })} />
      </div>

      {/* Budget Elasticity */}
      <SectionLabel>{tp.sectionBudget}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <FieldLabel>{tp.restaurant}</FieldLabel>
          <Seg options={[{v:0,l:tp.strict},{v:5,l:tp.p5},{v:10,l:tp.p10},{v:20,l:tp.p20}]}
            value={r.budgetFlexPct} onChange={(v) => update({ restaurant: { budgetFlexPct: v } })} />
        </div>
        <div>
          <FieldLabel>{tp.hotel}</FieldLabel>
          <Seg options={[{v:0,l:tp.strict},{v:5,l:tp.p5},{v:10,l:tp.p10},{v:20,l:tp.p20}]}
            value={h.budgetFlexPct} onChange={(v) => update({ hotel: { budgetFlexPct: v } })} />
        </div>
      </div>

      {/* Hard Limits */}
      <SectionLabel>{tp.sectionHardLimits}</SectionLabel>

      <SubLabel>{tp.restaurant}</SubLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
        <TimeInput label={tp.earliestTime} value={r.earliestTimeHHMM}
          onChange={(v) => update({ restaurant: { earliestTimeHHMM: v } })} />
        <TimeInput label={tp.latestTime} value={r.latestTimeHHMM}
          onChange={(v) => update({ restaurant: { latestTimeHHMM: v } })} />
      </div>
      <Toggle on={r.requireIndoor} label={tp.restaurantIndoor}
        onChange={() => update({ restaurant: { requireIndoor: !r.requireIndoor } })} />

      <SubLabel>{tp.hotel}</SubLabel>
      <div style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 12, border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)" }}>
        <FieldLabel>{tp.minStarRating}</FieldLabel>
        <StarRating value={h.minStarRating} hint={tp.minStarValue(h.minStarRating)}
          onChange={(v) => update({ hotel: { minStarRating: v } })} />
      </div>
      <Toggle on={h.requireParking} label={tp.hotelParking}
        onChange={() => update({ hotel: { requireParking: !h.requireParking } })} />

      <SubLabel>{tp.activity}</SubLabel>
      <Toggle on={a.requireIndoor} label={tp.activityIndoor}
        onChange={() => update({ activity: { requireIndoor: !a.requireIndoor } })} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type TabId = "profile" | "model" | "taste" | "permissions";

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
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
    setTimeout(() => setSaved(false), 1800);
  }, []);

  const TABS: { id: TabId; label: string }[] = [
    { id: "profile",     label: "My Profile" },
    { id: "model",       label: "AI Model" },
    { id: "taste",       label: "Taste Profile" },
    { id: "permissions", label: tp.title },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)" }}>
      <GlobalNav active="other" />

      <main style={{ maxWidth: 580, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 700, color: "var(--text-primary, #111)", marginBottom: 6 }}>
            Preferences
          </h1>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)" }}>
            Your taste profile and agent behaviour settings.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--border, #e5e7eb)", marginBottom: 24, marginTop: 20, gap: 0 }}>
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

        {/* Tab content */}
        {activeTab === "profile" && <BookingProfileTab />}
        {activeTab === "model" && <AgentModelTab />}
        {activeTab === "taste" && <TasteProfileTab />}
        {activeTab === "permissions" && mounted && (
          <PermissionsTab settings={settings} update={update} tp={tp} />
        )}
        {activeTab === "permissions" && !mounted && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-muted, #aaa)" }}>Loading…</p>
        )}

        {/* Auto-save notice (permissions tab only) */}
        {activeTab === "permissions" && saved && (
          <p style={{
            fontFamily: "var(--font-dm-sans)", fontSize: 12,
            color: saved ? "var(--gold, #C9A84C)" : "var(--text-muted, #aaa)",
            textAlign: "center", marginTop: 36, transition: "color 0.3s",
          }}>
            {saved ? "✓ " : ""}{tp.autoSaved}
          </p>
        )}
      </main>
    </div>
  );
}
