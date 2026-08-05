import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { loadEvidenceConfiguration } from "../../mcp/config.js";
import { LiveEvidenceClient } from "../../mcp/evidenceClient.js";
import { loadResearcherConfiguration } from "./config.js";
import { OpenRouterResearcherModel } from "./model.js";
import { runResearcher, writeResearcherArtifact } from "./run.js";

const accountSlug = process.argv[2] ?? "copper-finch";
const objective = process.argv[3] ?? "Identify evidence-backed retention risks and consent-safe design opportunities for this account.";
const runId = randomUUID();
const initiatedAt = new Date().toISOString();

const brief = await runResearcher({
  input: { run_id: runId, account_slug: accountSlug, objective, initiated_at: initiatedAt },
  gateway: new LiveEvidenceClient(loadEvidenceConfiguration()),
  model: new OpenRouterResearcherModel(loadResearcherConfiguration()),
});

const artifactPath = resolve("artifacts", "gate-4", runId, "research-brief.json");
await writeResearcherArtifact(brief, artifactPath);
console.log(JSON.stringify({ run_id: runId, stage: brief.stage, status: brief.status, artifact: artifactPath }));

