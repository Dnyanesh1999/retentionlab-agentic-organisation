import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Megaphone, PenTool, Search, UserRoundCog, Wrench } from "lucide-react";

import { AgentInspector } from "./AgentInspector";
import { AgentNode } from "./AgentNode";
import { gate9Run, type StageId } from "./gate9Run";
import { LivingCase } from "./LivingCase";
import { ManagerDock } from "./ManagerDock";
import { SourceRail } from "./SourceRail";

// Icons stay part of the accepted design system; every other value on this
// screen is sourced from the committed Gate 9 evidence in gate9Run.
const STAGE_ICONS: Record<StageId, LucideIcon> = {
  researcher: Search,
  designer: PenTool,
  maker: Wrench,
  communicator: Megaphone,
  manager: UserRoundCog,
};

export function OrganisationView() {
  const [selectedId, setSelectedId] = useState<StageId>("researcher");
  const selectedStage = gate9Run.stages.find((stage) => stage.id === selectedId) ?? gate9Run.stages[0];

  return (
    <div className="organisation-layout">
      <section className="organisation-stage" aria-label="Five-agent organisation">
        <div className="stage-notice" role="status">
          Accepted Gate 9 run · immutable assessed snapshot · {gate9Run.eventCount} events
        </div>
        <div className="organisation-canvas">
          <svg className="handoff-path" viewBox="0 0 840 570" aria-hidden="true">
            <path d="M120 190 C230 36 360 40 420 83 C548 20 704 89 722 218 C790 330 674 465 555 485 C420 566 225 510 118 401 C70 340 70 252 120 190Z" />
            <path className="handoff-path__progress" d="M120 190 C230 36 360 40 420 83 C548 20 704 89 722 218 C790 330 674 465 555 485 C420 566 225 510 118 401 C70 340 70 252 120 190Z" />
          </svg>

          {gate9Run.stages.map((stage) => (
            <AgentNode
              icon={STAGE_ICONS[stage.id]}
              key={stage.id}
              onSelect={setSelectedId}
              selected={selectedId === stage.id}
              stage={stage}
            />
          ))}

          <LivingCase />
        </div>
        <SourceRail />
        <ManagerDock />
      </section>

      <AgentInspector icon={STAGE_ICONS[selectedStage.id]} stage={selectedStage} />
    </div>
  );
}
