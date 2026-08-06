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

import { OrchestratorError } from "./errors.js";
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
//   npm run agent:pipeline -- --run <uuid> [--out <dir>]                          # resume
//   npm run agent:pipeline -- --retry-failed <uuid> [--retry-reason <text>] [--out <dir>]  # recover a failed stage
// ---------------------------------------------------------------------------

const DEFAULT_ACCOUNT = "copper-finch";
const DEFAULT_OBJECTIVE =
  "Identify evidence-backed retention risks and consent-safe recovery opportunities, then compose a review-ready customer recovery experience for human approval.";
const DEFAULT_OUT = "artifacts/gate-9";
const CANONICAL_IMPLEMENTATION = "design/specifications/signal-garden-maker-implementation.v1.json";
// Safe, bounded default reason for an operator failed-stage recovery when --retry-reason is omitted.
const DEFAULT_RETRY_REASON =
  "Operator recovery retry of the failed stage after deterministic validation/runtime correction.";

type CliArgs = {
  account: string;
  objective: string;
  out: string;
  run: string | null;
  retryFailed: string | null;
  retryReason: string;
};

function parseArgs(argv: readonly string[]): CliArgs {
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
  const run = values.get("run") ?? null;
  const retryFailed = values.get("retry-failed") ?? null;
  // The three run modes are mutually exclusive; failed retry must never be combined with a fresh start
  // or a bootstrap resume.
  if (run !== null && retryFailed !== null) {
    throw new Error("--run and --retry-failed are mutually exclusive.");
  }
  return {
    account: values.get("account") ?? DEFAULT_ACCOUNT,
    objective: values.get("objective") ?? DEFAULT_OBJECTIVE,
    out: values.get("out") ?? DEFAULT_OUT,
    run,
    retryFailed,
    retryReason: values.get("retry-reason") ?? DEFAULT_RETRY_REASON,
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
  const isRetryFailed = args.retryFailed !== null;
  const isResume = args.run !== null;
  const runId = args.retryFailed ?? args.run ?? randomUUID();
  const runDir = resolve(args.out, runId);
  await mkdir(runDir, { recursive: true });

  const implementation = makerImplementationEvidenceSchema.parse(
    JSON.parse(await readFile(resolve(CANONICAL_IMPLEMENTATION), "utf8")) as unknown,
  );

  const lock = await acquireRunLock(runDir);
  try {
    // Only a brand-new run writes run input. Resume and failed-retry both operate on an existing,
    // immutable run directory and never rewrite it.
    if (!isResume && !isRetryFailed) {
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

    let result;
    if (isRetryFailed) {
      // Failed-stage recovery is a distinct mode: it never bootstraps a genesis event. Validate the
      // immutable run input matches the requested id, require an existing event log, then append the
      // single operator recovery event and drive normally. Do NOT combine with bootstrap-start.
      const runInput = await readRunInput(runDir);
      if (runInput.run_id !== runId) {
        throw new OrchestratorError(
          "RUN_INPUT_MISMATCH",
          `Run input in ${runDir} is for ${runInput.run_id}, not the requested ${runId}; refusing to retry a mismatched run.`,
        );
      }
      if (!(await store.exists(runId))) {
        throw new OrchestratorError(
          "RUN_NOT_FOUND",
          `Cannot retry ${runId}: no event log exists. Failed-stage recovery requires a run that started and failed.`,
        );
      }
      result = await orchestrator.retryFailed(runId, args.retryReason);
    } else if (isResume) {
      // Resume is bootstrap-safe: if the run crashed after run-input.json was written but before the
      // genesis event, `resumeExplicitRun` starts from the immutable run input instead of failing
      // RUN_NOT_FOUND.
      result = await resumeExplicitRun({ store, orchestrator, runId, runInput: await readRunInput(runDir) });
    } else {
      // A fresh run has already written its run input above and starts normally.
      result = await orchestrator.start({ run_id: runId, account_slug: args.account, requires_human_approval: true });
    }

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
