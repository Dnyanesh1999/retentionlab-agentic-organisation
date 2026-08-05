import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  EvidenceSourceError,
  evidenceEnvelopeSchema,
  type EvidenceEnvelope,
  type EvidenceGateway,
  type EvidenceToolName,
} from "./evidenceClient.js";

const slugSchema = z.string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80)
  .describe("Fictional account slug returned by RetentionLab, for example copper-finch.");

const limitSchema = z.number().int().min(1).max(50).default(20)
  .describe("Maximum number of live source records to return.");

const accountOnlySchema = z.object({ account_slug: slugSchema }).strict();
const accountListSchema = z.object({ account_slug: slugSchema, limit: limitSchema.optional() }).strict();
const limitOnlySchema = z.object({ limit: limitSchema.optional() }).strict();
const evidenceItemSchema = z.object({
  evidence_key: z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160),
}).strict();

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

async function toolResult(
  gateway: EvidenceGateway,
  tool: EvidenceToolName,
  args: Record<string, unknown>,
) {
  try {
    const envelope = await gateway.call(tool, args);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
      structuredContent: envelope,
    };
  } catch (error) {
    const message = error instanceof EvidenceSourceError
      ? `${error.message} (source status ${error.status})`
      : "Live evidence tool failed without a cached fallback.";
    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
    };
  }
}

export function createRetentionLabMcpServer(gateway: EvidenceGateway) {
  const server = new McpServer(
    { name: "retentionlab-evidence", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Read-only tools for fresh fictional RetentionLab evidence. Cite evidence_key and source.retrieved_at. Never represent a failed tool call as live evidence.",
    },
  );

  server.registerTool(
    "get_account_snapshot",
    {
      title: "Get account snapshot",
      description: "Fetch one fresh, joined account snapshot from Supabase including product, billing, support and consent evidence.",
      inputSchema: accountOnlySchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "get_account_snapshot", args),
  );

  server.registerTool(
    "list_product_signals",
    {
      title: "List product signals",
      description: "Fetch current product adoption and utilisation evidence for a fictional account.",
      inputSchema: accountListSchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "list_product_signals", args),
  );

  server.registerTool(
    "list_billing_events",
    {
      title: "List billing events",
      description: "Fetch current invoice and payment evidence for a fictional account.",
      inputSchema: accountListSchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "list_billing_events", args),
  );

  server.registerTool(
    "list_support_events",
    {
      title: "List support events",
      description: "Fetch current support status, severity and synthetic sentiment evidence for a fictional account.",
      inputSchema: accountListSchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "list_support_events", args),
  );

  server.registerTool(
    "get_preference_profile",
    {
      title: "Get consent preference profile",
      description: "Fetch the current consent and outreach boundaries for a fictional account.",
      inputSchema: accountOnlySchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "get_preference_profile", args),
  );

  server.registerTool(
    "list_vendor_status",
    {
      title: "List vendor status",
      description: "Fetch current fictional upstream-service status evidence for the ready dataset.",
      inputSchema: limitOnlySchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "list_vendor_status", args),
  );

  server.registerTool(
    "get_evidence_item",
    {
      title: "Get evidence item",
      description: "Resolve one stable evidence_key to its fresh source record and source table.",
      inputSchema: evidenceItemSchema,
      outputSchema: evidenceEnvelopeSchema,
      annotations: readOnlyAnnotations,
    },
    (args) => toolResult(gateway, "get_evidence_item", args),
  );

  return server;
}

export function asEvidenceEnvelope(value: unknown): EvidenceEnvelope {
  return evidenceEnvelopeSchema.parse(value);
}
