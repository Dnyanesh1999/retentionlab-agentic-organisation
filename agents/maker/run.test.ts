import { describe, expect, it, vi } from "vitest";

import type { MakerModelAdapter } from "./model.js";
import { hashDesignSpecification, runMaker } from "./run.js";
import { makeMakerDraft, makeMakerImplementation, makeMakerInput } from "./testFixture.js";

describe("Maker runtime", () => {
  it("seals lineage, guardrails and real implementation evidence around the model draft", async () => {
    const input = makeMakerInput();
    const implementation = makeMakerImplementation(input);
    const model: MakerModelAdapter = {
      requestedModel: "example/maker-free",
      async generate() {
        return { text: JSON.stringify(makeMakerDraft(input)), resolvedModel: "example/maker-free" };
      },
    };
    const artifact = await runMaker({
      input,
      implementation,
      model,
      now: () => new Date("2026-08-06T02:30:00.000Z"),
    });

    expect(artifact.source.design_artifact_sha256).toBe(hashDesignSpecification(input.design_specification));
    expect(artifact.implementation_evidence).toEqual(implementation);
    expect(artifact.communicator_handoff.available_channels).toEqual(
      input.design_specification.consent_design.inherited_allowed_channels,
    );
    expect(artifact.provenance.prompt_version).toBe("maker.v1.1.0");
  });

  it("fails before model execution when implementation proof omits a required component", async () => {
    const input = makeMakerInput();
    const implementation = makeMakerImplementation(input);
    const omittedComponent = input.design_specification.maker_handoff.reusable_components[0]!;
    implementation.component_sources = implementation.component_sources.filter(
      (component) => component.contract_component !== omittedComponent,
    );
    implementation.component_sources.push({
      contract_component: "VerifiedShell",
      source_path: "src/features/recovery-room/RecoveryRoomView.tsx",
    });
    const generate = vi.fn();
    const model: MakerModelAdapter = { requestedModel: "example/maker-free", generate };

    await expect(runMaker({ input, implementation, model })).rejects.toThrow(`omits required components: ${omittedComponent}`);
    expect(generate).not.toHaveBeenCalled();
  });

  it("allows one bounded correction when a claim cites evidence outside the Designer handoff", async () => {
    const input = makeMakerInput();
    const invalid = makeMakerDraft(input);
    invalid.communicator_handoff.supported_claims[0]!.source_evidence_keys = ["product:copper-finch:invented:9"];
    const revisions: string[] = [];
    const model: MakerModelAdapter = {
      requestedModel: "example/maker-free",
      async generate(_input, _implementation, revision) {
        if (!revision) return { text: JSON.stringify(invalid), resolvedModel: "example/maker-free" };
        revisions.push(revision.validation_error);
        return { text: JSON.stringify(makeMakerDraft(input)), resolvedModel: "example/maker-free" };
      },
    };

    const artifact = await runMaker({ input, implementation: makeMakerImplementation(input), model });
    expect(artifact.status).toBe("ready_for_communication");
    expect(revisions[0]).toContain("evidence absent from the Designer handoff");
  });

  it("rejects personal or technical framing of aggregate evidence claims", async () => {
    const input = makeMakerInput();
    const invalid = makeMakerDraft(input);
    invalid.communicator_handoff.customer_value = "A personal usage diagnosis that explains why an individual user changed behavior.";
    invalid.communicator_handoff.supported_claims[0]!.claim = "The modal design uses aria-live for personal usage.";
    const model: MakerModelAdapter = {
      requestedModel: "example/maker-free",
      async generate() {
        return { text: JSON.stringify(invalid), resolvedModel: "example/maker-free" };
      },
    };

    await expect(runMaker({
      input,
      implementation: makeMakerImplementation(input),
      model,
    })).rejects.toThrow("overstates aggregate account evidence");
  });
});
