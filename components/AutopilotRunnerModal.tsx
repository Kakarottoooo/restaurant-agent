"use client";

import { useState, useEffect } from "react";
import type { AutopilotResult } from "../lib/booking-autopilot/types";
import { ConnectAccountsModal } from "./ConnectAccountsModal";
import { AutonomySettingsModal } from "./AutonomySettingsModal";
import { loadAutonomySettings } from "@/lib/autonomy";

export interface BookableFallbackCandidate {
  label: string;
  body: Record<string, unknown>;
  fallbackUrl: string;
}

export interface BookableStep {
  type: "flight" | "hotel" | "restaurant";
  emoji: string;
  label: string;
  apiEndpoint: string;
  body: Record<string, unknown>;
  fallbackUrl: string;
  /** Backup alternatives tried by the recovery engine if the primary fails */
  fallbackCandidates?: BookableFallbackCandidate[];
  /**
   * For restaurants: adjacent time slots the agent will try automatically
   * before giving up (e.g. ["19:30", "18:30", "20:00"]).
   */
  timeFallbacks?: string[];
}

type StepStatus = "pending" | "loading" | "done" | "error" | "no_availability";

interface StepState {
  status: StepStatus;
  result?: AutopilotResult;
}

interface Props {
  open: boolean;
  steps: BookableStep[];
  tripLabel?: string;
  onClose: () => void;
}

export function AutopilotRunnerModal({ open, steps, tripLabel, onClose }: Props) {
  const [stepStates, setStepStates] = useState<StepState[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [autonomyOpen, setAutonomyOpen] = useState(false);
  const [bgJobId, setBgJobId] = useState<string | null>(null);
  const [bgSent, setBgSent] = useState(false);

  // Send job to background (server-side execution)
  async function sendToBackground() {
    const sessionId = localStorage.getItem("session_id") ?? crypto.randomUUID();
    const autonomySettings = loadAutonomySettings();
    // Create the job — include autonomy settings so the worker knows the boundaries
    const res = await fetch("/api/booking-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        trip_label: tripLabel ?? "My Trip",
        steps,
        autonomy_settings: autonomySettings,
      }),
    });
    const data = await res.json();
    const jobId: string = data.jobId;
    setBgJobId(jobId);
    setBgSent(true);

    // Fire-and-forget the start endpoint — keepalive keeps it alive if page closes
    fetch(`/api/booking-jobs/${jobId}/start`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }

  // Reset and start when opened
  useEffect(() => {
    if (!open || steps.length === 0) return;
    setBgSent(false);
    setBgJobId(null);
    const initial = steps.map<StepState>((_, i) =>
      i === 0 ? { status: "loading" } : { status: "pending" }
    );
    setStepStates(initial);
    setAllDone(false);

    let cancelled = false;
    async function runAll() {
      const states: StepState[] = steps.map<StepState>((_, i) =>
        i === 0 ? { status: "loading" } : { status: "pending" }
      );

      for (let i = 0; i < steps.length; i++) {
        if (cancelled) break;
        // Mark current as loading
        states[i] = { status: "loading" };
        if (!cancelled) setStepStates([...states]);

        const step = steps[i];
        try {
          const res = await fetch(step.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(step.body),
          });
          const data: AutopilotResult = await res.json();
          states[i] = {
            status: data.status === "ready" ? "done" : data.status === "no_availability" ? "no_availability" : "error",
            result: data,
          };
        } catch {
          states[i] = {
            status: "error",
            result: { status: "error", handoff_url: step.fallbackUrl, error: "Network error" },
          };
        }

        if (!cancelled) setStepStates([...states]);

        // Mark next as loading
        if (i + 1 < steps.length) {
          states[i + 1] = { status: "loading" };
          if (!cancelled) setStepStates([...states]);
        }
      }

      if (!cancelled) setAllDone(true);
    }

    runAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const completedSteps = stepStates.filter((s) => s.status === "done" || s.status === "no_availability");
  const doneWithUrls = stepStates
    .map((s, i) => ({ step: steps[i], state: s }))
    .filter((x) => x.state.result?.handoff_url);

  function openAllTabs() {
    for (const { state } of doneWithUrls) {
      if (state.result?.handoff_url) {
        window.open(state.result.handoff_url, "_blank");
      }
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--card, #fff)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          border: "0.5px solid var(--border, #e5e7eb)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "0.5px solid var(--border, #e5e7eb)",
          }}
        >
          <span style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 15 }}>
            {allDone ? "Your trip is ready to book" : "Booking your trip…"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setAutonomyOpen(true)}
              title="Agent permissions"
              style={{
                background: "none",
                border: "0.5px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                padding: "4px 10px",
                fontFamily: "var(--font-dm-sans)",
                fontSize: 11,
                color: "var(--text-secondary, #666)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ⚙ Permissions
            </button>
            <button
              onClick={() => setConnectOpen(true)}
              style={{
                background: "none",
                border: "0.5px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                padding: "4px 10px",
                fontFamily: "var(--font-dm-sans)",
                fontSize: 11,
                color: "var(--text-secondary, #666)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              🔑 Accounts
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted, #888)", lineHeight: 1, padding: "0 4px" }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Nested modals */}
        <ConnectAccountsModal open={connectOpen} onClose={() => setConnectOpen(false)} />
        <AutonomySettingsModal open={autonomyOpen} onClose={() => setAutonomyOpen(false)} />

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* Background booking sent */}
          {bgSent && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: "rgba(212,163,75,0.07)",
                  border: "0.5px solid rgba(212,163,75,0.3)",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 22, marginBottom: 8 }}>✈</p>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                  Booking in progress
                </p>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", lineHeight: 1.6 }}>
                  Running in the background — you&apos;ll get a push notification when ready.
                  You can close this window.
                </p>
              </div>
              <button
                onClick={() => { window.location.href = "/trips"; }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "var(--gold, #D4A34B)",
                  color: "#fff",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View My Trips →
              </button>
              <button
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: "0.5px solid var(--border, #e5e7eb)",
                  background: "transparent",
                  color: "var(--text-secondary, #666)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)", textAlign: "center" }}>
                Job ID: {bgJobId}
              </p>
            </div>
          )}

          {/* Normal sync mode */}
          {!bgSent && (
          <>
          {/* "Book in background" option — shown while steps are still running */}
          {!allDone && stepStates.some((s) => s.status === "loading" || s.status === "pending") && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                border: "0.5px dashed var(--border, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
                Don&apos;t want to wait?
              </p>
              <button
                onClick={sendToBackground}
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "0.5px solid var(--gold, #D4A34B)",
                  background: "transparent",
                  color: "var(--gold, #D4A34B)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Book in background →
              </button>
            </div>
          )}
          {/* Step list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: allDone ? 20 : 0 }}>
            {steps.map((step, i) => {
              const state = stepStates[i];
              const status = state?.status ?? "pending";

              return (
                <div
                  key={i}
                  style={{
                    borderRadius: 12,
                    border: `0.5px solid ${
                      status === "done" ? "rgba(212,163,75,0.35)" :
                      status === "no_availability" ? "rgba(251,191,36,0.4)" :
                      status === "error" ? "rgba(239,68,68,0.3)" :
                      "var(--border, #e5e7eb)"
                    }`,
                    backgroundColor: status === "done"
                      ? "rgba(212,163,75,0.06)"
                      : "var(--card-2, #f9f9f9)",
                    padding: "12px 14px",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  {/* Step icon */}
                  <div style={{ flexShrink: 0, width: 28, textAlign: "center", marginTop: 1 }}>
                    {status === "loading" ? (
                      <SpinnerIcon />
                    ) : status === "done" ? (
                      <span style={{ color: "var(--gold, #D4A34B)", fontSize: 16 }}>✓</span>
                    ) : status === "no_availability" ? (
                      <span style={{ fontSize: 16 }}>⚠️</span>
                    ) : status === "error" ? (
                      <span style={{ fontSize: 16 }}>✗</span>
                    ) : (
                      <span style={{ color: "var(--text-muted, #aaa)", fontSize: 14 }}>{step.emoji}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: status === "pending" ? "var(--text-muted, #aaa)" : "var(--text-primary, #111)",
                        marginBottom: 2,
                      }}
                    >
                      {step.emoji} {step.label}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: 12,
                        color: "var(--text-secondary, #666)",
                      }}
                    >
                      {status === "loading" && (
                        step.type === "flight"
                          ? "Finding cheapest non-stop flight on Kayak…"
                          : step.type === "hotel"
                          ? "Navigating to hotel page on Booking.com…"
                          : "Finding your table on OpenTable…"
                      )}
                      {status === "done" && (
                        state.result?.selected_time
                          ? `Ready · ${step.type === "flight" ? "Price: " : "Time: "}${state.result.selected_time}`
                          : "Pre-filled and ready to confirm"
                      )}
                      {status === "no_availability" && (
                        state.result?.error ?? "No availability — search page ready"
                      )}
                      {status === "error" && (
                        state.result?.error ?? "Couldn't complete — fallback link ready"
                      )}
                      {status === "pending" && "Waiting…"}
                    </p>

                    {/* Screenshot thumbnail */}
                    {(status === "done" || status === "no_availability") && state.result?.screenshot_base64 && (
                      <div
                        style={{
                          marginTop: 8,
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "0.5px solid var(--border, #e5e7eb)",
                          maxHeight: 140,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={state.result.screenshot_base64}
                          alt={`${step.label} booking page`}
                          style={{ width: "100%", display: "block" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final CTA */}
          {allDone && doneWithUrls.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={openAllTabs}
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: "var(--gold, #D4A34B)",
                  color: "#fff",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open all booking tabs →
              </button>

              {/* Individual links */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {doneWithUrls.map(({ step, state }, i) => (
                  <button
                    key={i}
                    onClick={() => window.open(state.result!.handoff_url, "_blank")}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: 10,
                      border: "0.5px solid var(--border, #e5e7eb)",
                      backgroundColor: "transparent",
                      color: "var(--text-secondary, #666)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{step.emoji}</span>
                    <span>Open {step.label} →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allDone && completedSteps.length === 0 && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)" }}>
                Autopilot couldn&apos;t complete any steps. Try booking manually.
              </p>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", justifyContent: "center", height: 18 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--gold, #D4A34B)",
            animation: `apulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes apulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
