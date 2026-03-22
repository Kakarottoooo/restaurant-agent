"use client";

import { DecisionPlan } from "@/lib/types";
import { getScenarioUiCopy } from "@/lib/outputCopy";

interface ScenarioEvidencePanelProps {
  plan: DecisionPlan;
}

export default function ScenarioEvidencePanel({
  plan,
}: ScenarioEvidencePanelProps) {
  if (plan.evidence_items.length === 0) return null;
  const copy = getScenarioUiCopy(plan.output_language);

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "18px",
        border: "0.5px solid var(--border)",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            {copy.evidenceLayer}
          </p>
          <h4
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "22px",
              color: "var(--text-primary)",
            }}
          >
            {copy.evidenceTitle}
          </h4>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {plan.evidence_items.map((item) => (
          <div
            key={item.id}
            style={{
              borderRadius: "14px",
              backgroundColor: "var(--card-2)",
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "6px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <h5
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "19px",
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {item.title}
              </h5>
              {item.tag && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                    backgroundColor: "rgba(212,163,75,0.12)",
                    borderRadius: "999px",
                    padding: "6px 10px",
                  }}
                >
                  {item.tag}
                </span>
              )}
            </div>

            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "13px",
                color: "var(--text-primary)",
                lineHeight: 1.6,
              }}
            >
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
