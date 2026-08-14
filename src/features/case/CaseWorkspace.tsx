import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";

import { HashLink } from "../../components/HashLink";
import type { CaseTabId } from "../../config/caseTabs";
import { gate9Run, humanizeStatus } from "../organisation/gate9Run";
import { OrganisationView } from "../organisation/OrganisationView";
import { RecoveryRoomRoute } from "../recovery-room/RecoveryRoomView";
import { FeaturePreview } from "../shared/FeaturePreview";
import { CaseTabs } from "./CaseTabs";

const previewCopy = {
  pulse: {
    title: "Pulse",
    description: "Account signals will appear here only after the live Supabase and MCP gates pass.",
    gate: "Gate 2 · Live data",
  },
  evidence: {
    title: "Evidence",
    description: "Every claim will resolve to a fresh source record, retrieval time and MCP tool call.",
    gate: "Gate 3 · MCP tools",
  },
  "recovery-room": {
    title: "Recovery Room",
    description: "The Maker will generate this functional customer experience from the validated Designer artefact.",
    gate: "Gate 6 · Maker",
  },
  "trust-gate": {
    title: "Trust Gate",
    description: "Human approval, customer consent and regulatory checks will be evaluated before any communication.",
    gate: "Gate 8 · Manager",
  },
  audit: {
    title: "Audit",
    description: "Prompt versions, model identifiers, artefact lineage and source traces will be exported here.",
    gate: "Gate 9 · Orchestration",
  },
} as const;

type CaseWorkspaceProps = {
  tab: CaseTabId;
};

export function CaseWorkspace({ tab }: CaseWorkspaceProps) {
  const isAssessedRun = tab === "organisation";
  const isLiveRecoveryRoom = tab === "recovery-room";

  const heading = isAssessedRun
    ? "Copper Finch retention case"
    : isLiveRecoveryRoom
      ? "Copper Finch live signal garden"
      : "Connect a live case";
  const description = isAssessedRun
    ? "The accepted Gate 9 five-agent run, presented from its immutable evidence snapshot."
    : isLiveRecoveryRoom
      ? "Fresh synthetic account evidence is requested from Supabase when this route opens; the experience fails closed if that source is unavailable."
      : "No customer evidence is stored in this interface shell.";

  return (
    <main className="case-workspace" id="main-content">
      {isLiveRecoveryRoom ? (
        <HashLink className="case-workspace__back" to="/cases/overview">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to case experience
        </HashLink>
      ) : null}
      <header className="case-heading">
        <div>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {isAssessedRun ? (
          <span className="brief-link brief-link--assessed">
            <ShieldCheck aria-hidden="true" size={15} />
            Assessed run · {humanizeStatus(gate9Run.finalStatus)}
          </span>
        ) : isLiveRecoveryRoom ? (
          <span className="brief-link brief-link--assessed">
            <ShieldCheck aria-hidden="true" size={15} />
            Live evidence route · no cached fallback
          </span>
        ) : (
          <span className="brief-link brief-link--pending">
            <LockKeyhole aria-hidden="true" size={15} />
            Live connection gate pending
          </span>
        )}
      </header>

      {isLiveRecoveryRoom ? null : <CaseTabs currentTab={tab} />}

      {tab === "organisation" ? <OrganisationView /> : null}
      {tab === "recovery-room" ? <RecoveryRoomRoute /> : null}
      {tab !== "organisation" && tab !== "recovery-room" ? <FeaturePreview {...previewCopy[tab]} /> : null}
    </main>
  );
}
