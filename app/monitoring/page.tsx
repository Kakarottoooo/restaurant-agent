"use client";

/**
 * /monitoring — Active monitoring center
 *
 * Shows all BookingMonitors for the current session:
 *   availability_watch  — waiting for a slot to open
 *   reservation_check   — watching for cancellations
 *   weather_alert       — watching destination weather
 *
 * Grouped by job. Each monitor shows status, last check, trigger alert.
 */

import { useState, useEffect, useCallback } from "react";
import GlobalNav from "@/components/GlobalNav";
import type { BookingMonitor } from "@/lib/monitors";

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("session_id", id); }
  return id;
}

// ── Type meta ──────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { emoji: string; label: string; desc: string }> = {
  availability_watch: { emoji: "🔍", label: "Availability watch", desc: "Watching for slot to open" },
  reservation_check:  { emoji: "🔗", label: "Reservation check",  desc: "Watching for cancellation" },
  weather_alert:      { emoji: "🌦",  label: "Weather alert",      desc: "Monitoring destination weather" },
};

const STATUS_META: Record<string, { color: string; dot: string; label: string }> = {
  active:    { color: "var(--gold, #C9A84C)",     dot: "#C9A84C", label: "Active" },
  triggered: { color: "#ef4444",                  dot: "#ef4444", label: "Alert triggered" },
  paused:    { color: "var(--text-muted, #aaa)",  dot: "#aaa",    label: "Paused" },
  cancelled: { color: "var(--text-muted, #aaa)",  dot: "#666",    label: "Cancelled" },
  resolved:  { color: "#22c55e",                  dot: "#22c55e", label: "Resolved" },
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Monitor card ───────────────────────────────────────────────────────────

function MonitorCard({ monitor, onCancel }: { monitor: BookingMonitor; onCancel: (id: string) => void }) {
  const type   = TYPE_META[monitor.type] ?? TYPE_META.availability_watch;
  const status = STATUS_META[monitor.status] ?? STATUS_META.active;
  const isLive = monitor.status === "active";
  const isAlert = monitor.status === "triggered";

  return (
    <div style={{
      borderRadius: 14,
      border: `0.5px solid ${isAlert ? "rgba(239,68,68,0.4)" : isLive ? "rgba(201,168,76,0.25)" : "var(--border, #e5e7eb)"}`,
      backgroundColor: isAlert ? "rgba(239,68,68,0.04)" : "var(--card, #fff)",
      padding: "14px 16px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{type.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 13,
              color: "var(--text-primary, #111)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {monitor.step_emoji} {monitor.step_label}
            </p>
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600, color: status.color, flexShrink: 0,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", backgroundColor: status.dot, flexShrink: 0,
                ...(isLive ? { animation: "navpulse 2s ease-in-out infinite" } : {}),
              }} />
              {status.label}
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
            {type.desc}
          </p>
        </div>
      </div>

      {/* Trigger alert */}
      {isAlert && monitor.trigger_message && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 10,
          backgroundColor: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)",
        }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
            fontWeight: 600, color: "#ef4444", marginBottom: 2 }}>⚠ Alert</p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
            {monitor.trigger_message}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
            color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
            Last checked
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
            {timeAgo(monitor.last_checked_at)}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10,
            color: "var(--text-muted, #aaa)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
            Next check
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
            {monitor.next_check_at ? timeAgo(monitor.next_check_at).replace("ago", "from now") : "—"}
          </p>
        </div>
      </div>

      {/* Actions */}
      {isLive && (
        <button
          onClick={() => onCancel(monitor.id)}
          style={{
            fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-muted, #aaa)",
            background: "none", border: "0.5px solid var(--border, #e5e7eb)",
            borderRadius: 6, padding: "3px 10px", cursor: "pointer",
          }}
        >
          Stop watching
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface JobGroup { tripLabel: string; jobId: string; monitors: BookingMonitor[] }

export default function MonitoringPage() {
  const [groups, setGroups] = useState<JobGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sid = getSessionId();
    if (!sid) { setLoading(false); return; }

    const [monRes, jobRes] = await Promise.allSettled([
      fetch(`/api/monitors?session_id=${encodeURIComponent(sid)}`).then((r) => r.json()),
      fetch(`/api/booking-jobs?session_id=${encodeURIComponent(sid)}`).then((r) => r.json()),
    ]);

    const monitors: BookingMonitor[] = (monRes.status === "fulfilled" ? monRes.value?.monitors : null) ?? [];
    const jobs: { id: string; trip_label: string }[] = (jobRes.status === "fulfilled" ? jobRes.value?.jobs : null) ?? [];

    // Group monitors by job
    const map = new Map<string, JobGroup>();
    for (const m of monitors) {
      if (!map.has(m.job_id)) {
        const job = jobs.find((j) => j.id === m.job_id);
        map.set(m.job_id, { jobId: m.job_id, tripLabel: job?.trip_label ?? "Trip", monitors: [] });
      }
      map.get(m.job_id)!.monitors.push(m);
    }
    setGroups([...map.values()]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh every 60s
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function cancelMonitor(id: string) {
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
    load();
  }

  const total   = groups.reduce((n, g) => n + g.monitors.length, 0);
  const active  = groups.reduce((n, g) => n + g.monitors.filter((m) => m.status === "active").length, 0);
  const alerts  = groups.reduce((n, g) => n + g.monitors.filter((m) => m.status === "triggered").length, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #fafaf9)" }}>
      <style>{`
        @keyframes navpulse { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>

      <GlobalNav active="monitoring" />

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 700,
            color: "var(--text-primary, #111)", marginBottom: 4 }}>
            Monitoring
          </h1>
          {!loading && (
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-secondary, #666)" }}>
              {total === 0
                ? "No active monitors — they start automatically after booking"
                : `${active} active · ${alerts > 0 ? `${alerts} alert${alerts > 1 ? "s" : ""} · ` : ""}${total} total`}
            </p>
          )}
        </div>

        {/* Alert banner */}
        {alerts > 0 && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, marginBottom: 20,
            backgroundColor: "rgba(239,68,68,0.07)", border: "0.5px solid rgba(239,68,68,0.25)",
          }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 13,
              color: "#ef4444", marginBottom: 4 }}>
              ⚠ {alerts} monitor{alerts > 1 ? "s" : ""} triggered
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)" }}>
              Scroll down to review alerts and take action.
            </p>
          </div>
        )}

        {/* How monitoring works (only when empty) */}
        {!loading && total === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { emoji: "🔍", title: "Availability watch", desc: "When a booking step fails, the agent keeps checking every 3 hours for an opening." },
              { emoji: "🔗", title: "Reservation check",  desc: "After a successful booking, the agent checks daily that the reservation link is still valid." },
              { emoji: "🌦",  title: "Weather alert",      desc: "For trips within 14 days, the agent monitors the destination and alerts you to rain or severe weather." },
            ].map((item) => (
              <div key={item.title} style={{
                padding: "14px 16px", borderRadius: 12,
                border: "0.5px solid var(--border, #e5e7eb)", backgroundColor: "var(--card, #fff)",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.emoji}</span>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 600, fontSize: 13,
                    color: "var(--text-primary, #111)", marginBottom: 3 }}>{item.title}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "var(--text-secondary, #666)", lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
            <a href="/" style={{
              display: "block", textAlign: "center", padding: "12px",
              borderRadius: 10, backgroundColor: "var(--gold, #C9A84C)",
              color: "#fff", textDecoration: "none",
              fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600, marginTop: 8,
            }}>
              Start a trip to activate monitoring →
            </a>
          </div>
        )}

        {loading && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--text-muted, #aaa)" }}>
            Loading…
          </p>
        )}

        {/* Monitor groups */}
        {!loading && groups.map((group) => (
          <div key={group.jobId} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700, fontSize: 13,
                color: "var(--text-primary, #111)" }}>
                {group.tripLabel}
              </p>
              <a href="/trips" style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12,
                color: "var(--gold, #C9A84C)", textDecoration: "none" }}>
                View trip →
              </a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {group.monitors.map((m) => (
                <MonitorCard key={m.id} monitor={m} onCancel={cancelMonitor} />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
