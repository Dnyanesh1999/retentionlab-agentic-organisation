import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { loadMakerConfiguration } from "./config.js";
import { makerImplementationEvidenceSchema } from "./contracts.js";
import { OpenRouterMakerModel } from "./model.js";
import { runMaker, writeMakerArtifact } from "./run.js";

const predecessorPath = process.argv[2];
const implementationPath = process.argv[3];
if (!predecessorPath || !implementationPath) {
  throw new Error("Usage: npm run agent:maker -- <design-specification.json> <implementation-evidence.json>");
}

const specification = recoveryDesignSpecificationSchema.parse(
  JSON.parse(await readFile(resolve(predecessorPath), "utf8")) as unknown,
);
const implementation = makerImplementationEvidenceSchema.parse(
  JSON.parse(await readFile(resolve(implementationPath), "utf8")) as unknown,
);
const artifact = await runMaker({
  input: { run_id: specification.run_id, design_specification: specification },
  implementation,
  model: new OpenRouterMakerModel(loadMakerConfiguration()),
});
const artifactPath = resolve("artifacts", "gate-6", artifact.run_id, "recovery-room-artifact.json");
await writeMakerArtifact(artifact, artifactPath);
console.log(JSON.stringify({
  run_id: artifact.run_id,
  stage: artifact.stage,
  status: artifact.status,
  artifact: artifactPath,
}));
