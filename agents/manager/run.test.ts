import { describe, expect, it } from "vitest";

import type { ManagerDecisionDraft } from "./contracts.js";
import type { ManagerModelAdapter } from "./model.js";
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
});
