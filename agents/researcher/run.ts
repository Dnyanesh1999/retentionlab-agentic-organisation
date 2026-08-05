import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { EvidenceEnvelope, EvidenceGateway, EvidenceToolName } from "../../mcp/evidenceClient.js";
import {
  RESEARCHER_PROMPT_VERSION,
  researchBriefSchema,
  researcherInputSchema,
  type ResearchBrief,
  type ResearcherInput,
} from "./contracts.js";
import { openResearcherEvidenceSession, type EvidenceCall } from "./evidenceSession.js";
import type { ResearcherModelAdapter } from "./model.js";

const requiredResearchTools: readonly EvidenceToolName[] = [
  "get_account_snapshot",
  "list_product_signals",
  "list_billing_events",
  "list_support_events",
  "get_preference_profile",
];

type EvidenceIndexValue = { tool: EvidenceToolName; retrievedAt: string };

function collectEvidenceKeys(value: unknown, target: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectEvidenceKeys(item, target));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidence_key" && typeof child === "string") target.add(child);
    collectEvidenceKeys(child, target);
  }
}

function buildEvidenceIndex(calls: readonly EvidenceCall[]) {
  const index = new Map<string, EvidenceIndexValue[]>();
  for (const call of calls) {
    const keys = new Set<string>();
    collectEvidenceKeys(call.envelope.data, keys);
    for (const key of keys) {
      const occurrences = index.get(key) ?? [];
      occurrences.push({ tool: call.tool, retrievedAt: call.envelope.source.retrieved_at });
      index.set(key, occurrences);
    }
  }
  return index;
}

function allCitations(brief: ResearchBrief) {
  return [
    ...brief.observations.flatMap((observation) => observation.citations),
    ...brief.consent_boundaries.citations,
  ];
}

function assertEvidenceIntegrity(brief: ResearchBrief, calls: readonly EvidenceCall[]) {
  const completedTools = new Set(calls.map((call) => call.tool));
  const missing = requiredResearchTools.filter((tool) => !completedTools.has(tool));
  if (missing.length > 0) throw new Error(`Researcher omitted required live MCP tools: ${missing.join(", ")}`);

  const evidenceIndex = buildEvidenceIndex(calls);
  for (const citation of allCitations(brief)) {
    const sources = evidenceIndex.get(citation.evidence_key);
    if (!sources) throw new Error(`Researcher cited unknown evidence key: ${citation.evidence_key}`);
    const exactSource = sources.some((source) => (
      source.tool === citation.source_tool && source.retrievedAt === citation.retrieved_at
    ));
    if (!exactSource) {
      throw new Error(`Researcher citation provenance mismatch: ${citation.evidence_key}`);
    }
  }

  if (!brief.consent_boundaries.citations.every((citation) => citation.source_tool === "get_preference_profile")) {
    throw new Error("Consent boundaries must be cited exclusively to the live preference profile.");
  }

  const supportedKeys = new Set(evidenceIndex.keys());
  for (const hypothesis of brief.hypotheses) {
    for (const key of hypothesis.supporting_evidence_keys) {
      if (!supportedKeys.has(key)) throw new Error(`Hypothesis references unknown evidence key: ${key}`);
    }
  }
}

export async function runResearcher(options: {
  input: ResearcherInput;
  gateway: EvidenceGateway;
  model: ResearcherModelAdapter;
  now?: () => Date;
}): Promise<ResearchBrief> {
  const input = researcherInputSchema.parse(options.input);
  const session = await openResearcherEvidenceSession(options.gateway);
  try {
    // Evidence intake is a runtime invariant, not a model preference. A routed model may
    // choose to answer before using every tool, so the agent runner always establishes the
    // complete fresh baseline through MCP before synthesis begins.
    await session.access.call("get_account_snapshot", { account_slug: input.account_slug });
    await session.access.call("list_product_signals", { account_slug: input.account_slug, limit: 20 });
    await session.access.call("list_billing_events", { account_slug: input.account_slug, limit: 20 });
    await session.access.call("list_support_events", { account_slug: input.account_slug, limit: 20 });
    await session.access.call("get_preference_profile", { account_slug: input.account_slug });

    let revision: { validation_error: string; previous_output: string } | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const generated = await options.model.generate(input, session.access, revision);
      try {
        const candidate = researchBriefSchema.parse(JSON.parse(generated.text) as unknown);
        const authoritative = researchBriefSchema.parse({
          ...candidate,
          run_id: input.run_id,
          account_slug: input.account_slug,
          provenance: {
            provider: "openrouter",
            requested_model: options.model.requestedModel,
            resolved_model: generated.resolvedModel,
            prompt_version: RESEARCHER_PROMPT_VERSION,
            generated_at: (options.now ?? (() => new Date()))().toISOString(),
            tool_calls: session.access.calls.map((call) => call.tool),
            all_sources_no_store: true,
          },
        });
        assertEvidenceIntegrity(authoritative, session.access.calls);
        return authoritative;
      } catch (error) {
        lastError = error;
        revision = {
          validation_error: error instanceof Error ? error.message : "ResearchBrief failed deterministic validation.",
          previous_output: generated.text,
        };
      }
    }
    throw lastError;
  } finally {
    await session.close();
  }
}

export async function writeResearcherArtifact(brief: ResearchBrief, artifactPath: string) {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(researchBriefSchema.parse(brief), null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

export function makeEnvelope(
  tool: EvidenceToolName,
  data: unknown,
  retrievedAt: string,
): EvidenceEnvelope {
  return {
    tool,
    source: {
      system: "Supabase Postgres",
      dataset: "retentionlab-demo-v1",
      generation_run_id: "6c415ff1-83ac-4bd4-955f-963f57fab6a7",
      generated_at: "2026-08-05T09:29:43.925Z",
      retrieved_at: retrievedAt,
      cache_mode: "no-store",
    },
    data,
  };
}
