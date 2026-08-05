// @vitest-environment node

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceGateway, EvidenceToolName } from "../../mcp/evidenceClient.js";
import type { ResearcherInput } from "./contracts.js";
import type { ResearcherModelAdapter } from "./model.js";
import { makeEnvelope, runResearcher, writeResearcherArtifact } from "./run.js";

const input: ResearcherInput = {
  run_id: "18a7e151-9e3b-4fd5-90de-2bba2ab54860",
  account_slug: "copper-finch",
  objective: "Investigate current retention risk with fresh evidence and consent boundaries.",
  initiated_at: "2026-08-05T12:00:00.000Z",
};

const evidenceKeys: Record<EvidenceToolName, string> = {
  get_account_snapshot: "account:copper-finch:profile",
  list_product_signals: "product:copper-finch:activation",
  list_billing_events: "billing:copper-finch:invoice-1",
  list_support_events: "support:copper-finch:ticket-1",
  get_preference_profile: "preference:copper-finch:consent",
  list_vendor_status: "vendor:status-page:current",
  get_evidence_item: "account:copper-finch:profile",
};

function gateway(): EvidenceGateway {
  return {
    call: async (tool) => makeEnvelope(
      tool,
      { records: [{ evidence_key: evidenceKeys[tool], synthetic_value: `${tool}-fresh` }] },
      "2026-08-05T12:00:10.000Z",
    ),
  };
}

const model: ResearcherModelAdapter = {
  requestedModel: "openrouter/free",
  async generate(researchInput, evidence) {
    const tools: EvidenceToolName[] = [
      "get_account_snapshot",
      "list_product_signals",
      "list_billing_events",
      "list_support_events",
      "get_preference_profile",
    ];
    expect(evidence.calls.map((call) => call.tool)).toEqual(tools);

    const citation = (tool: EvidenceToolName) => ({
      evidence_key: evidenceKeys[tool],
      source_tool: tool,
      source_system: "Supabase Postgres",
      retrieved_at: "2026-08-05T12:00:10.000Z",
    });

    return {
      resolvedModel: "openai/gpt-oss-120b:free",
      text: JSON.stringify({
        schema_version: "research-brief.v1",
        stage: "researcher",
        status: "completed",
        agent: { id: "researcher", name: "Nia Calder", personality: "forensic, humane, constructively sceptical" },
        run_id: researchInput.run_id,
        account_slug: researchInput.account_slug,
        brief_summary: "Live product, billing, support, and preference evidence indicates a design opportunity requiring careful validation.",
        observations: [{
          claim: "A fresh product signal is present and should be considered with the other account evidence.",
          significance: "high",
          confidence: 0.86,
          citations: [citation("list_product_signals")],
        }],
        hypotheses: [{
          statement: "The observed signal may indicate a gap between expected and realised value.",
          confidence: 0.63,
          supporting_evidence_keys: [evidenceKeys.list_product_signals],
          disconfirming_evidence_needed: "A fresh interview or later usage evidence showing the expected outcome was achieved.",
        }],
        consent_boundaries: {
          allowed_channels: ["in-product"],
          prohibited_actions: ["Do not use channels absent from the current preference profile."],
          citations: [citation("get_preference_profile")],
        },
        unknowns: ["The account's future intent is not observable in the current evidence."],
        designer_handoff: {
          design_challenge: "Create a consent-safe intervention that makes realised value legible without overstating the evidence.",
          priority_outcomes: ["Clarify realised value", "Reduce unresolved friction"],
          non_negotiables: ["Respect the current preference profile", "Keep hypotheses visibly uncertain"],
          success_signals: ["Verified product engagement", "No consent-policy violation"],
        },
        provenance: {
          provider: "openrouter",
          requested_model: "will-be-overwritten",
          resolved_model: "will-be-overwritten",
          prompt_version: "researcher.v1.0.0",
          generated_at: "2026-08-05T12:00:20.000Z",
          tool_calls: tools,
          all_sources_no_store: true,
        },
      }),
    };
  },
};

describe("Researcher runtime", () => {
  it("runs through MCP, validates citations, seals provenance, and writes a visible artefact", async () => {
    const brief = await runResearcher({
      input,
      gateway: gateway(),
      model,
      now: () => new Date("2026-08-05T12:00:30.000Z"),
    });

    expect(brief.provenance).toMatchObject({
      requested_model: "openrouter/free",
      resolved_model: "openai/gpt-oss-120b:free",
      generated_at: "2026-08-05T12:00:30.000Z",
      all_sources_no_store: true,
    });
    expect(brief.provenance.tool_calls).toEqual([
      "get_account_snapshot",
      "list_product_signals",
      "list_billing_events",
      "list_support_events",
      "get_preference_profile",
    ]);

    const directory = await mkdtemp(join(tmpdir(), "retentionlab-researcher-"));
    const artifactPath = join(directory, "research-brief.json");
    await writeResearcherArtifact(brief, artifactPath);
    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Record<string, unknown>;
    expect(artifact).toMatchObject({ stage: "researcher", status: "completed", account_slug: "copper-finch" });
  });

  it("rejects a model citation that was not returned by the live MCP session", async () => {
    const dishonestModel: ResearcherModelAdapter = {
      ...model,
      async generate(researchInput, evidence) {
        const generated = await model.generate(researchInput, evidence);
        return { ...generated, text: generated.text.replace("product:copper-finch:activation", "product:copper-finch:invented") };
      },
    };

    await expect(runResearcher({ input, gateway: gateway(), model: dishonestModel }))
      .rejects.toThrow("unknown evidence key");
  });
});
