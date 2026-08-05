import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { researchBriefSchema } from "../researcher/contracts.js";
import { recoveryDesignSpecificationSchema } from "./contracts.js";
import { promoteReviewedDesignerCandidate, writeDesignerReview } from "./review.js";
import { writeDesignerArtifact } from "./run.js";

const predecessorPath = process.argv[2];
const candidatePath = process.argv[3];
if (!predecessorPath || !candidatePath) {
  throw new Error("Usage: npm run agent:designer:promote -- <research-brief.json> <candidate.json>");
}

const researchBrief = researchBriefSchema.parse(JSON.parse(await readFile(resolve(predecessorPath), "utf8")) as unknown);
const candidate = recoveryDesignSpecificationSchema.parse(JSON.parse(await readFile(resolve(candidatePath), "utf8")) as unknown);
const promoted = promoteReviewedDesignerCandidate({
  input: { run_id: researchBrief.run_id, research_brief: researchBrief },
  candidate,
  reviewedAt: new Date().toISOString(),
});
const directory = resolve("artifacts", "gate-5", researchBrief.run_id);
const artifactPath = resolve(directory, "recovery-design-specification.json");
const reviewPath = resolve(directory, "quality-review.json");
await writeDesignerArtifact(promoted.specification, artifactPath);
await writeDesignerReview(promoted.review, reviewPath);
console.log(JSON.stringify({
  run_id: researchBrief.run_id,
  stage: promoted.specification.stage,
  status: promoted.specification.status,
  artifact: artifactPath,
  review: reviewPath,
}));

