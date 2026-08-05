import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { evidenceToolNames } from "../mcp/evidenceClient.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--env-file-if-exists=.env.local", "dist-mcp/stdio.js"],
  cwd: process.cwd(),
  stderr: "pipe",
});
const client = new Client({ name: "retentionlab-live-proof", version: "1.0.0" });

try {
  await client.connect(transport);
  const server = client.getServerVersion();
  const listed = await client.listTools();
  const snapshot = await client.callTool({
    name: "get_account_snapshot",
    arguments: { account_slug: "copper-finch" },
  });

  if (snapshot.isError || !snapshot.structuredContent || typeof snapshot.structuredContent !== "object") {
    throw new Error("Live snapshot tool did not return structured content.");
  }
  const snapshotContent = snapshot.structuredContent as Record<string, unknown>;
  const source = snapshotContent.source as Record<string, unknown> | undefined;
  const data = snapshotContent.data as Record<string, unknown> | undefined;
  const productSignals = data?.product_signals;
  if (!Array.isArray(productSignals) || !productSignals[0] || typeof productSignals[0] !== "object") {
    throw new Error("Live snapshot contained no product evidence.");
  }
  const evidenceKey = (productSignals[0] as Record<string, unknown>).evidence_key;
  if (typeof evidenceKey !== "string") throw new Error("Live evidence key was missing.");

  const evidence = await client.callTool({
    name: "get_evidence_item",
    arguments: { evidence_key: evidenceKey },
  });
  if (evidence.isError) throw new Error("Evidence resolver returned a tool error.");

  const remainingCalls = await Promise.all([
    client.callTool({ name: "list_product_signals", arguments: { account_slug: "copper-finch", limit: 10 } }),
    client.callTool({ name: "list_billing_events", arguments: { account_slug: "copper-finch", limit: 10 } }),
    client.callTool({ name: "list_support_events", arguments: { account_slug: "copper-finch", limit: 10 } }),
    client.callTool({ name: "get_preference_profile", arguments: { account_slug: "copper-finch" } }),
    client.callTool({ name: "list_vendor_status", arguments: { limit: 10 } }),
  ]);
  if (remainingCalls.some((result) => result.isError || !result.structuredContent)) {
    throw new Error("At least one allow-listed live evidence tool failed.");
  }

  const deliberateFailure = await client.callTool({
    name: "get_account_snapshot",
    arguments: { account_slug: "account-that-does-not-exist" },
  });
  if (!deliberateFailure.isError || deliberateFailure.structuredContent !== undefined) {
    throw new Error("Failure path did not fail closed.");
  }

  process.stdout.write(`${JSON.stringify({
    initialize: server,
    tools_list: listed.tools.map((tool) => tool.name),
    expected_tools: evidenceToolNames,
    live_tool: snapshotContent.tool,
    evidence_key: evidenceKey,
    retrieved_at: source?.retrieved_at,
    cache_mode: source?.cache_mode,
    evidence_resolved: Boolean(evidence.structuredContent),
    all_live_tools_passed: remainingCalls.length + 2,
    failure_has_no_structured_evidence: deliberateFailure.structuredContent === undefined,
  }, null, 2)}\n`);
} finally {
  await client.close();
}
