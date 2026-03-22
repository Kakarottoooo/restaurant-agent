"use client";

import { OutputLanguage, PlanLinkAction, PlanOption } from "@/lib/types";
import { getScenarioUiCopy, pickLanguageCopy } from "@/lib/outputCopy";

interface PrimaryPlanCardProps {
  option: PlanOption;
  language?: OutputLanguage;
  confidence?: "high" | "medium" | "low";
  onLinkClick?: (action: PlanLinkAction) => void;
}

function ActionLink({
  action,
  subtle = false,
  onClick,
}: {
  action: PlanLinkAction;
  subtle?: boolean;
  onClick?: (action: PlanLinkAction) => void;
}) {
  return (
    <a
      href={action.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onClick?.(action)}
      style={{
        padding: "10px 14px",
        borderRadius: "999px",
        fontFamily: "var(--font-dm-sans)",
        fontSize: "13px",
        textDecoration: "none",
        backgroundColor: subtle ? "transparent" : "var(--gold)",
        color: subtle ? "var(--gold)" : "#fff",
        border: subtle ? "0.5px solid var(--gold)" : "none",
      }}
    >
      {action.label}
    </a>
  );
}

export default function PrimaryPlanCard({
  option,
  language,
  confidence,
  onLinkClick,
}: PrimaryPlanCardProps) {
  const afterDinnerOption = option.after_dinner_option ?? null;
  const copy = getScenarioUiCopy(language);
  const isHighConfidence = confidence === "high";
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(212,163,75,0.12) 0%, rgba(255,255,255,0) 100%), var(--card)",
        borderRadius: "20px",
        border: isHighConfidence
          ? "0.5px solid rgba(22,163,74,0.3)"
          : "0.5px solid rgba(212,163,75,0.35)",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-dm-sans)",
              color: isHighConfidence ? "rgba(22,163,74,0.9)" : "var(--gold)",
              marginBottom: "8px",
            }}
          >
            {isHighConfidence
              ? (language === "zh" ? "✓ 已为你选定" : "✓ Selected for you")
              : option.label}
          </p>
          <h3
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "28px",
              lineHeight: 1.15,
              color: "var(--text-primary)",
              marginBottom: "6px",
            }}
          >
            {option.title}
          </h3>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            {option.subtitle}
          </p>
        </div>
        <div
          style={{
            borderRadius: "14px",
            backgroundColor: "var(--card-2)",
            padding: "10px 12px",
            minWidth: "120px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {copy.estimatedSpend}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {option.estimated_total}
          </p>
          {option.after_dinner_option && (
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {pickLanguageCopy(language, "dinner only", "仅餐厅")}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--card-2)",
          borderRadius: "14px",
          padding: "14px",
          marginBottom: "12px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-secondary)",
            marginBottom: "6px",
          }}
        >
          {copy.whyThisPlan}
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          {option.summary}
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {option.why_this_now}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2" style={{ marginBottom: "12px" }}>
        <div
          style={{
            borderRadius: "14px",
            border: "0.5px solid var(--border)",
            padding: "14px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            {copy.timing}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--text-primary)",
            }}
          >
            {option.timing_note}
          </p>
        </div>

        <div
          style={{
            borderRadius: "14px",
            border: "0.5px solid var(--border)",
            padding: "14px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            {copy.bestFor}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--text-primary)",
            }}
          >
            {option.best_for}
          </p>
        </div>
      </div>

      {option.highlights.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            {copy.included}
          </p>
          <div className="flex flex-col gap-2">
            {option.highlights.map((item, index) => (
              <div
                key={`${option.id}-highlight-${index}`}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                }}
              >
                • {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {option.tradeoffs.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            {copy.tradeoffs}
          </p>
          <div className="flex flex-col gap-2">
            {option.tradeoffs.map((item, index) => (
              <div
                key={`${option.id}-tradeoff-${index}`}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                • {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {afterDinnerOption && (
        <div
          style={{
            borderRadius: "14px",
            border: "0.5px solid var(--border)",
            padding: "14px",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            {pickLanguageCopy(language, "Then →", "然后 →")}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            {afterDinnerOption.name}
            <span
              style={{
                fontWeight: 400,
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginLeft: "8px",
              }}
            >
              · {afterDinnerOption.walk_minutes} {pickLanguageCopy(language, "min walk", "分钟步行")}
            </span>
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              marginBottom: "6px",
            }}
          >
            {afterDinnerOption.vibe}
          </p>
          {afterDinnerOption.google_maps_url && (
            <a
              href={afterDinnerOption.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "12px",
                color: "var(--gold)",
                textDecoration: "none",
              }}
            >
              {pickLanguageCopy(language, "View on Maps →", "在地图上查看 →")}
            </a>
          )}
        </div>
      )}

      {option.primary_action && (
        <div className="flex flex-wrap gap-2" style={{ alignItems: "center" }}>
          <ActionLink action={option.primary_action} onClick={onLinkClick} />
        </div>
      )}
    </div>
  );
}
