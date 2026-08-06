import { OrchestratorError } from "./errors.js";
import type { EventStore } from "./eventStore.js";
import type { DriveResult, Orchestrator } from "./orchestrator.js";
import type { RunInputRecord } from "./runInput.js";

// ---------------------------------------------------------------------------
// Crash-safe resume of an EXPLICIT run id (`--run <uuid>`), split out from the CLI so it is testable
// without any live model/gateway wiring.
//
// Pre-genesis crash boundary: the CLI writes the immutable `run-input.json` BEFORE `orchestrator.start`
// exclusive-creates the genesis event line. A crash between those two writes leaves a valid run
// directory holding run input but no event log. A naive `--run <id>` would call `orchestrator.resume`
// and fail `RUN_NOT_FOUND` forever, stranding the run.
//
// `resumeExplicitRun` closes that gap conservatively:
//   1. Validate the durable run input's `run_id` equals the explicit id; a mismatch fails closed
//      (`RUN_INPUT_MISMATCH`) rather than resume the wrong run.
//   2. If — and only if — the event store has NO history for the id, bootstrap it with
//      `orchestrator.start`, using the immutable run input's `account_slug` and the mandated
//      `requires_human_approval: true`. `start` exclusive-creates the genesis line, so it can never
//      overwrite an event log.
//   3. Otherwise resume normally.
//
// It never writes run input and never overwrites an event log.
// ---------------------------------------------------------------------------

export async function resumeExplicitRun(options: {
  readonly store: EventStore;
  readonly orchestrator: Orchestrator;
  readonly runId: string;
  readonly runInput: RunInputRecord;
}): Promise<DriveResult> {
  const { store, orchestrator, runId, runInput } = options;

  if (runInput.run_id !== runId) {
    throw new OrchestratorError(
      "RUN_INPUT_MISMATCH",
      `Run input in the run directory is for ${runInput.run_id}, not the requested ${runId}; refusing to resume a mismatched run.`,
    );
  }

  if (await store.exists(runId)) {
    return orchestrator.resume(runId);
  }

  // Pre-genesis crash: run input is durable but the event log was never created. Bootstrap start from
  // the immutable run input; the exclusive-create genesis guarantees no existing log is overwritten.
  return orchestrator.start({
    run_id: runId,
    account_slug: runInput.account_slug,
    requires_human_approval: true,
  });
}
