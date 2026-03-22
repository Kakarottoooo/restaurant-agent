"use client";

import { useState } from "react";
import type { FeedbackRating, FeedbackIssue, PostExperienceFeedback } from "@/lib/types";

interface FeedbackPromptCardProps {
  promptId: number;
  planId: string;
  sessionId: string;
  venueName: string;
  scenario: string;
  onDismiss: () => void;
  onRespond: (promptId: number, planId: string, feedback: PostExperienceFeedback) => void;
}

const ISSUE_LABELS: Record<FeedbackIssue, string> = {
  too_noisy: "Too noisy",
  too_expensive: "Too expensive",
  too_far: "Too far",
  bad_service: "Bad service",
  other: "Other",
};

export default function FeedbackPromptCard({
  promptId,
  planId,
  sessionId,
  venueName,
  scenario,
  onDismiss,
  onRespond,
}: FeedbackPromptCardProps) {
  const [step, setStep] = useState<"rating" | "issues" | "done">("rating");
  const [selectedIssues, setSelectedIssues] = useState<FeedbackIssue[]>([]);

  const isRestaurant = scenario === "date_night";
  const label = isRestaurant ? "dinner" : "trip";

  function handleRating(rating: FeedbackRating) {
    if (rating === "great" || rating === "did_not_go") {
      const feedback: PostExperienceFeedback = { rating };
      onRespond(promptId, planId, feedback);
      setStep("done");
    } else {
      setStep("issues");
    }
  }

  function toggleIssue(issue: FeedbackIssue) {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  }

  function submitIssues() {
    const feedback: PostExperienceFeedback = {
      rating: "ok",
      issues: selectedIssues.length > 0 ? selectedIssues : undefined,
    };
    onRespond(promptId, planId, feedback);
    setStep("done");
  }

  if (step === "done") return null;

  const truncatedName =
    venueName.length > 32 ? venueName.slice(0, 30) + "…" : venueName;

  return (
    <div
      style={{
        borderRadius: "16px",
        backgroundColor: "var(--card-bg, #fff)",
        border: "1px solid var(--border-color, rgba(0,0,0,0.08))",
        padding: "16px",
        marginBottom: "12px",
        fontFamily: "var(--font-dm-sans)",
        position: "relative",
      }}
    >
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss feedback"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary, #999)",
          fontSize: "16px",
          lineHeight: 1,
          padding: "2px 6px",
        }}
      >
        ×
      </button>

      {step === "rating" && (
        <>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary, #1a1a1a)",
              paddingRight: "24px",
            }}
          >
            How was your {label} at{" "}
            <span style={{ fontWeight: 600 }}>{truncatedName}</span>?
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => handleRating("great")} style={pillStyle("#16a34a")}>
              ✅ Great
            </button>
            <button onClick={() => handleRating("ok")} style={pillStyle("#b45309")}>
              ⚠️ OK but…
            </button>
            <button onClick={() => handleRating("did_not_go")} style={pillStyle("#6b7280")}>
              ❌ Didn't go
            </button>
          </div>
        </>
      )}

      {step === "issues" && (
        <>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary, #1a1a1a)",
              paddingRight: "24px",
            }}
          >
            What could have been better?
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            {(Object.keys(ISSUE_LABELS) as FeedbackIssue[]).map((issue) => (
              <button
                key={issue}
                onClick={() => toggleIssue(issue)}
                style={
                  selectedIssues.includes(issue)
                    ? { ...issueStyle, backgroundColor: "#fef3c7", borderColor: "#d97706" }
                    : issueStyle
                }
              >
                {ISSUE_LABELS[issue]}
              </button>
            ))}
          </div>
          <button onClick={submitIssues} style={submitStyle}>
            Submit
          </button>
        </>
      )}
    </div>
  );
}

const pillStyle = (color: string): React.CSSProperties => ({
  background: "none",
  border: `1px solid ${color}`,
  borderRadius: "20px",
  padding: "6px 14px",
  fontSize: "13px",
  color,
  cursor: "pointer",
  fontFamily: "var(--font-dm-sans)",
  fontWeight: 500,
});

const issueStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border-color, rgba(0,0,0,0.12))",
  borderRadius: "16px",
  padding: "5px 12px",
  fontSize: "13px",
  color: "var(--text-primary, #1a1a1a)",
  cursor: "pointer",
  fontFamily: "var(--font-dm-sans)",
};

const submitStyle: React.CSSProperties = {
  background: "var(--accent, #1a1a1a)",
  border: "none",
  borderRadius: "20px",
  padding: "7px 20px",
  fontSize: "13px",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-dm-sans)",
  fontWeight: 500,
};
