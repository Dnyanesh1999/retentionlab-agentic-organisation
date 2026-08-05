import { z } from "zod";

import { evidenceToolNames } from "../../mcp/evidenceClient.js";

export const RESEARCHER_PROMPT_VERSION = "researcher.v1.1.0" as const;
export const RESEARCHER_SCHEMA_VERSION = "research-brief.v1" as const;
export const researcherPromptVersionSchema = z.enum(["researcher.v1.0.0", RESEARCHER_PROMPT_VERSION]);

const accountSlugSchema = z.string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

export const researcherInputSchema = z.object({
  run_id: z.string().uuid(),
  account_slug: accountSlugSchema,
  objective: z.string().min(20).max(500),
  initiated_at: z.string().datetime({ offset: true }),
}).strict();

export const evidenceCitationSchema = z.object({
  evidence_key: z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160),
  source_tool: z.enum(evidenceToolNames),
  source_system: z.literal("Supabase Postgres"),
  retrieved_at: z.string().datetime({ offset: true }),
}).strict();

const citedObservationSchema = z.object({
  claim: z.string().min(8).max(500),
  significance: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  citations: z.array(evidenceCitationSchema).min(1),
}).strict();

export const researchBriefSchema = z.object({
  schema_version: z.literal(RESEARCHER_SCHEMA_VERSION),
  stage: z.literal("researcher"),
  status: z.enum(["completed", "insufficient_evidence"]),
  agent: z.object({
    id: z.literal("researcher"),
    name: z.literal("Nia Calder"),
    personality: z.literal("forensic, humane, constructively sceptical"),
  }).strict(),
  run_id: z.string().uuid(),
  account_slug: accountSlugSchema,
  brief_summary: z.string().min(20).max(1_500),
  observations: z.array(citedObservationSchema).max(12),
  hypotheses: z.array(z.object({
    statement: z.string().min(8).max(500),
    confidence: z.number().min(0).max(1),
    supporting_evidence_keys: z.array(evidenceCitationSchema.shape.evidence_key).min(1),
    disconfirming_evidence_needed: z.string().min(8).max(500),
  }).strict()).max(8),
  consent_boundaries: z.object({
    allowed_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_actions: z.array(z.string().min(3).max(240)).min(1).max(10),
    citations: z.array(evidenceCitationSchema).min(1),
  }).strict(),
  unknowns: z.array(z.string().min(5).max(300)).min(1).max(10),
  designer_handoff: z.object({
    design_challenge: z.string().min(20).max(800),
    priority_outcomes: z.array(z.string().min(5).max(240)).min(1).max(6),
    non_negotiables: z.array(z.string().min(5).max(240)).min(1).max(8),
    success_signals: z.array(z.string().min(5).max(240)).min(1).max(8),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: researcherPromptVersionSchema,
    generated_at: z.string().datetime({ offset: true }),
    tool_calls: z.array(z.enum(evidenceToolNames)).min(5),
    all_sources_no_store: z.literal(true),
  }).strict(),
}).strict().superRefine((brief, context) => {
  if (brief.status === "completed" && brief.observations.length === 0) {
    context.addIssue({ code: "custom", path: ["observations"], message: "Completed research requires cited observations." });
  }
});

export type ResearcherInput = z.infer<typeof researcherInputSchema>;
export type ResearchBrief = z.infer<typeof researchBriefSchema>;
