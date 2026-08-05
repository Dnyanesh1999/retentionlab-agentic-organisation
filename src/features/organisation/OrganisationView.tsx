import { useState } from "react";

import { agents, type AgentDefinition } from "../../config/agents";
import { AgentInspector } from "./AgentInspector";
import { AgentNode } from "./AgentNode";
import { LivingCase } from "./LivingCase";
import { ManagerDock } from "./ManagerDock";
import { SourceRail } from "./SourceRail";

export function OrganisationView() {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition>(agents[1]);

  return (
    <div className="organisation-layout">
      <section className="organisation-stage" aria-label="Five-agent organisation">
        <div className="stage-notice" role="status">
          Interface foundation · live execution is intentionally locked
        </div>
        <div className="organisation-canvas">
          <svg className="handoff-path" viewBox="0 0 840 570" aria-hidden="true">
            <path d="M120 190 C230 36 360 40 420 83 C548 20 704 89 722 218 C790 330 674 465 555 485 C420 566 225 510 118 401 C70 340 70 252 120 190Z" />
            <path className="handoff-path__progress" d="M120 190 C230 36 360 40 420 83" />
          </svg>

          {agents.map((agent) => (
            <AgentNode
              agent={agent}
              key={agent.id}
              onSelect={setSelectedAgent}
              selected={selectedAgent.id === agent.id}
            />
          ))}

          <LivingCase />
        </div>
        <SourceRail />
        <ManagerDock />
      </section>

      <AgentInspector agent={selectedAgent} />
    </div>
  );
}

