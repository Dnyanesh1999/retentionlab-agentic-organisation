import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { StageEvidence } from "./gate9Run";
import { humanizeStatus } from "./gate9Run";

type AgentNodeProps = {
  stage: StageEvidence;
  icon: LucideIcon;
  selected: boolean;
  onSelect: (id: StageEvidence["id"]) => void;
};

export function AgentNode({ stage, icon: Icon, selected, onSelect }: AgentNodeProps) {
  const reducedMotion = useReducedMotion();
  const recovered = stage.recovery !== null;

  return (
    <motion.button
      aria-pressed={selected}
      className={`agent-node agent-node--${stage.id}${selected ? " is-selected" : ""}`}
      data-recovered={recovered ? "true" : undefined}
      layoutId={`agent-${stage.id}`}
      onClick={() => onSelect(stage.id)}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      type="button"
      whileTap={reducedMotion ? undefined : { scale: 0.97 }}
    >
      <span className="agent-node__stage" aria-label={`Stage ${stage.stage}`}>
        {String(stage.stage).padStart(2, "0")}
      </span>
      <span className="agent-node__orbit" aria-hidden="true" />
      <span className="agent-node__icon">
        <Icon aria-hidden="true" size={30} strokeWidth={1.55} />
      </span>
      <strong>{stage.agentName}</strong>
      <small className="agent-node__status">
        v{stage.version} · {humanizeStatus(stage.statusLabel)}
      </small>
      {recovered ? (
        <span className="agent-node__recovered">
          <RefreshCw aria-hidden="true" size={11} strokeWidth={2} />
          recovered
        </span>
      ) : null}
    </motion.button>
  );
}
