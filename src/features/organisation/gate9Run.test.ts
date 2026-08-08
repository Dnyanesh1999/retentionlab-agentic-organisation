import { describe, expect, it } from "vitest";

import transcript from "../../../design/specifications/gate-9-live-pipeline-transcript.v1.json";
import researchBrief from "../../../design/specifications/gate-9-live-research-brief.v1.json";
import recoveryRoom from "../../../design/specifications/gate-9-live-recovery-room-artifact.v1.json";
import communicationPlan from "../../../design/specifications/gate-9-live-communication-plan.v2.json";
import managerDecision from "../../../design/specifications/gate-9-live-manager-decision.v1.json";
import { gate9Run, humanizeStatus, shortHash, stageLabel } from "./gate9Run";

describe("gate9Run evidence mapping", () => {
  it("maps the run header directly from the canonical transcript", () => {
    expect(gate9Run.runId).toBe(transcript.run.run_id);
    expect(gate9Run.accountSlug).toBe(transcript.run.account_slug);
    expect(gate9Run.finalStatus).toBe(transcript.run.final_status);
    expect(gate9Run.eventCount).toBe(transcript.run.event_count);
    expect(gate9Run.requiresHumanApproval).toBe(transcript.run.requires_human_approval);
  });

  it("exposes exactly the five current stages in pipeline order", () => {
    expect(gate9Run.stages.map((stage) => stage.id)).toEqual([
      "researcher",
      "designer",
      "maker",
      "communicator",
      "manager",
    ]);
  });

  it("resolves every stage version, status, hash and provenance from the transcript attempts", () => {
    for (const stage of gate9Run.stages) {
      const attempt = transcript.stage_attempts.find(
        (entry) => entry.stage === stage.id && entry.is_current,
      );
      expect(attempt).toBeDefined();
      expect(stage.version).toBe(attempt!.version);
      expect(stage.statusLabel).toBe(attempt!.status_label);
      expect(stage.sha256).toBe(attempt!.sha256);
      expect(stage.provenance.resolvedModel).toBe(attempt!.provenance.resolved_model);
      expect(stage.provenance.promptVersion).toBe(attempt!.provenance.prompt_version);
    }
  });

  it("carries the cumulative transformation proof for each stage", () => {
    for (const proof of transcript.cumulative_work_proof) {
      const stage = gate9Run.stages.find((entry) => entry.id === proof.stage);
      expect(stage?.transformation).toBe(proof.transformation);
    }
  });

  it("flattens exactly the seven verified lineage links", () => {
    const flattened = transcript.lineage.flatMap((entry) => entry.links);
    expect(gate9Run.lineageLinks).toHaveLength(flattened.length);
    expect(gate9Run.lineageLinks).toHaveLength(7);
    expect(gate9Run.lineageLinks.every((link) => link.verified)).toBe(true);
  });

  it("attaches the Communicator failure -> operator retry -> v2 recovery", () => {
    const failure = transcript.stage_failures[0];
    const retry = transcript.failed_stage_retries[0];

    expect(gate9Run.recovery.stage).toBe("communicator");
    expect(gate9Run.recovery.failedVersion).toBe(retry.failed_version);
    expect(gate9Run.recovery.rerunVersion).toBe(retry.rerun_version);
    expect(gate9Run.recovery.failureError).toBe(failure.error);
    expect(gate9Run.recovery.operatorReason).toBe(retry.operator_reason);
    expect(gate9Run.recovery.recovered).toBe(true);

    const communicator = gate9Run.stages.find((stage) => stage.id === "communicator");
    expect(communicator?.recovery).not.toBeNull();
    expect(communicator?.version).toBe(2);
  });

  it("mirrors the sealed Manager governance outcome", () => {
    expect(gate9Run.managerOutcome).toEqual({
      decided: transcript.manager_outcome.decided,
      decision: transcript.manager_outcome.decision,
      permittedNextAction: transcript.manager_outcome.permitted_next_action,
      humanApprovalRequired: transcript.manager_outcome.human_approval_required,
      autonomousExternalActions: transcript.manager_outcome.autonomous_external_actions,
      chainVerified: transcript.manager_outcome.chain_verified,
    });
    expect(gate9Run.managerOutcome.autonomousExternalActions).toBe(false);
    expect(gate9Run.managerOutcome.chainVerified).toBe(true);
    expect(gate9Run.managerOutcome.permittedNextAction).toBe("await_human_approval");
    expect(gate9Run.finalStatus).toBe("awaiting_human_approval");
  });

  it("sources stage detail from the matching stage artefacts", () => {
    const researcher = gate9Run.stages.find((stage) => stage.id === "researcher");
    if (researcher?.detail.kind !== "researcher") throw new Error("researcher detail missing");
    expect(researcher.detail.summary).toBe(researchBrief.brief_summary);
    expect(researcher.detail.observations[0].evidenceKey).toBe(
      researchBrief.observations[0].citations[0].evidence_key,
    );

    const maker = gate9Run.stages.find((stage) => stage.id === "maker");
    if (maker?.detail.kind !== "maker") throw new Error("maker detail missing");
    expect(maker.detail.commitSha).toBe(recoveryRoom.implementation_evidence.commit_sha);

    const communicator = gate9Run.stages.find((stage) => stage.id === "communicator");
    if (communicator?.detail.kind !== "communicator") throw new Error("communicator detail missing");
    expect(communicator.detail.emailSubject).toBe(communicationPlan.email_invitation.subject);

    const manager = gate9Run.stages.find((stage) => stage.id === "manager");
    if (manager?.detail.kind !== "manager") throw new Error("manager detail missing");
    expect(manager.detail.trustEvaluation).toHaveLength(
      Object.keys(managerDecision.trust_evaluation).length,
    );
  });

  it("preserves the standing governance boundaries and human-review focus", () => {
    expect(gate9Run.governanceBoundaries).toEqual(managerDecision.governance.boundaries);
    expect(gate9Run.humanReviewFocus).toEqual(managerDecision.human_review_focus);
  });

  it("provides honest display helpers", () => {
    expect(humanizeStatus("ready_for_manager")).toBe("ready for manager");
    expect(shortHash("a".repeat(64))).toBe(`${"a".repeat(12)}…`);
    expect(stageLabel("manager")).toBe("Manager");
  });
});
