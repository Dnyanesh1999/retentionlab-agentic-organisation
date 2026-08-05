import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { loadEvidenceConfiguration } from "./config.js";
import { LiveEvidenceClient } from "./evidenceClient.js";
import { createRetentionLabMcpServer } from "./server.js";

const configuration = loadEvidenceConfiguration();

serveStdio(
  () => createRetentionLabMcpServer(new LiveEvidenceClient(configuration)),
  {
    legacy: "serve",
    onerror: (error) => console.error(`RetentionLab MCP transport error: ${error.message}`),
  },
);
