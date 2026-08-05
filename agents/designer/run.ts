import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  DESIGNER_PROMPT_VERSION,
  designerInputSchema,
  recoveryDesignSpecificationSchema,
  type DesignerInput,
  type RecoveryDesignSpecification,
} from "./contracts.js";
import type { DesignerModelAdapter } from "./model.js";

export function hashResearchBrief(brief: DesignerInput["research_brief"]) {
  return createHash("sha256").update(JSON.stringify(brief)).digest("hex");
}

function predecessorEvidenceKeys(input: DesignerInput) {
  return new Set([
    ...input.research_brief.observations.flatMap((item) => item.citations.map((citation) => citation.evidence_key)),
    ...input.research_brief.hypotheses.flatMap((item) => item.supporting_evidence_keys),
    ...input.research_brief.consent_boundaries.citations.map((citation) => citation.evidence_key),
  ]);
}

function designEvidenceKeys(specification: RecoveryDesignSpecification) {
  return [
    ...specification.experience_principles.flatMap((item) => item.source_evidence_keys),
    ...specification.journey.flatMap((item) => item.source_evidence_keys),
    ...specification.maker_handoff.data_bindings.map((item) => item.evidence_key),
  ];
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function normalizeComponentNames(
  components: readonly string[],
  regions: readonly { region_id: string }[],
) {
  const names = components.flatMap((component) => {
    const match = component.match(/\b[A-Z][A-Za-z0-9]+\b/);
    return match ? [match[0]] : [];
  });
  const regionNames = regions.map((region) => (
    `${region.region_id.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join("")}Region`
  ));
  return [...new Set([...names, ...regionNames])];
}

export function assertDesignerIntegrity(input: DesignerInput, specification: RecoveryDesignSpecification) {
  const allowedEvidence = predecessorEvidenceKeys(input);
  for (const evidenceKey of designEvidenceKeys(specification)) {
    if (!allowedEvidence.has(evidenceKey)) {
      throw new Error(`Designer referenced evidence absent from the ResearchBrief: ${evidenceKey}`);
    }
  }

  if (!sameStringSet(
    specification.consent_design.inherited_allowed_channels,
    input.research_brief.consent_boundaries.allowed_channels,
  )) {
    throw new Error("Designer changed inherited allowed channels.");
  }
  if (!sameStringSet(
    specification.consent_design.inherited_prohibited_actions,
    input.research_brief.consent_boundaries.prohibited_actions,
  )) {
    throw new Error("Designer changed inherited prohibited actions.");
  }

  const successSignals = new Set(input.research_brief.designer_handoff.success_signals);
  for (const measurement of specification.measurement_plan) {
    if (!successSignals.has(measurement.source_success_signal)) {
      throw new Error(`Designer measurement is not inherited from Researcher success signals: ${measurement.source_success_signal}`);
    }
  }

  const requiredStates = ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"] as const;
  const suppliedStates = new Set(specification.maker_handoff.interaction_states);
  const missingStates = requiredStates.filter((state) => !suppliedStates.has(state));
  if (missingStates.length > 0) {
    throw new Error(`Designer omitted required Recovery Room states: ${missingStates.join(", ")}`);
  }

  for (const binding of specification.maker_handoff.data_bindings) {
    if (/case_owner|recipient|support_url/i.test(binding.field_path)) {
      throw new Error(`Designer binds contact data absent from evidence: ${binding.field_path}`);
    }
    if (
      /feature_adoption/.test(binding.evidence_key)
      && /recency|last used|individual feature/i.test(binding.display_purpose)
    ) {
      throw new Error(`Aggregate feature-adoption evidence cannot provide granular recency: ${binding.field_path}`);
    }
    if (
      /session_frequency/.test(binding.evidence_key)
      && /relative time|last used|event time/i.test(binding.display_purpose)
    ) {
      throw new Error(`Aggregate session-frequency evidence cannot provide event recency: ${binding.field_path}`);
    }
    if (/tree density|bird|hill coverage|opacity|brightness|light level|ambient light|decorative density|fictional object/i.test(binding.display_purpose)) {
      throw new Error(`Designer decoratively encodes an aggregate as fictional granularity: ${binding.field_path}`);
    }
  }

  const implementationText = JSON.stringify({
    concept: specification.recovery_concept,
    journey: specification.journey,
    handoff: specification.maker_handoff,
  });
  const unsupportedContent = implementationText.match(/\b3D\b|feature tree|generated audio|audio vignette|six features|per-feature|feature tour|underutilised feature|re-engage with one feature|tool station|Canvas Builder|Workflow Router|Data Viewer|case owner email|mailto:|co-variation|weighted average|simulate adjusting|adjusting tension/i)?.[0];
  if (unsupportedContent) {
    throw new Error(`Designer requires unsupported or invented granular experience content: ${unsupportedContent}`);
  }
  if (specification.maker_handoff.reusable_components.some((component) => !/^[A-Z][A-Za-z0-9]+$/.test(component))) {
    throw new Error("Designer component inventory must contain PascalCase React component names only.");
  }
  if (specification.maker_handoff.reusable_components.some((component) => /\.vue\b|\.svelte\b/i.test(component))) {
    throw new Error("Designer handoff targets a framework other than the React project.");
  }
  if (specification.motion_language.transitions.some((transition) => /\binfinite\b/i.test(transition))) {
    throw new Error("Designer motion includes an infinite decorative loop.");
  }
  const accessibilityText = JSON.stringify({
    journey: specification.journey,
    accessibility: specification.accessibility_requirements,
    tests: specification.maker_handoff.acceptance_tests,
  });
  if (
    /focus (?:is )?trapped within (?:the )?(?:canvas|page)|tab order .*loops? within (?:the )?canvas|focus order .*looped within (?:the )?canvas/i
      .test(accessibilityText)
  ) {
    throw new Error("Designer traps keyboard focus outside a modal dialog.");
  }
}

export async function runDesigner(options: {
  input: DesignerInput;
  model: DesignerModelAdapter;
  now?: () => Date;
}): Promise<RecoveryDesignSpecification> {
  const input = designerInputSchema.parse(options.input);
  let revision: { validation_error: string; previous_output: string } | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const generated = await options.model.generate(input, revision);
    try {
      const rawCandidate = JSON.parse(generated.text) as Record<string, unknown>;
      const rawConsent = typeof rawCandidate.consent_design === "object" && rawCandidate.consent_design !== null
        ? rawCandidate.consent_design as Record<string, unknown>
        : {};
      const candidate = recoveryDesignSpecificationSchema.parse({
        ...rawCandidate,
        run_id: input.run_id,
        account_slug: input.research_brief.account_slug,
        source: {
          research_schema_version: input.research_brief.schema_version,
          research_prompt_version: input.research_brief.provenance.prompt_version,
          research_generated_at: input.research_brief.provenance.generated_at,
          research_artifact_sha256: hashResearchBrief(input.research_brief),
        },
        inherited_research_constraints: {
          priority_outcomes: input.research_brief.designer_handoff.priority_outcomes,
          non_negotiables: input.research_brief.designer_handoff.non_negotiables,
          success_signals: input.research_brief.designer_handoff.success_signals,
        },
        consent_design: {
          ...rawConsent,
          inherited_allowed_channels: input.research_brief.consent_boundaries.allowed_channels,
          inherited_prohibited_actions: input.research_brief.consent_boundaries.prohibited_actions,
        },
        provenance: {
          provider: "openrouter",
          requested_model: options.model.requestedModel,
          resolved_model: generated.resolvedModel,
          prompt_version: DESIGNER_PROMPT_VERSION,
          generated_at: (options.now ?? (() => new Date()))().toISOString(),
        },
      });
      const authoritative = recoveryDesignSpecificationSchema.parse({
        ...candidate,
        run_id: input.run_id,
        account_slug: input.research_brief.account_slug,
        source: {
          research_schema_version: input.research_brief.schema_version,
          research_prompt_version: input.research_brief.provenance.prompt_version,
          research_generated_at: input.research_brief.provenance.generated_at,
          research_artifact_sha256: hashResearchBrief(input.research_brief),
        },
        inherited_research_constraints: {
          priority_outcomes: input.research_brief.designer_handoff.priority_outcomes,
          non_negotiables: input.research_brief.designer_handoff.non_negotiables,
          success_signals: input.research_brief.designer_handoff.success_signals,
        },
        consent_design: {
          ...candidate.consent_design,
          inherited_allowed_channels: input.research_brief.consent_boundaries.allowed_channels,
          inherited_prohibited_actions: input.research_brief.consent_boundaries.prohibited_actions,
        },
        maker_handoff: {
          ...candidate.maker_handoff,
          reusable_components: normalizeComponentNames(
            candidate.maker_handoff.reusable_components,
            candidate.content_architecture,
          ),
        },
        provenance: {
          provider: "openrouter",
          requested_model: options.model.requestedModel,
          resolved_model: generated.resolvedModel,
          prompt_version: DESIGNER_PROMPT_VERSION,
          generated_at: (options.now ?? (() => new Date()))().toISOString(),
        },
      });
      assertDesignerIntegrity(input, authoritative);
      if (authoritative.status === "needs_research_revision" && attempt === 1) {
        throw new Error(
          "Before blocking the pipeline, test whether the evidence gap can become an optional, consent-safe clarification interaction. Preserve uncertainty and never invent the answer.",
        );
      }
      return authoritative;
    } catch (error) {
      lastError = error;
      revision = {
        validation_error: error instanceof Error ? error.message : "Designer output failed deterministic validation.",
        previous_output: generated.text,
      };
    }
  }

  throw lastError;
}

export async function writeDesignerArtifact(specification: RecoveryDesignSpecification, artifactPath: string) {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(recoveryDesignSpecificationSchema.parse(specification), null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}
