"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BookingJob, BookingJobStep, DecisionLogEntry, AgentFeedbackStats } from "@/lib/db";
import type { PolicyBias } from "@/lib/policy";
import { AutonomySettingsModal } from "@/components/AutonomySettingsModal";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("session_id", id); }
  return id;
}

// ── Feedback helper ────────────────────────────────────────────────────────────

async function sendFeedback(payload: {
  job_id: string;
  step_index?: number;
  step_type?: string;
  agent_decision?: string;
  venue_name?: string;
  provider?: string;
  outcome: string;
  metadata?: Record<string, unknown>;
}) {
  const session_id = getSessionId();
  fetch("/api/booking-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, session_id }),
  }).catch(() => {});
}

function inferProvider(step: BookingJobStep): string {
  if (step.type === "flight") return "kayak";
  if (step.type === "hotel") return "booking_com";
  return "opentable";
}

function inferAgentDecision(step: BookingJobStep): string {
  if (step.timeAdjusted) return "time_adjusted";
  if (step.usedFallback) return "venue_switched";
  if (step.status === "done") return "primary";
  return "failed";
}

// ── Visual helpers ─────────────────────────────────────────────────────────────

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
  if (step.status === "done")
    return step.timeAdjusted || step.usedFallback ? "rgba(234,88,12,0.85)" : "rgba(22,163,74,0.85)";
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
    if (step.timeAdjusted) return "Booked (agent adjusted time)";
    if (step.usedFallback) return "Booked (alternative venue)";
    return "Pre-filled — ready to pay";
  }
  if (step.actionItem) return "Needs your choice";
  if (step.status === "loading") return "Agent working…";
  if (step.status === "no_availability") return "No availability found";
  if (step.status === "error") return "Failed";
  return "Waiting";
}

function logEntryIcon(type: DecisionLogEntry["type"]): string {
  switch (type) {
    case "succeeded": return "✓";
    case "skipped": return "—";
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
    case "time_adjusted": return "rgba(234,88,12,0.8)";
    case "venue_switched": return "#6366f1";
    case "retry": return "var(--gold, #D4A34B)";
    case "failed": case "skipped": return "rgba(220,38,38,0.65)";
    default: return "var(--text-secondary, #666)";
  }
}

// ── Satisfaction widget ────────────────────────────────────────────────────────

function SatisfactionWidget({ jobId }: { jobId: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function pick(outcome: "satisfied" | "ok" | "unsatisfied") {
    if (sent) return;
    setChosen(outcome);
    setSent(true);
    sendFeedback({
      job_id: jobId,
      step_index: -1,
      step_type: "job",
      agent_decision: "n/a",
      outcome,
    });
  }

  if (sent) {
    return (
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", textAlign: "center", padding: "10px 0" }}>
        Thanks — your feedback helps the agent improve ✓
      </p>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "0.5px solid var(--border, #e5e7eb)", justifyContent: "center" }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)", whiteSpace: "nowrap" }}>
        How did this go?
      </p>
      {[
        { outcome: "satisfied" as const, emoji: "😊", label: "Great" },
        { outcome: "ok" as const, emoji: "👍", label: "OK" },
        { outcome: "unsatisfied" as const, emoji: "😕", label: "Needed fixes" },
      ].map(({ outcome, emoji, label }) => (
        <button
          key={outcome}
          onClick={() => pick(outcome)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 8,
            border: chosen === outcome ? "0.5px solid var(--gold, #D4A34B)" : "0.5px solid var(--border, #e5e7eb)",
            background: chosen === outcome ? "rgba(212,163,75,0.08)" : "transparent",
            fontFamily: "var(--font-dm-sans)", fontSize: 12,
            color: "var(--text-secondary, #666)", cursor: "pointer",
          }}
        >
          <span>{emoji}</span><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── What's next ────────────────────────────────────────────────────────────────

function WhatsNext({ job }: { job: BookingJob }) {
  const ready = job.steps.filter((s) => s.status === "done");
  const action = job.steps.filter((s) => s.actionItem);
  const isRunning = job.status === "running" || job.status === "pending";

  if (isRunning) return (
    <div style={{ padding: "12px 14px", borderTop: "0.5px solid var(--border, #e5e7eb)" }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
        ⏳ Agent is working — you&apos;ll be notified when done.
      </p>
    </div>
  );

  if (ready.length === 0 && action.length === 0) return null;

  return (
    <div style={{ padding: "12px 14px", borderTop: "0.5px solid var(--border, #e5e7eb)", display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        What&apos;s next
      </p>
      {ready.length > 0 && (
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
          {ready.length === 1
            ? `Open the ${ready[0].label} booking page and pay.`
            : `Open the ${ready.length} ready booking pages and pay for each.`}
        </p>
      )}
      {action.length > 0 && (
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "rgba(220,38,38,0.85)", fontWeight: 500 }}>
          {action.length === 1
            ? "1 step needs your manual decision — agent tried all alternatives."
            : `${action.length} steps need your manual decision.`}
        </p>
      )}
    </div>
  );
}

// ── Step card ──────────────────────────────────────────────────────────────────

function StepCard({ step, stepIndex, jobId }: { step: BookingJobStep; stepIndex: number; jobId: string }) {
  const [logOpen, setLogOpen] = useState(false);
  const feedbackSent = useRef(false);
  const hasLog = (step.decisionLog?.length ?? 0) > 0;
  const color = stepStatusColor(step);

  function handleOpenAgentLink() {
    if (!feedbackSent.current && step.status === "done") {
      feedbackSent.current = true;
      sendFeedback({
        job_id: jobId,
        step_index: stepIndex,
        step_type: step.type,
        agent_decision: inferAgentDecision(step),
        venue_name: step.label,
        provider: inferProvider(step),
        outcome: "accepted",
        metadata: {
          timeAdjusted: step.timeAdjusted,
          usedFallback: step.usedFallback,
          selected_time: step.selected_time,
        },
      });
    }
    window.open(step.handoff_url!, "_blank");
  }

  function handleManualLink(optionLabel: string, url: string, optionIndex: number) {
    sendFeedback({
      job_id: jobId,
      step_index: stepIndex,
      step_type: step.type,
      agent_decision: "failed",
      venue_name: optionLabel,
      provider: inferProvider(step),
      outcome: "manual_override",
      metadata: { optionIndex, originalLabel: step.label },
    });
    window.open(url, "_blank");
  }

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${step.actionItem ? "rgba(220,38,38,0.3)" : step.status === "done" ? "rgba(22,163,74,0.2)" : "var(--border, #e5e7eb)"}`,
      backgroundColor: step.actionItem ? "rgba(220,38,38,0.03)" : step.status === "done" ? "rgba(22,163,74,0.03)" : "var(--card-2, #f9f9f9)",
      overflow: "hidden",
    }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
        {/* Status badge */}
        <div style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
          backgroundColor: color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, marginTop: 1,
          animation: step.status === "loading" ? "jobpulse 1.2s ease-in-out infinite" : "none",
        }}>
          {stepStatusIcon(step)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15 }}>{step.emoji}</span>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600 }}>
              {step.label}
            </p>
            {(step.timeAdjusted || step.usedFallback) && (
              <span style={{
                fontSize: 10, fontFamily: "var(--font-dm-sans)",
                color: "rgba(234,88,12,0.9)", backgroundColor: "rgba(234,88,12,0.08)",
                border: "0.5px solid rgba(234,88,12,0.25)",
                borderRadius: 4, padding: "1px 5px", fontWeight: 500,
              }}>
                {step.timeAdjusted ? "⏰ time adjusted" : "🔄 alternative"}
              </span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color, marginTop: 2 }}>
            {stepStatusLabel(step)}
            {step.selected_time && ` · ${step.type === "flight" ? "Price:" : "Time:"} ${step.selected_time}`}
          </p>
          {hasLog && (
            <button onClick={() => setLogOpen((o) => !o)} style={{
              marginTop: 4, background: "none", border: "none", padding: 0,
              fontFamily: "var(--font-dm-sans)", fontSize: 11,
              color: "var(--text-muted, #aaa)", cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}>
              {logOpen ? "Hide agent log ▲" : `View agent log (${step.decisionLog!.length} steps) ▼`}
            </button>
          )}
        </div>

        {step.status === "done" && step.handoff_url && (
          <button onClick={handleOpenAgentLink} style={{
            flexShrink: 0, padding: "5px 12px", borderRadius: 8,
            border: "none", background: "rgba(22,163,74,0.12)",
            color: "rgba(22,163,74,0.9)", fontFamily: "var(--font-dm-sans)",
            fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            Open →
          </button>
        )}
      </div>

      {/* Decision log */}
      {logOpen && step.decisionLog && (
        <div style={{
          borderTop: "0.5px solid var(--border, #e5e7eb)",
          padding: "10px 12px 10px 44px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>
            Agent decision log
          </p>
          {step.decisionLog.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 16, fontFamily: "var(--font-dm-sans)", fontSize: 11, color: logEntryColor(entry.type), fontWeight: 700, textAlign: "center" }}>
                {logEntryIcon(entry.type)}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-primary, #111)" }}>{entry.message}</p>
                {entry.outcome && <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: logEntryColor(entry.type) }}>{entry.outcome}</p>}
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
        <div style={{ borderTop: "0.5px solid rgba(220,38,38,0.2)", padding: "10px 12px", backgroundColor: "rgba(220,38,38,0.04)" }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 600, color: "rgba(185,28,28,0.9)", marginBottom: 8 }}>
            ⚠ {step.actionItem.message}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {step.actionItem.options.map((opt, j) => (
              <button key={j} onClick={() => handleManualLink(opt.label, opt.url, j)} style={{
                padding: "8px 12px", borderRadius: 8,
                border: `0.5px solid ${j === 0 ? "rgba(220,38,38,0.4)" : "var(--border, #e5e7eb)"}`,
                background: j === 0 ? "rgba(220,38,38,0.07)" : "transparent",
                color: j === 0 ? "rgba(185,28,28,0.9)" : "var(--text-secondary, #666)",
                fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: j === 0 ? 600 : 400,
                cursor: "pointer", textAlign: "left", display: "flex", gap: 6,
              }}>
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

// ── Job card ───────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: BookingJob }) {
  const [expanded, setExpanded] = useState(job.status !== "pending");
  const doneCount = job.steps.filter((s) => s.status === "done").length;
  const actionCount = job.steps.filter((s) => s.actionItem).length;
  const adjustedCount = job.steps.filter((s) => s.timeAdjusted || s.usedFallback).length;
  const isRunning = job.status === "running" || job.status === "pending";
  const isComplete = job.status === "done" || job.status === "failed";

  function openAll() {
    for (const s of job.steps.filter((s) => s.status === "done" && s.handoff_url)) {
      window.open(s.handoff_url!, "_blank");
    }
  }

  return (
    <div style={{
      borderRadius: 16,
      border: `0.5px solid ${actionCount > 0 ? "rgba(220,38,38,0.3)" : job.status === "done" ? "rgba(22,163,74,0.25)" : "var(--border, #e5e7eb)"}`,
      backgroundColor: "var(--card, #fff)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div onClick={() => setExpanded((e) => !e)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flexShrink: 0, width: 9, height: 9, borderRadius: "50%", backgroundColor: JOB_STATUS_COLOR[job.status], animation: isRunning ? "jobpulse 1.4s ease-in-out infinite" : "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.trip_label}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: JOB_STATUS_COLOR[job.status], fontWeight: 500 }}>
              {JOB_STATUS_LABEL[job.status]}
            </span>
            {isComplete && (
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
                {actionCount} need{actionCount > 1 ? "" : "s"} decision
              </span>
            )}
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
              {formatDate(job.created_at)}
            </span>
          </div>
        </div>
        {job.status === "done" && doneCount > 0 && (
          <button onClick={(e) => { e.stopPropagation(); openAll(); }} style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: 10,
            border: "none", backgroundColor: "var(--gold, #D4A34B)",
            color: "#fff", fontFamily: "var(--font-dm-sans)", fontSize: 12,
            fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            Open all →
          </button>
        )}
        <span style={{ color: "var(--text-muted, #aaa)", fontSize: 12, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <>
          <div style={{ borderTop: "0.5px solid var(--border, #e5e7eb)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Tier: needs decision (floated to top) */}
            {actionCount > 0 && (
              <>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "rgba(220,38,38,0.7)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Needs your decision
                </p>
                {job.steps.filter((s) => s.actionItem).map((step, i) => (
                  <StepCard key={`a-${i}`} step={step} stepIndex={job.steps.indexOf(step)} jobId={job.id} />
                ))}
                <div style={{ height: 2 }} />
              </>
            )}
            {/* Other steps */}
            {actionCount > 0 && (
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Other steps
              </p>
            )}
            {job.steps.filter((s) => !s.actionItem).map((step, i) => (
              <StepCard key={`s-${i}`} step={step} stepIndex={job.steps.indexOf(step)} jobId={job.id} />
            ))}
          </div>

          <WhatsNext job={job} />

          {/* Satisfaction widget for completed jobs */}
          {isComplete && <SatisfactionWidget jobId={job.id} />}
        </>
      )}
    </div>
  );
}

// ── Agent Insights panel ───────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  opentable: "OpenTable",
  booking_com: "Booking.com",
  kayak: "Kayak",
  expedia: "Expedia",
};

const DECISION_LABELS: Record<string, string> = {
  primary: "First-try success",
  time_adjusted: "Time slot adjusted",
  venue_switched: "Venue switched",
  failed: "Fully failed",
};

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, borderRadius: 2, backgroundColor: "var(--border, #e5e7eb)", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, backgroundColor: color, borderRadius: 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

function InsightsPanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<AgentFeedbackStats | null>(null);
  const [policy, setPolicy] = useState<PolicyBias | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || stats) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/booking-feedback?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
      fetch(`/api/policy?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.json()),
    ])
      .then(([feedbackData, policyData]) => {
        setStats(feedbackData.stats ?? null);
        setPolicy(policyData.bias ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, sessionId, stats]);

  if (!stats && !open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: "100%", padding: "10px", borderRadius: 12,
        border: "0.5px dashed var(--border, #e5e7eb)", background: "transparent",
        fontFamily: "var(--font-dm-sans)", fontSize: 12,
        color: "var(--text-muted, #aaa)", cursor: "pointer",
      }}>
        📊 View Agent Insights
      </button>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)", overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", padding: "14px 16px", background: "none", border: "none",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 13 }}>Agent Insights</p>
          {stats && (
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)" }}>
              {stats.totalEvents} feedback events
            </span>
          )}
        </div>
        <span style={{ color: "var(--text-muted, #aaa)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ borderTop: "0.5px solid var(--border, #e5e7eb)", padding: "14px 16px" }}>
          {loading && <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-muted, #aaa)", textAlign: "center" }}>Loading…</p>}

          {stats && stats.totalEvents === 0 && (
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", textAlign: "center" }}>
              No data yet — insights appear after you complete trips and give feedback.
            </p>
          )}

          {stats && stats.totalEvents > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Acceptance rate */}
              <div>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                  Did you accept the agent&apos;s decisions?
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ProgressBar value={stats.adjustmentAcceptanceRate} color="rgba(22,163,74,0.7)" />
                  <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 700, color: "rgba(22,163,74,0.85)", flexShrink: 0 }}>
                    {Math.round(stats.adjustmentAcceptanceRate * 100)}%
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(22,163,74,0.8)" }}>
                    ✓ {stats.outcomeBreakdown.accepted} accepted
                  </span>
                  <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(220,38,38,0.75)" }}>
                    ↗ {stats.outcomeBreakdown.manual_override} manual override
                  </span>
                </div>
              </div>

              {/* Satisfaction */}
              {(stats.outcomeBreakdown.satisfied + stats.outcomeBreakdown.ok + stats.outcomeBreakdown.unsatisfied) > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    Satisfaction
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[
                      { emoji: "😊", label: "Great", count: stats.outcomeBreakdown.satisfied },
                      { emoji: "👍", label: "OK", count: stats.outcomeBreakdown.ok },
                      { emoji: "😕", label: "Needed fixes", count: stats.outcomeBreakdown.unsatisfied },
                    ].map(({ emoji, label, count }) => (
                      <div key={label} style={{ textAlign: "center", flex: 1 }}>
                        <p style={{ fontSize: 20, marginBottom: 2 }}>{emoji}</p>
                        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 700 }}>{count}</p>
                        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider success rates */}
              {stats.providerStats.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                    Provider acceptance rates
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stats.providerStats.map((p) => (
                      <div key={p.provider} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", width: 100, flexShrink: 0 }}>
                          {PROVIDER_NAMES[p.provider] ?? p.provider}
                        </span>
                        <ProgressBar value={p.rate} color={p.rate > 0.7 ? "rgba(22,163,74,0.7)" : p.rate > 0.4 ? "var(--gold, #D4A34B)" : "rgba(220,38,38,0.65)"} />
                        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 600, flexShrink: 0, minWidth: 36 }}>
                          {Math.round(p.rate * 100)}%
                        </span>
                        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)", flexShrink: 0 }}>
                          ({p.total})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step type manual rate */}
              {stats.manualByType.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                    Which tasks need most manual help?
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stats.manualByType.map((t) => {
                      const manualRate = t.total > 0 ? t.manual / t.total : 0;
                      return (
                        <div key={t.step_type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", width: 80, flexShrink: 0, textTransform: "capitalize" }}>
                            {t.step_type}
                          </span>
                          <ProgressBar value={manualRate} color="rgba(220,38,38,0.5)" />
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, flexShrink: 0 }}>
                            {t.manual}/{t.total} manual
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Agent decision type usage */}
              {stats.decisionTypeUsage.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    How the agent solved bookings
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stats.decisionTypeUsage.map((d) => (
                      <div key={d.agent_decision} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
                          {DECISION_LABELS[d.agent_decision] ?? d.agent_decision}
                        </span>
                        <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 600 }}>{d.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top overridden venues */}
              {stats.topOverriddenVenues.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--text-muted, #aaa)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    Venues you most often booked differently
                  </p>
                  {stats.topOverriddenVenues.map((v) => (
                    <div key={v.venue_name} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>{v.venue_name}</span>
                      <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "rgba(220,38,38,0.75)", fontWeight: 600 }}>{v.overrides}× overridden</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── What the agent has learned (policy) ── */}
              {policy && policy.hasEnoughData && (
                <div style={{ borderTop: "0.5px solid var(--border, #e5e7eb)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700, color: "var(--gold, #D4A34B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    What the agent has learned
                  </p>

                  {/* Personal tolerance */}
                  {policy.personalTolerance && (
                    <div>
                      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #666)", marginBottom: 6 }}>Your behavior profile</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {[
                          {
                            label: "Time adjustment tolerance",
                            tolerance: policy.personalTolerance.timeAdjust,
                            rate: policy.personalTolerance.timeAdjustRate,
                            count: policy.personalTolerance.timeAdjustCount,
                          },
                          {
                            label: "Venue switch tolerance",
                            tolerance: policy.personalTolerance.venueSwitch,
                            rate: policy.personalTolerance.venueSwitchRate,
                            count: policy.personalTolerance.venueSwitchCount,
                          },
                        ].map(({ label, tolerance, rate, count }) => (
                          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>{label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)" }}>{count > 0 ? `${Math.round(rate * 100)}%` : ""}</span>
                              <span style={{
                                fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600,
                                color: tolerance === "liberal" ? "rgba(22,163,74,0.85)" : tolerance === "strict" ? "rgba(220,38,38,0.75)" : "var(--gold, #D4A34B)",
                                background: tolerance === "liberal" ? "rgba(22,163,74,0.08)" : tolerance === "strict" ? "rgba(220,38,38,0.08)" : "rgba(212,163,75,0.1)",
                                borderRadius: 6, padding: "2px 6px",
                              }}>
                                {tolerance}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Provider preference order */}
                  {policy.providerRanking.length > 0 && (
                    <div>
                      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #666)", marginBottom: 6 }}>Provider preference order</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {policy.providerRanking.map((p) => (
                          <div key={p.provider} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)", width: 16, textAlign: "right", flexShrink: 0 }}>
                              #{p.preferenceRank}
                            </span>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", flex: 1 }}>
                              {PROVIDER_NAMES[p.provider] ?? p.provider}
                            </span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans)", fontSize: 11,
                              color: p.score > 0 ? "rgba(22,163,74,0.85)" : p.score < 0 ? "rgba(220,38,38,0.75)" : "var(--text-muted, #aaa)",
                              fontWeight: 600,
                            }}>
                              {p.score > 0 ? "+" : ""}{p.score.toFixed(1)}
                            </span>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "var(--text-muted, #aaa)" }}>
                              ({p.eventCount})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trusted venues */}
                  {policy.topVenues.length > 0 && (
                    <div>
                      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #666)", marginBottom: 6 }}>Venues agent tries first</p>
                      {policy.topVenues.map((v) => (
                        <div key={v.venueName} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>{v.venueName}</span>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(22,163,74,0.85)", fontWeight: 600 }}>
                            +{v.score.toFixed(1)} trusted
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flagged venues */}
                  {policy.flaggedVenues.length > 0 && (
                    <div>
                      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-secondary, #666)", marginBottom: 6 }}>Venues deprioritized by agent</p>
                      {policy.flaggedVenues.map((v) => (
                        <div key={v.venueName} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>{v.venueName}</span>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(220,38,38,0.75)", fontWeight: 600 }}>
                            {v.score.toFixed(1)} often overridden
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [jobs, setJobs] = useState<BookingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [autonomyOpen, setAutonomyOpen] = useState(false);
  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const loadJobs = useCallback(async () => {
    const sid = getSessionId();
    try {
      const res = await fetch(`/api/booking-jobs?session_id=${encodeURIComponent(sid)}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

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
      <div style={{
        position: "sticky", top: 0, backgroundColor: "var(--bg, #fafaf9)",
        borderBottom: "0.5px solid var(--border, #e5e7eb)",
        padding: "16px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", zIndex: 10,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 17 }}>My Trips</p>
            {actionTotal > 0 && (
              <span style={{
                fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 700,
                color: "#fff", backgroundColor: "rgba(220,38,38,0.85)",
                borderRadius: 20, padding: "2px 7px",
              }}>
                {actionTotal} action{actionTotal > 1 ? "s" : ""} needed
              </span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 2 }}>
            {loading ? "Loading…" : jobs.length === 0 ? "No trips yet" : `${jobs.length} trip${jobs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setAutonomyOpen(true)} style={{
            background: "none", border: "0.5px solid var(--border, #e5e7eb)",
            borderRadius: 8, padding: "6px 12px", fontFamily: "var(--font-dm-sans)",
            fontSize: 12, color: "var(--text-secondary, #666)", cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            ⚙ Permissions
          </button>
          <button onClick={() => window.history.back()} style={{
            background: "none", border: "0.5px solid var(--border, #e5e7eb)",
            borderRadius: 8, padding: "6px 12px", fontFamily: "var(--font-dm-sans)",
            fontSize: 12, color: "var(--text-secondary, #666)", cursor: "pointer",
          }}>
            ← Back
          </button>
        </div>
      </div>
      <AutonomySettingsModal open={autonomyOpen} onClose={() => setAutonomyOpen(false)} />

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 620, margin: "0 auto" }}>
        {!loading && jobs.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 16, border: "0.5px dashed var(--border, #e5e7eb)" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>✈</p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>No trips yet</p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
              When you click &ldquo;Book in background&rdquo; from a plan, your trip appears here.
            </p>
          </div>
        )}

        {jobs.map((job) => <JobCard key={job.id} job={job} />)}

        {/* Agent Insights — always show at the bottom */}
        {!loading && sessionId && (
          <InsightsPanel sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}

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
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
