// Deterministic, evidence-grounded answers for the read-only Manager view.
//
// This is NOT a model call. Each answer is composed at build time from the
// committed Gate 9 manager decision and transcript, so the read-only Manager
// surface can respond to a fixed set of questions without ever pretending to
// run a live LLM. Free text that matches none of these returns an honest
// "answers only from the sealed record" notice (handled in the component).

import { gate9Run, humanizeStatus, shortHash } from "./gate9Run";

export type ManagerAnswer = {
  id: string;
  question: string;
  answer: string;
  source: string;
  /** Lowercased keywords used to match free-text input deterministically. */
  keywords: string[];
};

const { managerOutcome, recovery, lineageLinks, stages } = gate9Run;
const managerStage = stages.find((stage) => stage.id === "manager");
const verifiedLinkCount = lineageLinks.filter((link) => link.verified).length;

export const managerAnswers: readonly ManagerAnswer[] = [
  {
    id: "decision",
    question: "What did the Manager decide?",
    answer: `Decision: ${managerOutcome.decision}. The Manager assessed all four predecessor stages and sealed the chain for a named human. Permitted next action: ${humanizeStatus(managerOutcome.permittedNextAction)}.`,
    source: "manager.operational-decision.v1",
    keywords: ["decide", "decision", "approve", "verdict", "outcome"],
  },
  {
    id: "autonomy",
    question: "Can the organisation act without a human?",
    answer: `No. Autonomous external actions: ${managerOutcome.autonomousExternalActions ? "true" : "false"}. Human approval required: ${managerOutcome.humanApprovalRequired ? "true" : "false"}. Nothing is sent, published, deployed or mutated until a named human approves.`,
    source: "manager.operational-decision.v1 · governance",
    keywords: ["autonomous", "act", "human", "approval", "send", "auto"],
  },
  {
    id: "chain",
    question: "Is the evidence chain verified?",
    answer: `Yes — chain verified: ${managerOutcome.chainVerified ? "true" : "false"}, with all ${verifiedLinkCount} lineage links matching their predecessor hashes${managerStage ? ` (Manager artefact ${shortHash(managerStage.sha256)})` : ""}.`,
    source: "gate-9 transcript · lineage",
    keywords: ["chain", "verified", "lineage", "hash", "links", "evidence"],
  },
  {
    id: "recovery",
    question: "What happened to the Communicator?",
    answer: `Communicator v${recovery.failedVersion} failed validation: "${recovery.failureError}" A named operator retry re-ran it as v${recovery.rerunVersion}, which succeeded. The original failure stays recorded — it is never hidden.`,
    source: "gate-9 transcript · failed_stage_retries",
    keywords: ["communicator", "fail", "failed", "retry", "recover", "recovery", "operator"],
  },
  {
    id: "human-focus",
    question: "What must a human review?",
    answer: gate9Run.humanReviewFocus.length
      ? `The Manager flagged ${gate9Run.humanReviewFocus.length} items for the human reviewer: ${gate9Run.humanReviewFocus.join(" · ")}`
      : "No specific human-review focus was recorded.",
    source: "manager.operational-decision.v1 · human_review_focus",
    keywords: ["review", "human", "focus", "check", "reviewer"],
  },
] as const;

const NOTICE =
  "This read-only Manager view answers only from the sealed decision record — nothing is sent to a model. Try one of the grounded questions below.";

/**
 * Deterministically resolve a free-text question to a grounded answer by
 * keyword overlap. Returns the honest fallback notice when nothing matches.
 */
export function resolveManagerAnswer(input: string): { answer: ManagerAnswer | null; notice: string } {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return { answer: null, notice: "Enter a question, or pick one of the grounded questions below." };
  }

  let best: ManagerAnswer | null = null;
  let bestScore = 0;
  for (const candidate of managerAnswers) {
    const score = candidate.keywords.reduce(
      (total, keyword) => (normalized.includes(keyword) ? total + 1 : total),
      0,
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) {
    return { answer: best, notice: "" };
  }
  return { answer: null, notice: NOTICE };
}
