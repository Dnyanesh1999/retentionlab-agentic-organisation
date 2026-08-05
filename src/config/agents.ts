import type { LucideIcon } from "lucide-react";
import { Megaphone, PenTool, Search, UserRoundCog, Wrench } from "lucide-react";

export type AgentId = "researcher" | "designer" | "maker" | "communicator" | "manager";

export type AgentDefinition = {
  id: AgentId;
  stage: 1 | 2 | 3 | 4 | 5;
  name: string;
  persona: string;
  icon: LucideIcon;
  receives: string;
  produces: string;
  gate: string;
};

export const agents: readonly AgentDefinition[] = [
  {
    id: "researcher",
    stage: 1,
    name: "Researcher",
    persona: "Nia Calder",
    icon: Search,
    receives: "Fresh, cited evidence returned by approved MCP tools.",
    produces: "A research brief that identifies a defensible retention opportunity.",
    gate: "Every material claim must reference retrievable source evidence.",
  },
  {
    id: "designer",
    stage: 2,
    name: "Designer",
    persona: "Luca Moretti",
    icon: PenTool,
    receives: "The validated Researcher brief and its evidence references.",
    produces: "A consent-aware recovery experience specification.",
    gate: "The design must respond to the researched causes and customer context.",
  },
  {
    id: "maker",
    stage: 3,
    name: "Maker",
    persona: "Noor Patel",
    icon: Wrench,
    receives: "The validated recovery experience specification.",
    produces: "A typed, renderable and interactive Recovery Room artefact.",
    gate: "The artefact must validate and its customer choices must function.",
  },
  {
    id: "communicator",
    stage: 4,
    name: "Communicator",
    persona: "Maeve Quinn",
    icon: Megaphone,
    receives: "The working Recovery Room and the evidence it is allowed to cite.",
    produces: "A transparent, consent-respecting customer communication plan.",
    gate: "Messaging cannot add claims or promises absent from prior artefacts.",
  },
  {
    id: "manager",
    stage: 5,
    name: "Manager",
    persona: "Elias Grant",
    icon: UserRoundCog,
    receives: "The complete versioned chain and its trust evaluation.",
    produces: "An approve, reject or revise operational decision with rationale.",
    gate: "No action proceeds without traceable evidence and human approval boundaries.",
  },
] as const;
