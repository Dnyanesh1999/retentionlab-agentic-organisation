import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  COMMUNICATION_PLAN_SCHEMA_VERSION,
  COMMUNICATOR_PROMPT_VERSION,
  communicationDraftSchema,
  communicationPlanSchema,
  communicatorInputSchema,
  type CommunicationPlan,
  type CommunicatorInput,
} from "./contracts.js";
import type { CommunicatorModelAdapter } from "./model.js";

export function hashMakerArtifact(artifact: CommunicatorInput["recovery_room_artifact"]) {
  return createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function numericTokens(value: string) {
  return value.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
}

export function assertCommunicatorIntegrity(input: CommunicatorInput, plan: CommunicationPlan) {
  const maker = input.recovery_room_artifact;
  const sourceClaims = new Map(maker.communicator_handoff.supported_claims.map((claim) => [claim.claim, claim]));
  for (const message of plan.message_claims) {
    const citedClaims = message.source_claims.map((claim) => {
      const source = sourceClaims.get(claim);
      if (!source) {
        throw new Error(
          `Communicator cited a claim absent from the Maker handoff. Copy source_claims byte-for-byte from this exact allow-list: ${JSON.stringify([...sourceClaims.keys()])}`,
        );
      }
      return source;
    });
    const allowedKeys = new Set(citedClaims.flatMap((claim) => claim.source_evidence_keys));
    if (message.evidence_keys.some((key) => !allowedKeys.has(key))) {
      throw new Error("Communicator attached evidence not carried by its cited Maker claims.");
    }
    const allowedNumbers = new Set(citedClaims.flatMap((claim) => numericTokens(claim.claim)));
    const inventedNumber = numericTokens(message.message).find((number) => !allowedNumbers.has(number));
    if (inventedNumber) throw new Error(`Communicator invented a numeric claim: ${inventedNumber}`);
  }

  if (!sameStringSet(plan.inherited_boundaries.available_channels, maker.communicator_handoff.available_channels)) {
    throw new Error("Communicator changed inherited available channels.");
  }
  if (!sameStringSet(plan.inherited_boundaries.prohibited_claims, maker.communicator_handoff.prohibited_claims)) {
    throw new Error("Communicator changed inherited prohibited claims.");
  }

  const copy = JSON.stringify({
    thesis: plan.campaign_thesis,
    email: plan.email_invitation,
    claims: plan.message_claims,
    transparency: plan.transparency,
  });
  const coercive = copy.match(/act now|limited time|last chance|don't miss|urgent|win[- ]?back|churn(?:ing|ed)?|save your account|at risk/i)?.[0];
  if (coercive) throw new Error(`Communicator introduced coercive or stigmatising language: ${coercive}`);
  const overclaim = copy.match(/personal usage|individual usage|explains? why|identif(?:y|ies) the cause|caused by|guarantee[ds]?/i)?.[0];
  if (overclaim) throw new Error(`Communicator overstated aggregate evidence: ${overclaim}`);
  if (/book|buy|upgrade|schedule|call|share/i.test(plan.email_invitation.cta_label)) {
    throw new Error("Communicator CTA exceeds the view-only invitation boundary.");
  }

  const customerCopy = [
    plan.email_invitation.subject,
    plan.email_invitation.preheader,
    ...plan.email_invitation.body_paragraphs,
    plan.transparency.why_received,
    plan.transparency.data_boundary,
    plan.transparency.choice_statement,
  ];
  if (customerCopy.some((value) => /[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?/i.test(value))) {
    throw new Error(
      "Communicator exposed an internal evidence identifier in customer-facing copy. Remove every bracketed product:/support:/preference: identifier from email and transparency strings; keep identifiers only in message_claims.evidence_keys.",
    );
  }
  const incomplete = [
    ...plan.email_invitation.body_paragraphs,
    plan.transparency.why_received,
    plan.transparency.data_boundary,
    plan.transparency.choice_statement,
  ].find((value) => !/[.!?]["']?$/.test(value.trim()));
  if (incomplete) throw new Error("Communicator produced incomplete customer-facing copy.");
}

export async function runCommunicator(options: {
  input: CommunicatorInput;
  model: CommunicatorModelAdapter;
  now?: () => Date;
}): Promise<CommunicationPlan> {
  const input = communicatorInputSchema.parse(options.input);
  let revision: { validation_error: string; previous_output: string } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const generated = await options.model.generate(input, revision);
    try {
      const draft = communicationDraftSchema.parse(JSON.parse(generated.text) as unknown);
      const maker = input.recovery_room_artifact;
      const plan = communicationPlanSchema.parse({
        ...draft,
        schema_version: COMMUNICATION_PLAN_SCHEMA_VERSION,
        stage: "communicator",
        agent: { id: "communicator", name: "Maeve Quinn", personality: "plain-spoken, empathetic, evidence-disciplined" },
        run_id: input.run_id,
        account_slug: maker.account_slug,
        source: {
          maker_schema_version: maker.schema_version,
          maker_prompt_version: maker.provenance.prompt_version,
          maker_generated_at: maker.provenance.generated_at,
          maker_artifact_sha256: hashMakerArtifact(maker),
          implementation_commit_sha: maker.implementation_evidence.commit_sha,
        },
        inherited_boundaries: {
          available_channels: maker.communicator_handoff.available_channels,
          prohibited_claims: maker.communicator_handoff.prohibited_claims,
          required_disclosures: maker.communicator_handoff.required_disclosures,
        },
        provenance: {
          provider: "openrouter",
          requested_model: options.model.requestedModel,
          resolved_model: generated.resolvedModel,
          prompt_version: COMMUNICATOR_PROMPT_VERSION,
          generated_at: (options.now ?? (() => new Date()))().toISOString(),
        },
      });
      assertCommunicatorIntegrity(input, plan);
      return plan;
    } catch (error) {
      lastError = error;
      revision = {
        validation_error: error instanceof Error ? error.message : "CommunicationPlan failed deterministic validation.",
        previous_output: generated.text,
      };
    }
  }
  throw lastError;
}

export async function writeCommunicationPlan(plan: CommunicationPlan, artifactPath: string) {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(communicationPlanSchema.parse(plan), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}
