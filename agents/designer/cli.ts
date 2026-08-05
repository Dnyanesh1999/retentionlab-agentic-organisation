import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { researchBriefSchema } from "../researcher/contracts.js";
import { loadDesignerConfiguration } from "./config.js";
import { OpenRouterDesignerModel } from "./model.js";
import { runDesigner, writeDesignerArtifact } from "./run.js";

const predecessorPath = process.argv[2];
if (!predecessorPath) {
  throw new Error("Usage: npm run agent:designer -- <absolute-or-project-relative-research-brief.json>");
}

const researchBrief = researchBriefSchema.parse(JSON.parse(await readFile(resolve(predecessorPath), "utf8")) as unknown);
const specification = await runDesigner({
  input: { run_id: researchBrief.run_id, research_brief: researchBrief },
  model: new OpenRouterDesignerModel(loadDesignerConfiguration()),
});

const artifactPath = resolve(
  "artifacts",
  "gate-5",
  specification.run_id,
  specification.status === "ready_for_maker"
    ? "recovery-design-specification.json"
    : `recovery-design-specification.revision-required.${Date.now()}.json`,
);
await writeDesignerArtifact(specification, artifactPath);
console.log(JSON.stringify({
  run_id: specification.run_id,
  stage: specification.stage,
  status: specification.status,
  artifact: artifactPath,
}));
