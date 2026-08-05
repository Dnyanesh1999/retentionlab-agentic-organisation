import { motion } from "motion/react";

import type { AgentDefinition } from "../../config/agents";

type AgentNodeProps = {
  agent: AgentDefinition;
  selected: boolean;
  onSelect: (agent: AgentDefinition) => void;
};

export function AgentNode({ agent, selected, onSelect }: AgentNodeProps) {
  const Icon = agent.icon;

  return (
    <motion.button
      aria-pressed={selected}
      className={`agent-node agent-node--${agent.id}${selected ? " is-selected" : ""}`}
      layoutId={`agent-${agent.id}`}
      onClick={() => onSelect(agent)}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      type="button"
      whileTap={{ scale: 0.97 }}
    >
      <span className="agent-node__stage" aria-label={`Stage ${agent.stage}`}>
        {String(agent.stage).padStart(2, "0")}
      </span>
      <span className="agent-node__orbit" aria-hidden="true" />
      <span className="agent-node__icon">
        <Icon aria-hidden="true" size={30} strokeWidth={1.55} />
      </span>
      <strong>{agent.name}</strong>
      <small>{selected ? "Selected" : "Not started"}</small>
    </motion.button>
  );
}

