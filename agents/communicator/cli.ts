import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { loadCommunicatorConfiguration } from "./config.js";
import { OpenRouterCommunicatorModel } from "./model.js";
import { runCommunicator, writeCommunicationPlan } from "./run.js";

const predecessorPath = process.argv[2];
if (!predecessorPath) throw new Error("Usage: npm run agent:communicator -- <recovery-room-artifact.json>");
const artifact = recoveryRoomArtifactSchema.parse(JSON.parse(await readFile(resolve(predecessorPath), "utf8")) as unknown);
const plan = await runCommunicator({
  input: { run_id: artifact.run_id, recovery_room_artifact: artifact },
  model: new OpenRouterCommunicatorModel(loadCommunicatorConfiguration()),
});
const artifactPath = resolve("artifacts", "gate-7", plan.run_id, "communication-plan.json");
await writeCommunicationPlan(plan, artifactPath);
console.log(JSON.stringify({ run_id: plan.run_id, stage: plan.stage, status: plan.status, artifact: artifactPath }));
