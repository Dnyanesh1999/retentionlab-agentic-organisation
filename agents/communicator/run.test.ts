import { describe, expect, it } from "vitest";

import type { CommunicatorModelAdapter } from "./model.js";
import { hashMakerArtifact, runCommunicator } from "./run.js";
import { makeCommunicationDraft, makeCommunicatorInput } from "./testFixture.js";

describe("Communicator runtime", () => {
  it("seals Maker lineage and inherited communication boundaries", async () => {
    const input = makeCommunicatorInput();
    const model: CommunicatorModelAdapter = {
      requestedModel: "example/communicator-free",
      async generate() { return { text: JSON.stringify(makeCommunicationDraft(input)), resolvedModel: "example/communicator-free" }; },
    };
    const plan = await runCommunicator({ input, model, now: () => new Date("2026-08-06T03:00:00.000Z") });
    expect(plan.source.maker_artifact_sha256).toBe(hashMakerArtifact(input.recovery_room_artifact));
    expect(plan.inherited_boundaries.available_channels).toEqual(["email"]);
    expect(plan.follow_up_policy).toBe("none_without_new_explicit_consent");
  });

  it("allows one correction when the model invents a source claim", async () => {
    const input = makeCommunicatorInput();
    const invalid = makeCommunicationDraft(input);
    invalid.message_claims[0]!.source_claims = ["RetentionLab guarantees higher adoption."];
    const revisions: string[] = [];
    const model: CommunicatorModelAdapter = {
      requestedModel: "example/communicator-free",
      async generate(_input, revision) {
        if (!revision) return { text: JSON.stringify(invalid), resolvedModel: "example/communicator-free" };
        revisions.push(revision.validation_error);
        return { text: JSON.stringify(makeCommunicationDraft(input)), resolvedModel: "example/communicator-free" };
      },
    };
    const plan = await runCommunicator({ input, model });
    expect(plan.status).toBe("ready_for_manager");
    expect(revisions[0]).toContain("claim absent from the Maker handoff");
    expect(revisions[0]).toContain(input.recovery_room_artifact.communicator_handoff.supported_claims[0]!.claim);
  });

  it("rejects coercive copy even when its evidence citation is valid", async () => {
    const input = makeCommunicatorInput();
    const invalid = makeCommunicationDraft(input);
    invalid.email_invitation.subject = "Act now: your account is at risk";
    const model: CommunicatorModelAdapter = {
      requestedModel: "example/communicator-free",
      async generate() { return { text: JSON.stringify(invalid), resolvedModel: "example/communicator-free" }; },
    };
    await expect(runCommunicator({ input, model })).rejects.toThrow("coercive or stigmatising language");
  });

  it("rejects raw evidence identifiers and truncated customer copy", async () => {
    const input = makeCommunicatorInput();
    const invalid = makeCommunicationDraft(input);
    invalid.email_invitation.body_paragraphs[0] = "See product:copper-finch:feature_adoption:2.";
    invalid.transparency.choice_statement = "You may leave at any";
    const model: CommunicatorModelAdapter = {
      requestedModel: "example/communicator-free",
      async generate() { return { text: JSON.stringify(invalid), resolvedModel: "example/communicator-free" }; },
    };
    await expect(runCommunicator({ input, model })).rejects.toThrow("internal evidence identifier");
  });
});
