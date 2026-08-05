import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import {
  asEvidenceEnvelope,
  createRetentionLabMcpServer,
} from "../../mcp/server.js";
import type {
  EvidenceEnvelope,
  EvidenceGateway,
  EvidenceToolName,
} from "../../mcp/evidenceClient.js";

export type EvidenceCall = {
  tool: EvidenceToolName;
  arguments: Record<string, unknown>;
  envelope: EvidenceEnvelope;
};

export interface ResearcherEvidenceAccess {
  readonly calls: readonly EvidenceCall[];
  call(tool: EvidenceToolName, arguments_: Record<string, unknown>): Promise<EvidenceEnvelope>;
}

export async function openResearcherEvidenceSession(gateway: EvidenceGateway) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRetentionLabMcpServer(gateway);
  const client = new Client({ name: "retentionlab-researcher", version: "1.0.0" });
  const calls: EvidenceCall[] = [];

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const access: ResearcherEvidenceAccess = {
    get calls() {
      return calls;
    },
    async call(tool, arguments_) {
      const result = await client.callTool({ name: tool, arguments: arguments_ });
      if (result.isError || result.structuredContent === undefined) {
        const text = result.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join(" ");
        throw new Error(text || `MCP tool ${tool} failed without live structured evidence.`);
      }
      const envelope = asEvidenceEnvelope(result.structuredContent);
      calls.push({ tool, arguments: arguments_, envelope });
      return envelope;
    },
  };

  return {
    access,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

