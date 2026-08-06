import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { communicationPlanSchema } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { researchBriefSchema } from "../researcher/contracts.js";
import { loadManagerConfiguration } from "./config.js";
import { OpenRouterManagerModel } from "./model.js";
import { runManager, writeManagerDecision } from "./run.js";

const [researchPath, designPath, makerPath, communicationPath] = process.argv.slice(2);
if (!researchPath || !designPath || !makerPath || !communicationPath) {
  throw new Error(
    "Usage: npm run agent:manager -- <research-brief.json> <recovery-design.json> <recovery-room-artifact.json> <communication-plan.json>",
  );
}

const readJson = async (path: string) => JSON.parse(await readFile(resolve(path), "utf8")) as unknown;

const researchBrief = researchBriefSchema.parse(await readJson(researchPath));
const designSpecification = recoveryDesignSpecificationSchema.parse(await readJson(designPath));
const recoveryRoomArtifact = recoveryRoomArtifactSchema.parse(await readJson(makerPath));
const communicationPlan = communicationPlanSchema.parse(await readJson(communicationPath));

const decision = await runManager({
  input: {
    run_id: communicationPlan.run_id,
    research_brief: researchBrief,
    design_specification: designSpecification,
    recovery_room_artifact: recoveryRoomArtifact,
    communication_plan: communicationPlan,
  },
  model: new OpenRouterManagerModel(loadManagerConfiguration()),
});

const artifactPath = resolve("artifacts", "gate-8", decision.run_id, "manager-decision.json");
await writeManagerDecision(decision, artifactPath);
console.log(JSON.stringify({
  run_id: decision.run_id,
  stage: decision.stage,
  decision: decision.decision,
  permitted_next_action: decision.governance.permitted_next_action,
  chain_verified: decision.lineage.chain_verified,
  artifact: artifactPath,
}));
