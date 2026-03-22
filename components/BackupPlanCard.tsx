"use client";

import { OutputLanguage, PlanLinkAction, PlanOption } from "@/lib/types";
import { getScenarioUiCopy } from "@/lib/outputCopy";

interface BackupPlanCardProps {
  option: PlanOption;
  language?: OutputLanguage;
  onPromote: () => void;
  onLinkClick?: (action: PlanLinkAction) => void;
}

export default function BackupPlanCard({
  option,
  language,
  onPromote,
  onLinkClick,
}: BackupPlanCardProps) {
  const copy = getScenarioUiCopy(language);
  const displayLabel = option.tradeoff_reason ?? option.label;
  const displaySummary = option.tradeoff_detail ?? option.summary;
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
          marginBottom: "8px",
        }}
      >
        {displayLabel}
      </p>

      <h4
        style={{
          fontFamily: "var(--font-playfair)",
          fontSize: "22px",
          color: "var(--text-primary)",
          lineHeight: 1.2,
          marginBottom: "4px",
        }}
      >
        {option.title}
      </h4>

      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "13px",
          color: "var(--text-secondary)",
          marginBottom: "10px",
        }}
      >
        {option.subtitle}
      </p>

      {option.fallback_reason && (
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--text-primary)",
            marginBottom: "10px",
          }}
        >
          {option.fallback_reason}
        </p>
      )}

      <div className="flex flex-col gap-2" style={{ marginBottom: "12px" }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {displaySummary}
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
          }}
        >
          {option.timing_note}
        </p>
      </div>

      {option.highlights.length > 0 && (
        <div className="flex flex-col gap-2" style={{ marginBottom: "12px" }}>
          {option.highlights.slice(0, 2).map((item, index) => (
            <p
              key={`${option.id}-highlight-${index}`}
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--text-primary)",
              }}
            >
              • {item}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onPromote}
          style={{
            borderRadius: "999px",
            padding: "9px 14px",
            border: "none",
            backgroundColor: "var(--text-primary)",
            color: "var(--bg)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          {copy.makePrimary}
        </button>
        {option.primary_action && (
          <a
            href={option.primary_action.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLinkClick?.(option.primary_action!)}
            style={{
              borderRadius: "999px",
              padding: "9px 14px",
              border: "0.5px solid var(--gold)",
              color: "var(--gold)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            {option.primary_action.label}
          </a>
        )}
      </div>
    </div>
  );
}
