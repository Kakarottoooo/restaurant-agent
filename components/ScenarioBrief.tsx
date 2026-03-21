"use client";

import { DecisionPlan } from "@/lib/types";
import { formatConfidenceCopy, getScenarioUiCopy } from "@/lib/outputCopy";

interface ScenarioBriefProps {
  plan: DecisionPlan;
}

export default function ScenarioBrief({ plan }: ScenarioBriefProps) {
  const copy = getScenarioUiCopy(plan.output_language);
  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "18px",
        border: "0.5px solid var(--border)",
        padding: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-dm-sans)",
              color: "var(--gold)",
              marginBottom: "6px",
            }}
          >
            {copy.scenarioPlan}
          </p>
          <h3
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "24px",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {plan.title}
          </h3>
        </div>
        <span
          style={{
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: "11px",
            fontFamily: "var(--font-dm-sans)",
            color: "var(--text-primary)",
            backgroundColor: "var(--card-2)",
            border: "0.5px solid var(--border)",
            textTransform: "capitalize",
          }}
        >
          {formatConfidenceCopy(plan.output_language, plan.confidence)}
        </span>
      </div>

      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "14px",
          lineHeight: 1.6,
          color: "var(--text-primary)",
          marginBottom: "12px",
        }}
      >
        {plan.summary}
      </p>

      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "13px",
          lineHeight: 1.6,
          color: "var(--text-secondary)",
          marginBottom: "12px",
        }}
      >
        {plan.approval_prompt}
      </p>

      <div className="flex flex-col gap-2">
        {plan.scenario_brief.map((item, index) => (
          <div
            key={`${plan.id}-brief-${index}`}
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: "var(--gold)", marginTop: "1px" }}>•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
