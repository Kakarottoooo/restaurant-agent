"use client";

import { useState, useEffect, useCallback } from "react";
import type { BookingJob, BookingJobStep } from "@/lib/db";

// Session ID — mirrors what the main app uses
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

const STATUS_LABEL: Record<BookingJob["status"], string> = {
  pending: "Queued",
  running: "Booking…",
  done: "Ready",
  failed: "Needs attention",
};

const STATUS_COLOR: Record<BookingJob["status"], string> = {
  pending: "var(--text-muted, #aaa)",
  running: "var(--gold, #D4A34B)",
  done: "rgba(22,163,74,0.85)",
  failed: "rgba(220,38,38,0.8)",
};

const STEP_STATUS_ICON: Record<BookingJobStep["status"], string> = {
  pending: "○",
  loading: "⟳",
  done: "✓",
  error: "✗",
  no_availability: "⚠",
};

export default function TripsPage() {
  const [jobs, setJobs] = useState<BookingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll running jobs every 3 seconds
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);

  function openAllTabs(job: BookingJob) {
    const urls = job.steps
      .filter((s) => s.handoff_url)
      .map((s) => s.handoff_url!);
    for (const url of urls) window.open(url, "_blank");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg, #fafaf9)",
        padding: "0 0 80px",
      }}
    >
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
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 17 }}>
            My Trips
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 2 }}>
            {jobs.length === 0 ? "No trips yet" : `${jobs.length} trip${jobs.length === 1 ? "" : "s"}`}
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

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 600, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "var(--font-dm-sans)", color: "var(--text-muted, #aaa)", fontSize: 13 }}>
            Loading…
          </div>
        )}

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
              When you click &ldquo;Book in background&rdquo; from a plan, your trip will appear here.
            </p>
          </div>
        )}

        {jobs.map((job) => {
          const isExpanded = expanded === job.id;
          const doneSteps = job.steps.filter((s) => s.status === "done");
          const isRunning = job.status === "running" || job.status === "pending";

          return (
            <div
              key={job.id}
              style={{
                borderRadius: 16,
                border: job.status === "done"
                  ? "0.5px solid rgba(212,163,75,0.4)"
                  : "0.5px solid var(--border, #e5e7eb)",
                backgroundColor: job.status === "done"
                  ? "rgba(212,163,75,0.04)"
                  : "var(--card, #fff)",
                overflow: "hidden",
              }}
            >
              {/* Job header */}
              <div
                onClick={() => setExpanded(isExpanded ? null : job.id)}
                style={{
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* Status dot / spinner */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: STATUS_COLOR[job.status],
                    flexShrink: 0,
                    animation: isRunning ? "jobpulse 1.4s ease-in-out infinite" : "none",
                  }}
                />
                <style>{`
                  @keyframes jobpulse {
                    0%, 100% { opacity: 0.4; transform: scale(0.85); }
                    50% { opacity: 1; transform: scale(1.15); }
                  }
                `}</style>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.trip_label}
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)" }}>
                    {STATUS_LABEL[job.status]}
                    {(job.status === "done" || job.status === "failed") && ` · ${doneSteps.length}/${job.steps.length} ready`}
                    {job.steps.some((s) => s.actionItem) && ` · ${job.steps.filter((s) => s.actionItem).length} need${job.steps.filter((s) => s.actionItem).length === 1 ? "s" : ""} attention`}
                    {" · "}
                    {formatDate(job.created_at)}
                  </p>
                </div>

                {job.status === "done" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openAllTabs(job); }}
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
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>

              {/* Expanded steps */}
              {isExpanded && (
                <div
                  style={{
                    borderTop: "0.5px solid var(--border, #e5e7eb)",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {job.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Step row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 10,
                          backgroundColor: step.status === "done"
                            ? "rgba(212,163,75,0.06)"
                            : step.actionItem
                            ? "rgba(234,88,12,0.04)"
                            : "var(--card-2, #f9f9f9)",
                          border: step.status === "done"
                            ? "0.5px solid rgba(212,163,75,0.25)"
                            : step.actionItem
                            ? "0.5px solid rgba(234,88,12,0.3)"
                            : "0.5px solid transparent",
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 13,
                            color: step.status === "done"
                              ? "var(--gold, #D4A34B)"
                              : step.actionItem ? "rgba(234,88,12,0.9)"
                              : step.status === "error" ? "rgba(220,38,38,0.8)"
                              : "var(--text-muted, #aaa)",
                            animation: step.status === "loading" ? "jobpulse 1s ease-in-out infinite" : "none",
                          }}
                        >
                          {STEP_STATUS_ICON[step.status]}
                        </span>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{step.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {step.label}
                            {step.usedFallback && (
                              <span style={{ fontSize: 10, color: "var(--text-secondary, #666)", fontWeight: 400, marginLeft: 6 }}>
                                (alternative)
                              </span>
                            )}
                          </p>
                          {step.selected_time && (
                            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary, #666)" }}>
                              {step.type === "flight" ? "Price: " : "Time: "}{step.selected_time}
                            </p>
                          )}
                          {step.error && step.status !== "done" && !step.actionItem && (
                            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "rgba(220,38,38,0.8)" }}>
                              {step.error}
                            </p>
                          )}
                        </div>
                        {step.handoff_url && step.status === "done" && (
                          <button
                            onClick={() => window.open(step.handoff_url!, "_blank")}
                            style={{
                              flexShrink: 0,
                              padding: "4px 10px",
                              borderRadius: 8,
                              border: "0.5px solid var(--border, #e5e7eb)",
                              background: "transparent",
                              color: "var(--text-secondary, #666)",
                              fontFamily: "var(--font-dm-sans)",
                              fontSize: 11,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Open →
                          </button>
                        )}
                      </div>

                      {/* Action item banner — shown when autopilot failed and manual booking needed */}
                      {step.actionItem && (
                        <div
                          style={{
                            borderRadius: 10,
                            border: "0.5px solid rgba(234,88,12,0.35)",
                            backgroundColor: "rgba(234,88,12,0.06)",
                            padding: "10px 12px",
                            marginLeft: 8,
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "var(--font-dm-sans)",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "rgba(194,65,12,0.95)",
                              marginBottom: 8,
                            }}
                          >
                            ⚠ {step.actionItem.message}
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {step.actionItem.options.map((opt, j) => (
                              <button
                                key={j}
                                onClick={() => window.open(opt.url, "_blank")}
                                style={{
                                  padding: "7px 12px",
                                  borderRadius: 8,
                                  border: "0.5px solid rgba(234,88,12,0.4)",
                                  background: j === 0 ? "rgba(234,88,12,0.1)" : "transparent",
                                  color: "rgba(194,65,12,0.95)",
                                  fontFamily: "var(--font-dm-sans)",
                                  fontSize: 12,
                                  fontWeight: j === 0 ? 600 : 400,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  display: "flex",
                                  alignItems: "center",
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
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
