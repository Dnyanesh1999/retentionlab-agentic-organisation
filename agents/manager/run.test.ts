import { describe, expect, it } from "vitest";

import type { ManagerDecisionDraft } from "./contracts.js";
import type { ManagerModelAdapter, ManagerRevisionFeedback } from "./model.js";
import { runManager, sha256OfArtifact } from "./run.js";
import { makeManagerDecisionDraft, makeManagerInput } from "./testFixture.js";

function stubModel(draft: ManagerDecisionDraft, calls?: { count: number }): ManagerModelAdapter {
  return {
    requestedModel: "example/manager-free",
    async generate() {
      if (calls) calls.count += 1;
      return { text: JSON.stringify(draft), resolvedModel: "example/manager-free" };
    },
  };
}

// Returns each queued draft in turn (repeating the last), recording the revision feedback the
// runtime hands back so a bounded, single-field correction can be asserted.
function sequenceModel(
  drafts: ManagerDecisionDraft[],
  feedback?: ManagerRevisionFeedback[],
): ManagerModelAdapter {
  let index = 0;
  return {
    requestedModel: "example/manager-free",
    async generate(_input, revision) {
      if (revision && feedback) feedback.push(revision);
      const draft = drafts[Math.min(index, drafts.length - 1)];
      index += 1;
      return { text: JSON.stringify(draft), resolvedModel: "example/manager-free" };
    },
  };
}

describe("Manager runtime", () => {
  it("seals verified lineage and the human-approval boundary on approval", async () => {
    const input = makeManagerInput();
    const decision = await runManager({
      input,
      model: stubModel(makeManagerDecisionDraft()),
      now: () => new Date("2026-08-06T04:00:00.000Z"),
    });
    expect(decision.decision).toBe("approve");
    expect(decision.lineage.chain_verified).toBe(true);
    expect(decision.lineage.research_brief_sha256).toBe(sha256OfArtifact(input.research_brief));
    expect(decision.lineage.recovery_room_artifact_sha256).toBe(sha256OfArtifact(input.recovery_room_artifact));
    // The human boundary is runtime-owned and cannot be relaxed by the model.
    expect(decision.governance.human_approval_required).toBe(true);
    expect(decision.governance.autonomous_external_actions).toBe(false);
    expect(decision.governance.permitted_next_action).toBe("await_human_approval");
    expect(decision.revision_directive).toBeUndefined();
  });

  it("refuses to consult the model when a predecessor hash link is broken", async () => {
    const input = makeManagerInput();
    input.recovery_room_artifact.source.design_artifact_sha256 = "f".repeat(64);
    const calls = { count: 0 };
    await expect(runManager({ input, model: stubModel(makeManagerDecisionDraft(), calls) }))
      .rejects.toThrow("does not link to this Designer specification by SHA-256");
    expect(calls.count).toBe(0);
  });

  it("rejects a mismatched run before any model use", async () => {
    const input = makeManagerInput();
    input.communication_plan.run_id = "53fc0231-1c57-4f47-b4a2-06d78de1a825";
    const calls = { count: 0 };
    await expect(runManager({ input, model: stubModel(makeManagerDecisionDraft(), calls) }))
      .rejects.toThrow("same run_id");
    expect(calls.count).toBe(0);
  });

  it("cannot approve a communication plan the Communicator paused for revision", async () => {
    const input = makeManagerInput();
    input.communication_plan.manager_handoff.launch_recommendation = "pause_for_revision";
    await expect(runManager({ input, model: stubModel(makeManagerDecisionDraft()) }))
      .rejects.toThrow("paused for revision");
  });

  it("bounds a revision to one target stage and re-runs exactly its downstream stages", async () => {
    const input = makeManagerInput();
    const draft = makeManagerDecisionDraft();
    draft.decision = "revise";
    draft.revision_directive = {
      target_stage: "designer",
      required_changes: ["Make the decline path visually equal to the primary invitation at every permission moment."],
      reason: "The specification allows the decline path to read as secondary, which undermines genuine consent.",
    };
    const decision = await runManager({ input, model: stubModel(draft) });
    expect(decision.decision).toBe("revise");
    expect(decision.governance.permitted_next_action).toBe("route_targeted_revision");
    expect(decision.revision_directive?.target_stage).toBe("designer");
    expect(decision.revision_directive?.downstream_stages_to_rerun).toEqual(["maker", "communicator"]);
  });

  it("requires a targeted directive for a reject decision", async () => {
    const input = makeManagerInput();
    const draft = makeManagerDecisionDraft();
    draft.decision = "reject";
    await expect(runManager({ input, model: stubModel(draft) }))
      .rejects.toThrow("must target one stage");
  });

  it("rejects a schema-valid decision whose prose ends mid-sentence", async () => {
    const input = makeManagerInput();
    const truncated = makeManagerDecisionDraft();
    // Schema-valid length, but the summary stops mid-word exactly like the rejected manager.v1.0.0.
    truncated.executive_summary =
      "The four-stage chain is coherent, evidence-traceable and consent-safe, and it is ready for a named human to make the final approval ca";
    await expect(runManager({ input, model: stubModel(truncated) }))
      .rejects.toThrow(/executive_summary is not a complete sentence and appears truncated/);
  });

  it("rejects a decision that leaks an unexpected CJK glyph into a review item", async () => {
    const input = makeManagerInput();
    const glyphed = makeManagerDecisionDraft();
    // Ends with valid punctuation, so only the glyph check can catch the stray character.
    glyphed.human_review_focus[0] =
      "Confirm the named human honours every decline path with no implied 义务.";
    await expect(runManager({ input, model: stubModel(glyphed) }))
      .rejects.toThrow(/human_review_focus\[0\] contains an unexpected glyph/);
  });

  it("accepts the decision after a bounded single-field correction of truncated prose", async () => {
    const input = makeManagerInput();
    const truncated = makeManagerDecisionDraft();
    truncated.executive_summary =
      "The four-stage chain is coherent, evidence-traceable and consent-safe, and it is ready for a named human to make the final approval ca";
    const feedback: ManagerRevisionFeedback[] = [];
    const decision = await runManager({
      input,
      model: sequenceModel([truncated, makeManagerDecisionDraft()], feedback),
      now: () => new Date("2026-08-06T04:00:00.000Z"),
    });
    expect(decision.decision).toBe("approve");
    // The correction feedback was bounded to the single offending field.
    expect(feedback).toHaveLength(1);
    expect(feedback[0]?.validation_error).toContain("executive_summary");
    expect(feedback[0]?.validation_error).toContain("complete sentence");
    expect(decision.provenance.prompt_version).toBe("manager.v1.1.0");
  });
});
