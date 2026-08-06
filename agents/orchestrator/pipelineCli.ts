import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadCommunicatorConfiguration } from "../communicator/config.js";
import { OpenRouterCommunicatorModel } from "../communicator/model.js";
import { loadDesignerConfiguration } from "../designer/config.js";
import { OpenRouterDesignerModel } from "../designer/model.js";
import { loadMakerConfiguration } from "../maker/config.js";
import { makerImplementationEvidenceSchema } from "../maker/contracts.js";
import { OpenRouterMakerModel } from "../maker/model.js";
import { loadManagerConfiguration } from "../manager/config.js";
import { OpenRouterManagerModel } from "../manager/model.js";
import { loadResearcherConfiguration } from "../researcher/config.js";
import { OpenRouterResearcherModel } from "../researcher/model.js";
import { loadEvidenceConfiguration } from "../../mcp/config.js";
import { LiveEvidenceClient } from "../../mcp/evidenceClient.js";

import { createFileEventStore } from "./eventStore.js";
import { createLivePipelineExecutors, createLiveProducers, type PipelineModels } from "./livePipeline.js";
import { createOrchestrator } from "./orchestrator.js";
import { acquireRunLock } from "./runLock.js";
import { readRunInput, writeRunInput } from "./runInput.js";
import { resumeExplicitRun } from "./resumeRun.js";
import { loadTranscriptSource, writePipelineTranscript } from "./transcriptSource.js";

// ---------------------------------------------------------------------------
// Executable full-pipeline CLI. Starts a fresh UUID run or resumes an explicit
// run id, driving the five REAL agents through the crash-safe orchestrator and
// exporting a deterministic transcript. This entry point performs live OpenRouter
// and Supabase calls WHEN RUN; it is not exercised during implementation (Codex
// runs the accepted live proof).
//
// Usage:
//   npm run agent:pipeline -- [--account <slug>] [--objective <text>] [--out <dir>]
//   npm run agent:pipeline -- --run <uuid> [--out <dir>]        # resume
// ---------------------------------------------------------------------------

const DEFAULT_ACCOUNT = "copper-finch";
const DEFAULT_OBJECTIVE =
  "Identify evidence-backed retention risks and consent-safe recovery opportunities, then compose a review-ready customer recovery experience for human approval.";
const DEFAULT_OUT = "artifacts/gate-9";
const CANONICAL_IMPLEMENTATION = "design/specifications/signal-garden-maker-implementation.v1.json";

function parseArgs(argv: readonly string[]): { account: string; objective: string; out: string; run: string | null } {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token !== undefined && token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`Flag --${key} requires a value.`);
      }
      values.set(key, next);
      i += 1;
    }
  }
  return {
    account: values.get("account") ?? DEFAULT_ACCOUNT,
    objective: values.get("objective") ?? DEFAULT_OBJECTIVE,
    out: values.get("out") ?? DEFAULT_OUT,
    run: values.get("run") ?? null,
  };
}

function buildModels(): PipelineModels {
  return {
    researcher: new OpenRouterResearcherModel(loadResearcherConfiguration()),
    designer: new OpenRouterDesignerModel(loadDesignerConfiguration()),
    maker: new OpenRouterMakerModel(loadMakerConfiguration()),
    communicator: new OpenRouterCommunicatorModel(loadCommunicatorConfiguration()),
    manager: new OpenRouterManagerModel(loadManagerConfiguration()),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const isResume = args.run !== null;
  const runId = args.run ?? randomUUID();
  const runDir = resolve(args.out, runId);
  await mkdir(runDir, { recursive: true });

  const implementation = makerImplementationEvidenceSchema.parse(
    JSON.parse(await readFile(resolve(CANONICAL_IMPLEMENTATION), "utf8")) as unknown,
  );

  const lock = await acquireRunLock(runDir);
  try {
    if (!isResume) {
      await writeRunInput(runDir, {
        run_id: runId,
        account_slug: args.account,
        objective: args.objective,
        initiated_at: new Date().toISOString(),
      });
    }

    const store = createFileEventStore(runDir);
    const producers = createLiveProducers({
      runDir,
      models: buildModels(),
      gateway: new LiveEvidenceClient(loadEvidenceConfiguration()),
      makerImplementation: implementation,
    });
    const orchestrator = createOrchestrator({ store, executors: createLivePipelineExecutors({ runDir, producers }) });

    // Resume is bootstrap-safe: if the run crashed after run-input.json was written but before the
    // genesis event, `resumeExplicitRun` starts from the immutable run input instead of failing
    // RUN_NOT_FOUND. A fresh run has already written its run input above and starts normally.
    const result = isResume
      ? await resumeExplicitRun({ store, orchestrator, runId, runInput: await readRunInput(runDir) })
      : await orchestrator.start({ run_id: runId, account_slug: args.account, requires_human_approval: true });

    const source = await loadTranscriptSource(runDir, store, runId);
    const written = await writePipelineTranscript(runDir, source);

    console.log(JSON.stringify({
      run_id: runId,
      status: result.status,
      run_dir: runDir,
      transcript_snapshot: written.slug,
      transcript_reused: written.reused,
      transcript_json: written.jsonPath,
      transcript_markdown: written.markdownPath,
      manager: written.transcript.manager_outcome,
    }, null, 2));
  } finally {
    await lock.release();
  }
}

await main();
