"use client";

import ScenarioBrief from "@/components/ScenarioBrief";
import PrimaryPlanCard from "@/components/PrimaryPlanCard";
import BackupPlanCard from "@/components/BackupPlanCard";
import ActionRail from "@/components/ActionRail";
import ScenarioEvidencePanel from "@/components/ScenarioEvidencePanel";
import { buildPlanFeedbackCopy, getScenarioUiCopy } from "@/lib/outputCopy";
import type {
  DecisionPlan,
  PlanAction,
  PlanLinkAction,
  ScenarioTelemetryEventType,
} from "@/lib/types";

interface Props {
  plan: DecisionPlan;
  planFeedbackMessage: string | null;
  onAction: (action: PlanAction) => void;
  onLinkClick: (action: PlanLinkAction, optionId: string) => void;
  trackDecisionPlanEvent: (params: {
    type: ScenarioTelemetryEventType;
    option_id?: string;
    action_id?: string;
    metadata?: Record<string, unknown>;
    query?: string;
  }) => void;
  swapDecisionPlanOption: (optionId: string) => void;
  setPlanFeedbackMessage: (msg: string | null) => void;
  lastUserQuery: string;
}

export default function ScenarioPlanView({
  plan,
  planFeedbackMessage,
  onAction,
  onLinkClick,
  trackDecisionPlanEvent,
  swapDecisionPlanOption,
  setPlanFeedbackMessage,
  lastUserQuery,
}: Props) {
  const scenarioCopy = getScenarioUiCopy(plan.output_language);

  return (
    <div className="flex flex-col gap-4">
      <ScenarioBrief plan={plan} />
      {planFeedbackMessage && (
        <div
          style={{
            borderRadius: "14px",
            backgroundColor: "rgba(212,163,75,0.12)",
            border: "0.5px solid rgba(212,163,75,0.25)",
            padding: "12px 14px",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
        >
          {planFeedbackMessage}
        </div>
      )}
      <PrimaryPlanCard
        option={plan.primary_plan}
        language={plan.output_language}
        onLinkClick={(action) => onLinkClick(action, plan.primary_plan.id)}
      />

      {plan.risks.length > 0 && (
        <div
          style={{
            backgroundColor: "#FDF6EC",
            borderRadius: "18px",
            border: "0.5px solid rgba(232,160,32,0.35)",
            padding: "16px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#8B5E14",
              marginBottom: "10px",
            }}
          >
            {scenarioCopy.planRisks}
          </p>
          <div className="flex flex-col gap-2">
            {plan.risks.map((risk, index) => (
              <p
                key={`${plan.id}-risk-${index}`}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "#6B4A1A",
                }}
              >
                • {risk}
              </p>
            ))}
          </div>
        </div>
      )}

      <ActionRail
        actions={plan.next_actions}
        language={plan.output_language}
        onAction={onAction}
      />

      {plan.backup_plans.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              {scenarioCopy.backupOptions}
            </p>
            <h4
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "24px",
                color: "var(--text-primary)",
              }}
            >
              {scenarioCopy.keepOnDeck}
            </h4>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {plan.backup_plans.map((backupPlan) => (
              <BackupPlanCard
                key={backupPlan.id}
                option={backupPlan}
                onPromote={() => {
                  trackDecisionPlanEvent({
                    type: "backup_promoted",
                    option_id: backupPlan.id,
                    query: lastUserQuery,
                  });
                  setPlanFeedbackMessage(
                    buildPlanFeedbackCopy(
                      plan.output_language,
                      "promoted",
                      backupPlan.title
                    )
                  );
                  swapDecisionPlanOption(backupPlan.id);
                }}
                language={plan.output_language}
                onLinkClick={(action) => onLinkClick(action, backupPlan.id)}
              />
            ))}
          </div>
        </div>
      )}

      <ScenarioEvidencePanel plan={plan} />
    </div>
  );
}
