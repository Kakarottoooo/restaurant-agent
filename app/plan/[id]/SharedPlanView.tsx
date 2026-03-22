"use client";

import { useState } from "react";
import { DecisionPlan } from "@/lib/types";
import PrimaryPlanCard from "@/components/PrimaryPlanCard";
import BackupPlanCard from "@/components/BackupPlanCard";

interface Props {
  plan: DecisionPlan;
  planId: string;
  outcomeRecorded: boolean;
  voteMode?: boolean;
  initialTally?: Record<string, number>;
}

export default function SharedPlanView({ plan, planId, outcomeRecorded, voteMode = false, initialTally = {} }: Props) {
  const [approved, setApproved] = useState(outcomeRecorded);
  const [loading, setLoading] = useState(false);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [tally, setTally] = useState<Record<string, number>>(initialTally);
  const [votingId, setVotingId] = useState<string | null>(null);

  async function handleApprove() {
    if (approved || loading) return;
    setLoading(true);
    try {
      await fetch(`/api/plan/${planId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome_type: "partner_approved" }),
      });
      setApproved(true);
    } catch {
      // Non-blocking — approval is a nice-to-have signal
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(optionId: string) {
    if (votingId) return;
    setVotingId(optionId);
    // Optimistic update
    setVotedOptionId(optionId);
    setTally((prev) => {
      const next = { ...prev };
      if (votedOptionId && next[votedOptionId]) next[votedOptionId]--;
      next[optionId] = (next[optionId] ?? 0) + 1;
      return next;
    });
    try {
      const voterSession = getOrCreateVoterSession();
      const res = await fetch(`/api/plan/${planId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter_session: voterSession, option_id: optionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tally) setTally(data.tally);
      }
    } catch {
      // Keep optimistic state
    } finally {
      setVotingId(null);
    }
  }

  const lang = plan.output_language;
  const copy = {
    sharedBy: lang === "zh" ? (voteMode ? "大家来投票" : "为你精选的方案") : (voteMode ? "Vote on a plan" : "A plan picked for you"),
    approve: lang === "zh" ? "就这个了 ✓" : "This works for me ✓",
    approving: lang === "zh" ? "记录中…" : "Recording…",
    approved: lang === "zh" ? "已确认 ✓" : "Confirmed ✓",
    backups: lang === "zh" ? "备选方案" : "Other options",
    cta: lang === "zh" ? "用 Onegent 制定你自己的方案 →" : "Make your own plan with Onegent →",
    addToCalendar: lang === "zh" ? "下载日历文件 (.ics)" : "Add to Calendar (.ics)",
    vote: lang === "zh" ? "投这个 ✓" : "Vote for this ✓",
    voted: lang === "zh" ? "已选 ✓" : "Voted ✓",
    votePrompt: lang === "zh" ? "选出你最喜欢的方案" : "Pick your favorite option",
    votes: (n: number) => lang === "zh" ? `${n} 票` : `${n} vote${n === 1 ? "" : "s"}`,
  };

  const allOptions = [plan.primary_plan, ...plan.backup_plans];
  const totalVotes = Object.values(tally).reduce((sum, n) => sum + n, 0);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
        padding: "24px 16px 64px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          {copy.sharedBy}
        </p>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text-primary)",
            lineHeight: 1.3,
          }}
        >
          {plan.title}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginTop: "8px",
            lineHeight: 1.5,
          }}
        >
          {plan.summary}
        </p>
      </div>

      {voteMode ? (
        /* ── Vote mode: show all options with vote buttons ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "4px" }}>
            {copy.votePrompt}
          </p>
          {allOptions.map((option) => {
            const voteCount = tally[option.id] ?? 0;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isVoted = votedOptionId === option.id;
            return (
              <div key={option.id}>
                <PrimaryPlanCard option={option} language={lang} />
                {/* Vote bar (only shown after at least one vote) */}
                {totalVotes > 0 && (
                  <div style={{ marginTop: "6px", marginBottom: "4px" }}>
                    <div style={{ height: "4px", borderRadius: "2px", backgroundColor: "var(--card-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "var(--gold)", transition: "width 0.4s" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                      {copy.votes(voteCount)} {totalVotes > 0 ? `(${pct}%)` : ""}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleVote(option.id)}
                  disabled={!!votingId}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: isVoted ? "none" : "1px solid var(--border)",
                    backgroundColor: isVoted ? "var(--gold)" : "transparent",
                    color: isVoted ? "#fff" : "var(--text-secondary)",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: votingId ? "default" : "pointer",
                    transition: "all 0.2s",
                    marginTop: "8px",
                  }}
                >
                  {isVoted ? copy.voted : copy.vote}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Standard share mode ── */
        <>
          {/* Primary plan */}
          <PrimaryPlanCard option={plan.primary_plan} language={lang} />

          {/* Partner approval button */}
          <div style={{ margin: "16px 0" }}>
            <button
              onClick={handleApprove}
              disabled={approved || loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: approved
                  ? "var(--card-2)"
                  : "var(--gold)",
                color: approved ? "var(--text-secondary)" : "#fff",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: approved || loading ? "default" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {loading ? copy.approving : approved ? copy.approved : copy.approve}
            </button>
          </div>

          {/* Add to Calendar */}
          {plan.event_datetime && (
            <div style={{ margin: "8px 0 16px" }}>
              <a
                href={`/api/plan/${planId}/calendar`}
                download={`onegent-plan-${planId}.ics`}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "14px",
                  fontWeight: 500,
                  textAlign: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                {copy.addToCalendar}
              </a>
            </div>
          )}

          {/* Backup plans */}
          {plan.backup_plans.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <p
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: "12px",
                }}
              >
                {copy.backups}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {plan.backup_plans.map((backup) => (
                  <BackupPlanCard
                    key={backup.id}
                    option={backup}
                    language={lang}
                    onPromote={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer CTA */}
      <div
        style={{
          marginTop: "40px",
          textAlign: "center",
          borderTop: "0.5px solid var(--border)",
          paddingTop: "24px",
        }}
      >
        <a
          href="/"
          style={{
            fontSize: "13px",
            color: "var(--gold)",
            textDecoration: "none",
          }}
        >
          {copy.cta}
        </a>
      </div>
    </main>
  );
}

/** Per-browser voter session ID — stored in localStorage to allow returning voters to change their vote */
function getOrCreateVoterSession(): string {
  try {
    const key = "onegent_voter_session";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `vs_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `vs_anon_${Math.random().toString(36).slice(2)}`;
  }
}
