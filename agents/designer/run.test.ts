// @vitest-environment node

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { DesignerModelAdapter } from "./model.js";
import { hashResearchBrief, runDesigner, writeDesignerArtifact } from "./run.js";
import { makeDesignerInput, makeDesignSpecification } from "./testFixture.js";

describe("Designer runtime", () => {
  it("seals lineage and inherited consent before writing an immutable artefact", async () => {
    const input = makeDesignerInput();
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      generate: async () => ({
        text: JSON.stringify(makeDesignSpecification(input)),
        resolvedModel: "example/design-free",
      }),
    };
    const specification = await runDesigner({
      input,
      model,
      now: () => new Date("2026-08-05T12:02:00.000Z"),
    });

    expect(specification.source.research_artifact_sha256).toBe(hashResearchBrief(input.research_brief));
    expect(specification.consent_design.inherited_allowed_channels).toEqual(["email"]);
    expect(specification.provenance).toMatchObject({
      requested_model: "openrouter/free",
      resolved_model: "example/design-free",
      generated_at: "2026-08-05T12:02:00.000Z",
    });

    const directory = await mkdtemp(join(tmpdir(), "retentionlab-designer-"));
    const artifactPath = join(directory, "recovery-design-specification.json");
    await writeDesignerArtifact(specification, artifactPath);
    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
    expect(artifact).toMatchObject({ stage: "designer", status: "ready_for_maker" });
  });

  it("rejects evidence and success metrics absent from the ResearchBrief", async () => {
    const input = makeDesignerInput();
    const candidate = makeDesignSpecification(input);
    candidate.maker_handoff.data_bindings[0]!.evidence_key = "product:copper-finch:invented";
    candidate.measurement_plan[0]!.source_success_signal = "Unapproved conversion target";
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      generate: async () => ({ text: JSON.stringify(candidate), resolvedModel: "example/design-free" }),
    };

    await expect(runDesigner({ input, model })).rejects.toThrow("evidence absent from the ResearchBrief");
  });

  it("allows one bounded model revision after deterministic validation feedback", async () => {
    const input = makeDesignerInput();
    const invalid = makeDesignSpecification(input);
    invalid.measurement_plan[0]!.source_success_signal = "Unapproved conversion target";
    const revisions: string[] = [];
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      async generate(_input, revision) {
        if (!revision) return { text: JSON.stringify(invalid), resolvedModel: "example/design-free" };
        revisions.push(revision.validation_error);
        return { text: JSON.stringify(makeDesignSpecification(input)), resolvedModel: "example/design-free" };
      },
    };

    const specification = await runDesigner({ input, model });
    expect(specification.status).toBe("ready_for_maker");
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toContain("not inherited from Researcher success signals");
  });

  it("asks once whether a research gap can become a safe clarification interaction", async () => {
    const input = makeDesignerInput();
    const blocked = makeDesignSpecification(input);
    blocked.status = "needs_research_revision";
    let calls = 0;
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      async generate(_input, revision) {
        calls += 1;
        if (!revision) return { text: JSON.stringify(blocked), resolvedModel: "example/design-free" };
        expect(revision.validation_error).toContain("consent-safe clarification interaction");
        return { text: JSON.stringify(makeDesignSpecification(input)), resolvedModel: "example/design-free" };
      },
    };

    const specification = await runDesigner({ input, model });
    expect(specification.status).toBe("ready_for_maker");
    expect(calls).toBe(2);
  });

  it("rejects a binding that expands aggregate evidence into invented granularity", async () => {
    const input = makeDesignerInput();
    const candidate = makeDesignSpecification(input);
    candidate.maker_handoff.data_bindings[0]!.display_purpose = "Infer per-feature recency and last-used event time.";
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      generate: async () => ({ text: JSON.stringify(candidate), resolvedModel: "example/design-free" }),
    };
    await expect(runDesigner({ input, model })).rejects.toThrow("cannot provide granular recency");
  });

  it("rejects keyboard focus looped inside a non-modal canvas", async () => {
    const input = makeDesignerInput();
    const candidate = makeDesignSpecification(input);
    candidate.journey[0]!.maker_acceptance_criteria[0] =
      "Focus order is logical and looped within the canvas";
    const model: DesignerModelAdapter = {
      requestedModel: "openrouter/free",
      generate: async () => ({ text: JSON.stringify(candidate), resolvedModel: "example/design-free" }),
    };

    await expect(runDesigner({ input, model })).rejects.toThrow("traps keyboard focus outside a modal dialog");
  });
});
