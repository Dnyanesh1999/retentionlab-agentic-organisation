// @vitest-environment node

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceSourceError, evidenceToolNames, type EvidenceEnvelope, type EvidenceGateway } from "./evidenceClient.js";
import { createRetentionLabMcpServer } from "./server.js";

const openClients: Client[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.close()));
});

function fakeEnvelope(tool: (typeof evidenceToolNames)[number]): EvidenceEnvelope {
  return {
    tool,
    source: {
      system: "Supabase Postgres",
      dataset: "retentionlab-demo-v1",
      generation_run_id: "6c415ff1-83ac-4bd4-955f-963f57fab6a7",
      generated_at: "2026-08-05T09:29:43.925Z",
      retrieved_at: "2026-08-05T10:00:00.000Z",
      cache_mode: "no-store",
    },
    data: { proof: "fresh" },
  };
}

async function connectedClient(gateway: EvidenceGateway) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRetentionLabMcpServer(gateway);
  const client = new Client({ name: "retentionlab-test", version: "1.0.0" });
  openClients.push(client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("RetentionLab MCP server", () => {
  it("completes initialize and exposes exactly the eight allow-listed tools", async () => {
    const gateway: EvidenceGateway = { call: async (tool) => fakeEnvelope(tool) };
    const client = await connectedClient(gateway);
    const listed = await client.listTools();

    expect(client.getServerVersion()).toEqual({ name: "retentionlab-evidence", version: "1.0.0" });
    expect(listed.tools.map((tool) => tool.name)).toEqual(evidenceToolNames);
    expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("returns structured cited content from tools/call", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const gateway: EvidenceGateway = {
      call: async (tool, args) => {
        calls.push({ tool, args });
        return fakeEnvelope(tool);
      },
    };
    const client = await connectedClient(gateway);
    await client.listTools();
    const result = await client.callTool({
      name: "get_account_snapshot",
      arguments: { account_slug: "copper-finch" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      tool: "get_account_snapshot",
      source: { system: "Supabase Postgres", cache_mode: "no-store" },
    });
    expect(calls).toEqual([{
      tool: "get_account_snapshot",
      args: { account_slug: "copper-finch" },
    }]);
  });

  it("lists accounts through the account-independent limit-only tool", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const gateway: EvidenceGateway = {
      call: async (tool, args) => {
        calls.push({ tool, args });
        return fakeEnvelope(tool);
      },
    };
    const client = await connectedClient(gateway);
    await client.listTools();
    const result = await client.callTool({ name: "list_accounts", arguments: { limit: 25 } });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      tool: "list_accounts",
      source: { system: "Supabase Postgres", cache_mode: "no-store" },
    });
    expect(calls).toEqual([{ tool: "list_accounts", args: { limit: 25 } }]);
  });

  it("rejects an out-of-range limit for list_accounts before dispatching", async () => {
    const calls: string[] = [];
    const gateway: EvidenceGateway = {
      call: async (tool) => {
        calls.push(tool);
        return fakeEnvelope(tool);
      },
    };
    const client = await connectedClient(gateway);
    await client.listTools();
    const result = await client.callTool({ name: "list_accounts", arguments: { limit: 99 } });

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it("returns an explicit error and never substitutes cached evidence", async () => {
    const gateway: EvidenceGateway = {
      call: async () => {
        throw new EvidenceSourceError("Live evidence source is unreachable", 503);
      },
    };
    const client = await connectedClient(gateway);
    await client.listTools();
    const result = await client.callTool({ name: "list_vendor_status", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: "Live evidence source is unreachable (source status 503)" },
    ]);
  });
});
