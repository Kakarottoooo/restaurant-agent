"use client";

import { useState } from "react";
import { OutputLanguage, PlanAction } from "@/lib/types";
import { getScenarioUiCopy } from "@/lib/outputCopy";

interface ActionRailProps {
  actions: PlanAction[];
  language?: OutputLanguage;
  onAction: (action: PlanAction) => void | Promise<void>;
}

export default function ActionRail({
  actions,
  language,
  onAction,
}: ActionRailProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  if (actions.length === 0) return null;
  const copy = getScenarioUiCopy(language);

  async function handleClick(action: PlanAction) {
    if (loadingId) return; // prevent concurrent actions
    setLoadingId(action.id);
    setErrorId(null);
    try {
      await onAction(action);
    } catch {
      setErrorId(action.id);
      // Clear error after 3 seconds
      setTimeout(() => setErrorId((prev) => (prev === action.id ? null : prev)), 3000);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "18px",
        border: "0.5px solid var(--border)",
        padding: "16px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-secondary)",
          marginBottom: "12px",
        }}
      >
        {copy.nextActions}
      </p>

      {/* Scrollable pill row — single row on mobile, wraps on wider viewports */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: "8px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingRight: "24px", // leave room for fade gradient
          }}
          className="hide-scrollbar"
        >
        {(() => {
          const firstOpenLinkIdx = actions.findIndex((a) => a.type === "open_link");
          return actions.map((action, index) => {
            // open_link: rendered as <a>, bypasses loadingId entirely
            if (action.type === "open_link") {
              const isPrimary = index === firstOpenLinkIdx;
              return (
                <a
                  key={action.id}
                  href={action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={action.label}
                  title={action.description}
                  style={{
                    borderRadius: "999px",
                    padding: "10px 14px",
                    border: isPrimary ? "none" : "0.5px solid var(--gold)",
                    backgroundColor: isPrimary ? "var(--gold)" : "transparent",
                    color: isPrimary ? "#fff" : "var(--gold)",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "13px",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {action.label}
                </a>
              );
            }

            const isLoading = loadingId === action.id;
            const isError = errorId === action.id;
            const isShare = action.type === "share_plan";
            const isDisabled = !!loadingId;

            return (
              <button
                key={action.id}
                onClick={() => handleClick(action)}
                disabled={isDisabled}
                title={isError ? "Failed — try again" : action.description}
                style={{
                  borderRadius: "999px",
                  padding: "10px 14px",
                  border: isShare ? "none" : "0.5px solid var(--gold)",
                  backgroundColor: isError
                    ? "#ef4444"
                    : isShare
                      ? "var(--gold)"
                      : "transparent",
                  color: isShare || isError ? "#fff" : "var(--gold)",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled && !isLoading ? 0.5 : 1,
                  transition: "background-color 0.2s, opacity 0.2s",
                }}
              >
                {isLoading ? "…" : isError ? "Failed — tap to retry" : action.label}
              </button>
            );
          });
        })()}
        </div>
        {/* Right-edge fade gradient — hints at scrollable overflow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "32px",
            height: "100%",
            pointerEvents: "none",
            background: "linear-gradient(to right, transparent, var(--card))",
          }}
        />
      </div>
    </div>
  );
}
