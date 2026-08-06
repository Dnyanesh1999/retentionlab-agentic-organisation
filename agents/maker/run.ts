import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  MAKER_PROMPT_VERSION,
  RECOVERY_ROOM_ARTIFACT_SCHEMA_VERSION,
  makerDraftSchema,
  makerImplementationEvidenceSchema,
  makerInputSchema,
  recoveryRoomArtifactSchema,
  type MakerImplementationEvidence,
  type MakerInput,
  type RecoveryRoomArtifact,
} from "./contracts.js";
import type { MakerModelAdapter } from "./model.js";

export function hashDesignSpecification(specification: MakerInput["design_specification"]) {
  return createHash("sha256").update(JSON.stringify(specification)).digest("hex");
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length
    && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

export function assertMakerImplementationCoverage(
  input: MakerInput,
  implementation: MakerImplementationEvidence,
) {
  const requiredComponents = new Set(input.design_specification.maker_handoff.reusable_components);
  const implementedComponents = new Set(
    implementation.component_sources.map((item) => item.contract_component),
  );
  const missingComponents = [...requiredComponents].filter((component) => !implementedComponents.has(component));
  if (missingComponents.length > 0) {
    throw new Error(`Maker implementation evidence omits required components: ${missingComponents.join(", ")}`);
  }

  if (!sameStringSet(
    implementation.implemented_states,
    input.design_specification.maker_handoff.interaction_states,
  )) throw new Error("Maker implementation states do not exactly cover the Designer handoff.");
}

export function assertMakerIntegrity(input: MakerInput, artifact: RecoveryRoomArtifact) {
  const specification = input.design_specification;
  const allowedEvidence = new Set([
    ...specification.experience_principles.flatMap((principle) => principle.source_evidence_keys),
    ...specification.journey.flatMap((step) => step.source_evidence_keys),
    ...specification.maker_handoff.data_bindings.map((binding) => binding.evidence_key),
  ]);
  for (const claim of artifact.communicator_handoff.supported_claims) {
    for (const key of claim.source_evidence_keys) {
      if (!allowedEvidence.has(key)) {
        throw new Error(`Maker communication claim cites evidence absent from the Designer handoff: ${key}`);
      }
    }
  }

  const communicationText = JSON.stringify({
    audience: artifact.communicator_handoff.audience,
    value: artifact.communicator_handoff.customer_value,
    claims: artifact.communicator_handoff.supported_claims,
  });
  const granularLanguage = communicationText.match(
    /personal usage|individual usage|user-level signal|explains? why|identif(?:y|ies) the cause|caused by|causal insight/i,
  )?.[0];
  if (granularLanguage) {
    throw new Error(`Maker communication handoff overstates aggregate account evidence: ${granularLanguage}`);
  }
  const technicalClaim = artifact.communicator_handoff.supported_claims
    .map((claim) => claim.claim)
    .join(" ")
    .match(/aria-|role\s*=|prefers-reduced-motion|progress bar|component|modal design/i)?.[0];
  if (technicalClaim) {
    throw new Error(`Maker placed a technical implementation assertion in customer evidence claims: ${technicalClaim}`);
  }

  if (!sameStringSet(
    artifact.inherited_guardrails.allowed_channels,
    specification.consent_design.inherited_allowed_channels,
  )) throw new Error("Maker changed inherited allowed channels.");

  if (!sameStringSet(
    artifact.inherited_guardrails.prohibited_actions,
    specification.consent_design.inherited_prohibited_actions,
  )) throw new Error("Maker changed inherited prohibited actions.");

  assertMakerImplementationCoverage(input, artifact.implementation_evidence);

  const requiredRegions = new Set(specification.content_architecture.map((region) => region.region_id));
  const implementedRegions = new Set(artifact.experience_definition.regions.map((region) => region.region_id));
  const missingRegions = [...requiredRegions].filter((region) => !implementedRegions.has(region));
  if (missingRegions.length > 0) {
    throw new Error(`Maker experience definition omits required regions: ${missingRegions.join(", ")}`);
  }
}

export async function runMaker(options: {
  input: MakerInput;
  implementation: MakerImplementationEvidence;
  model: MakerModelAdapter;
  now?: () => Date;
}): Promise<RecoveryRoomArtifact> {
  const input = makerInputSchema.parse(options.input);
  const implementation = makerImplementationEvidenceSchema.parse(options.implementation);
  assertMakerImplementationCoverage(input, implementation);
  let revision: { validation_error: string; previous_output: string } | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const generated = await options.model.generate(input, implementation, revision);
    try {
      const draft = makerDraftSchema.parse(JSON.parse(generated.text) as unknown);
      const artifact = recoveryRoomArtifactSchema.parse({
        ...draft,
        schema_version: RECOVERY_ROOM_ARTIFACT_SCHEMA_VERSION,
        stage: "maker",
        agent: {
          id: "maker",
          name: "Noor Patel",
          personality: "pragmatic, meticulous, accessibility-first",
        },
        run_id: input.run_id,
        account_slug: input.design_specification.account_slug,
        source: {
          design_schema_version: input.design_specification.schema_version,
          design_prompt_version: input.design_specification.provenance.prompt_version,
          design_generated_at: input.design_specification.provenance.generated_at,
          design_artifact_sha256: hashDesignSpecification(input.design_specification),
        },
        inherited_guardrails: {
          allowed_channels: input.design_specification.consent_design.inherited_allowed_channels,
          prohibited_actions: input.design_specification.consent_design.inherited_prohibited_actions,
        },
        implementation_evidence: implementation,
        communicator_handoff: {
          ...draft.communicator_handoff,
          available_channels: input.design_specification.consent_design.inherited_allowed_channels,
          prohibited_claims: input.design_specification.consent_design.inherited_prohibited_actions,
        },
        provenance: {
          provider: "openrouter",
          requested_model: options.model.requestedModel,
          resolved_model: generated.resolvedModel,
          prompt_version: MAKER_PROMPT_VERSION,
          generated_at: (options.now ?? (() => new Date()))().toISOString(),
        },
      });
      assertMakerIntegrity(input, artifact);
      return artifact;
    } catch (error) {
      lastError = error;
      revision = {
        validation_error: error instanceof Error ? error.message : "Maker output failed deterministic validation.",
        previous_output: generated.text,
      };
    }
  }
  throw lastError;
}

export async function writeMakerArtifact(artifact: RecoveryRoomArtifact, artifactPath: string) {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(recoveryRoomArtifactSchema.parse(artifact), null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}
