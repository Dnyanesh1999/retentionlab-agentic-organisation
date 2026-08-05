import { ArrowRight, CircleCheck, FileOutput, LockKeyhole, Workflow } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { AgentDefinition } from "../../config/agents";

type AgentInspectorProps = {
  agent: AgentDefinition;
};

export function AgentInspector({ agent }: AgentInspectorProps) {
  const Icon = agent.icon;

  return (
    <aside className="agent-inspector" aria-label={`${agent.name} details`}>
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="agent-inspector__content"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: -8 }}
          key={agent.id}
          transition={{ duration: 0.18 }}
        >
          <header className="agent-inspector__header">
            <span className="agent-inspector__icon">
              <Icon aria-hidden="true" size={26} strokeWidth={1.55} />
            </span>
            <div>
              <h2>{agent.name}</h2>
              <p>{agent.persona} · Not started</p>
            </div>
            <span className="agent-inspector__step">Step {agent.stage} of 5</span>
          </header>

          <section className="inspector-section">
            <Workflow aria-hidden="true" />
            <div>
              <h3>Receives</h3>
              <p>{agent.receives}</p>
            </div>
          </section>

          <section className="inspector-section">
            <FileOutput aria-hidden="true" />
            <div>
              <h3>Output contract</h3>
              <p>{agent.produces}</p>
            </div>
          </section>

          <section className="inspector-section">
            <LockKeyhole aria-hidden="true" />
            <div>
              <h3>Gate condition</h3>
              <p>{agent.gate}</p>
            </div>
          </section>

          <div className="inspector-status" role="status">
            <CircleCheck aria-hidden="true" size={17} />
            Interface contract documented
          </div>

          <button className="primary-action" disabled type="button">
            Connect live case to continue
            <ArrowRight aria-hidden="true" size={18} />
          </button>
          <p className="disabled-reason">Handoffs unlock only after live data and MCP verification.</p>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

