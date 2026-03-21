"use client";

import { OutputLanguage, PlanAction } from "@/lib/types";
import { getScenarioUiCopy } from "@/lib/outputCopy";

interface ActionRailProps {
  actions: PlanAction[];
  language?: OutputLanguage;
  onAction: (action: PlanAction) => void;
}

export default function ActionRail({
  actions,
  language,
  onAction,
}: ActionRailProps) {
  if (actions.length === 0) return null;
  const copy = getScenarioUiCopy(language);

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

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action)}
            title={action.description}
            style={{
              borderRadius: "999px",
              padding: "10px 14px",
              border:
                action.type === "share_plan"
                  ? "none"
                  : "0.5px solid var(--gold)",
              backgroundColor:
                action.type === "share_plan" ? "var(--gold)" : "transparent",
              color: action.type === "share_plan" ? "#fff" : "var(--gold)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
