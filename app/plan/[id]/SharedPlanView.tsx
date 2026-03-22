"use client";

import { useState } from "react";
import { DecisionPlan } from "@/lib/types";
import PrimaryPlanCard from "@/components/PrimaryPlanCard";
import BackupPlanCard from "@/components/BackupPlanCard";

interface Props {
  plan: DecisionPlan;
  planId: string;
  outcomeRecorded: boolean;
}

export default function SharedPlanView({ plan, planId, outcomeRecorded }: Props) {
  const [approved, setApproved] = useState(outcomeRecorded);
  const [loading, setLoading] = useState(false);

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

  const lang = plan.output_language;
  const copy = {
    sharedBy: lang === "zh" ? "为你精选的方案" : "A plan picked for you",
    approve: lang === "zh" ? "就这个了 ✓" : "This works for me ✓",
    approving: lang === "zh" ? "记录中…" : "Recording…",
    approved: lang === "zh" ? "已确认 ✓" : "Confirmed ✓",
    backups: lang === "zh" ? "备选方案" : "Backup options",
    cta: lang === "zh" ? "用 Folio 制定你自己的方案 →" : "Make your own plan with Folio →",
  };

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
