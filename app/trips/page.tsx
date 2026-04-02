"use client";

import { useState, useEffect, useCallback } from "react";
import type { BookingJob, BookingJobStep, DecisionLogEntry } from "@/lib/db";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

// ── Status helpers ─────────────────────────────────────────────────────────

const JOB_STATUS_COLOR: Record<BookingJob["status"], string> = {
  pending: "var(--text-muted, #aaa)",
  running: "var(--gold, #D4A34B)",
  done: "rgba(22,163,74,0.85)",
  failed: "rgba(220,38,38,0.8)",
};

const JOB_STATUS_LABEL: Record<BookingJob["status"], string> = {
  pending: "Queued",
  running: "Agent working…",
  done: "Done",
  failed: "Needs attention",
};

function stepStatusColor(step: BookingJobStep): string {
  if (step.status === "done") return step.timeAdjusted || step.usedFallback
    ? "rgba(234,88,12,0.85)"   // orange — succeeded via agent adjustment
    : "rgba(22,163,74,0.85)";  // green — succeeded first try
  if (step.actionItem) return "rgba(220,38,38,0.85)";
  if (step.status === "loading") return "var(--gold, #D4A34B)";
  if (step.status === "error" || step.status === "no_availability") return "rgba(220,38,38,0.75)";
  return "var(--text-muted, #aaa)";
}

function stepStatusIcon(step: BookingJobStep): string {
  if (step.status === "done") return step.timeAdjusted || step.usedFallback ? "↻" : "✓";
  if (step.status === "loading") return "…";
  if (step.actionItem) return "!";
  if (step.status === "error") return "✗";
  if (step.status === "no_availability") return "⚠";
  return "○";
}

function stepStatusLabel(step: BookingJobStep): string {
  if (step.status === "done") {
    if (step.timeAdjusted) return "Booked (time adjusted by agent)";
    if (step.usedFallback) return "Booked (alternative venue)";
    return "Pre-filled — ready to pay";
  }
  if (step.actionItem) return "Needs your choice";
  if (step.status === "loading") return "Agent working…";
  if (step.status === "no_availability") return "No availability";
  if (step.status === "error") return "Failed";
  return "Waiting";
}

// ── Decision log icon ──────────────────────────────────────────────────────

function logEntryIcon(type: DecisionLogEntry["type"]): string {
  switch (type) {
    case "succeeded": return "✓";
    case "skipped": return "⚠";
    case "time_adjusted": return "↻";
    case "venue_switched": return "→";
    case "retry": return "↺";
    case "failed": return "✗";
    default: return "·";
  }
}

function logEntryColor(type: DecisionLogEntry["type"]): string {
  switch (type) {
    case "succeeded": return "rgba(22,163,74,0.85)";
    case "skipped": return "rgba(234,88,12,0.8)";
    case "time_adjusted": return "rgba(234,88,12,0.8)";
    case "venue_switched": return "#6366f1";
    case "retry": return "var(--gold, #D4A34B)";
    case "failed": return "rgba(220,38,38,0.75)";
    default: return "var(--text-secondary, #666)";
  }
}

// ── What's next summary ────────────────────────────────────────────────────

function WhatsNext({ job }: { job: BookingJob }) {
  const readySteps = job.steps.filter((s) => s.status === "done");
  const actionSteps = job.steps.filter((s) => s.actionItem);
  const isRunning = job.status === "running" || job.status === "pending";

  if (isRunning) {
    return (
      <div style={{ padding: "14px 16px", borderTop: "0.5px solid var(--border, #e5e7eb)" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
          <span style={{ animation: "jobpulse 1.2s ease-in-out infinite", display: "inline-block", marginRight: 6 }}>⏳</span>
          Agent is working — you&apos;ll be notified when done.
        </p>
      </div>
    );
  }

  if (readySteps.length === 0 && actionSteps.length === 0) return null;

  return (
    <div
      style={{
        padding: "14px 16px",
        borderTop: "0.5px solid var(--border, #e5e7eb)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        What&apos;s next
      </p>
      {readySteps.length > 0 && (
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
          {readySteps.length === 1
            ? `Open the ${readySteps[0].label} booking page and pay.`
            : `Open the ${readySteps.length} ready booking pages and pay for each.`}
        </p>
      )}
      {actionSteps.length > 0 && (
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "rgba(220,38,38,0.85)", fontWeight: 500 }}>
          {actionSteps.length === 1
            ? `1 step needs your choice — the agent tried everything it could.`
            : `${actionSteps.length} steps need your manual decision.`}
        </p>
      )}
    </div>
  );
}

// ── Step card ──────────────────────────────────────────────────────────────

function StepCard({ step }: { step: BookingJobStep }) {
  const [logOpen, setLogOpen] = useState(false);
  const hasLog = (step.decisionLog?.length ?? 0) > 0;
  const isActive = step.status === "loading";
  const color = stepStatusColor(step);

  return (
    <div
      style={{
        borderRadius: 12,
        border: `0.5px solid ${step.actionItem ? "rgba(220,38,38,0.3)" : step.status === "done" ? "rgba(22,163,74,0.2)" : "var(--border, #e5e7eb)"}`,
        backgroundColor: step.actionItem
          ? "rgba(220,38,38,0.03)"
          : step.status === "done"
          ? "rgba(22,163,74,0.03)"
          : "var(--card-2, #f9f9f9)",
        overflow: "hidden",
      }}
    >
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
        {/* Status badge */}
        <div
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: color,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            marginTop: 1,
            animation: isActive ? "jobpulse 1.2s ease-in-out infinite" : "none",
          }}
        >
          {stepStatusIcon(step)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15 }}>{step.emoji}</span>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600 }}>
              {step.label}
            </p>
            {(step.timeAdjusted || step.usedFallback) && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-dm-sans)",
                  color: "rgba(234,88,12,0.9)",
                  backgroundColor: "rgba(234,88,12,0.08)",
                  border: "0.5px solid rgba(234,88,12,0.25)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontWeight: 500,
                }}
              >
                {step.timeAdjusted ? "time adjusted" : "alternative"}
              </span>
            )}
          </div>

          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color, marginTop: 2 }}>
            {stepStatusLabel(step)}
            {step.selected_time && ` · ${step.type === "flight" ? "Price:" : "Time:"} ${step.selected_time}`}
          </p>

          {/* Agent decision log toggle */}
          {hasLog && (
            <button
              onClick={() => setLogOpen((o) => !o)}
              style={{
                marginTop: 4,
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "var(--font-dm-sans)",
                fontSize: 11,
                color: "var(--text-muted, #aaa)",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {logOpen ? "Hide agent log ▲" : `Show agent log (${step.decisionLog!.length} actions) ▼`}
            </button>
          )}
        </div>

        {/* Open button for done steps */}
        {step.status === "done" && step.handoff_url && (
          <button
            onClick={() => window.open(step.handoff_url!, "_blank")}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 8,
              border: "none",
              background: "rgba(22,163,74,0.12)",
              color: "rgba(22,163,74,0.9)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Open →
          </button>
        )}
      </div>

      {/* Decision log */}
      {logOpen && step.decisionLog && (
        <div
          style={{
            borderTop: "0.5px solid var(--border, #e5e7eb)",
            padding: "10px 12px 10px 44px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>
            Agent decision log
          </p>
          {step.decisionLog.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span
                style={{
                  flexShrink: 0,
                  width: 16,
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 11,
                  color: logEntryColor(entry.type),
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {logEntryIcon(entry.type)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-primary, #111)" }}>
                  {entry.message}
                </p>
                {entry.outcome && (
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: logEntryColor(entry.type) }}>
                    {entry.outcome}
                  </p>
                )}
              </div>
              <span style={{ flexShrink: 0, fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)" }}>
                {formatTime(entry.ts)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action item banner */}
      {step.actionItem && (
        <div
          style={{
            borderTop: "0.5px solid rgba(220,38,38,0.2)",
            padding: "10px 12px",
            backgroundColor: "rgba(220,38,38,0.04)",
          }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 600, color: "rgba(185,28,28,0.9)", marginBottom: 8 }}>
            ⚠ {step.actionItem.message}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {step.actionItem.options.map((opt, j) => (
              <button
                key={j}
                onClick={() => window.open(opt.url, "_blank")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `0.5px solid ${j === 0 ? "rgba(220,38,38,0.4)" : "var(--border, #e5e7eb)"}`,
                  background: j === 0 ? "rgba(220,38,38,0.07)" : "transparent",
                  color: j === 0 ? "rgba(185,28,28,0.9)" : "var(--text-secondary, #666)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 12,
                  fontWeight: j === 0 ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  gap: 6,
                }}
              >
                <span>{j === 0 ? "→" : "↗"}</span>
                <span>Book manually: {opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Job card ───────────────────────────────────────────────────────────────

function JobCard({ job }: { job: BookingJob }) {
  const [expanded, setExpanded] = useState(job.status !== "pending");
  const doneCount = job.steps.filter((s) => s.status === "done").length;
  const actionCount = job.steps.filter((s) => s.actionItem).length;
  const isRunning = job.status === "running" || job.status === "pending";
  const adjustedCount = job.steps.filter((s) => s.timeAdjusted || s.usedFallback).length;

  function openAll() {
    for (const s of job.steps.filter((s) => s.handoff_url && s.status === "done")) {
      window.open(s.handoff_url!, "_blank");
    }
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: `0.5px solid ${
          actionCount > 0 ? "rgba(220,38,38,0.3)"
          : job.status === "done" ? "rgba(22,163,74,0.25)"
          : "var(--border, #e5e7eb)"
        }`,
        backgroundColor: "var(--card, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Job header */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Pulsing status dot */}
        <div
          style={{
            flexShrink: 0,
            width: 9,
            height: 9,
            borderRadius: "50%",
            backgroundColor: JOB_STATUS_COLOR[job.status],
            animation: isRunning ? "jobpulse 1.4s ease-in-out infinite" : "none",
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.trip_label}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: JOB_STATUS_COLOR[job.status], fontWeight: 500 }}>
              {JOB_STATUS_LABEL[job.status]}
            </span>
            {(job.status === "done" || job.status === "failed") && (
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)" }}>
                {doneCount}/{job.steps.length} ready
              </span>
            )}
            {adjustedCount > 0 && (
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(234,88,12,0.85)" }}>
                {adjustedCount} agent adjustment{adjustedCount > 1 ? "s" : ""}
              </span>
            )}
            {actionCount > 0 && (
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(220,38,38,0.85)", fontWeight: 600 }}>
                {actionCount} need{actionCount > 1 ? "" : "s"} your decision
              </span>
            )}
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
              {formatDate(job.created_at)}
            </span>
          </div>
        </div>

        {job.status === "done" && doneCount > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); openAll(); }}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "var(--gold, #D4A34B)",
              color: "#fff",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Open all →
          </button>
        )}

        <span style={{ color: "var(--text-muted, #aaa)", fontSize: 12, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Step cards */}
      {expanded && (
        <>
          <div
            style={{
              borderTop: "0.5px solid var(--border, #e5e7eb)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Tier: needs your decision */}
            {actionCount > 0 && (
              <>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "rgba(220,38,38,0.7)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Needs your decision
                </p>
                {job.steps.filter((s) => s.actionItem).map((step, i) => (
                  <StepCard key={`action-${i}`} step={step} />
                ))}
                <div style={{ height: 4 }} />
              </>
            )}

            {/* Tier: ready / running / pending */}
            {job.steps.filter((s) => !s.actionItem).length > 0 && (
              <>
                {actionCount > 0 && (
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Other steps
                  </p>
                )}
                {job.steps.filter((s) => !s.actionItem).map((step, i) => (
                  <StepCard key={`other-${i}`} step={step} />
                ))}
              </>
            )}
          </div>

          <WhatsNext job={job} />
        </>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [jobs, setJobs] = useState<BookingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    const sessionId = getSessionId();
    try {
      const res = await fetch(`/api/booking-jobs?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll while any job is running
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);

  const actionTotal = jobs.reduce((n, j) => n + j.steps.filter((s) => s.actionItem).length, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)", padding: "0 0 80px" }}>
      <style>{`
        @keyframes jobpulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--bg, #fafaf9)",
          borderBottom: "0.5px solid var(--border, #e5e7eb)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 17 }}>
              My Trips
            </p>
            {actionTotal > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: "rgba(220,38,38,0.85)",
                  borderRadius: 20,
                  padding: "2px 7px",
                }}
              >
                {actionTotal} action{actionTotal > 1 ? "s" : ""} needed
              </span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 2 }}>
            {loading ? "Loading…" : jobs.length === 0 ? "No trips yet" : `${jobs.length} trip${jobs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => window.history.back()}
          style={{
            background: "none",
            border: "0.5px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            padding: "6px 12px",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 12,
            color: "var(--text-secondary, #666)",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 620, margin: "0 auto" }}>
        {!loading && jobs.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              borderRadius: 16,
              border: "0.5px dashed var(--border, #e5e7eb)",
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>✈</p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              No trips yet
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
              When you click &ldquo;Book in background&rdquo; from a plan, your trip appears here.
            </p>
          </div>
        )}

        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
