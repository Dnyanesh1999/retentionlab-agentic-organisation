// Gate 9 orchestration backbone — public composition surface.
export * from "./contracts.js";
export * from "./errors.js";
export {
  applyEvent,
  assertManagerOutcome,
  EMPTY_STATE,
  expectedStage,
  firstIncompleteStage,
  initialStages,
  invalidationSet,
  isTerminal,
  managerDownstream,
  replay,
  type OrchestratorState,
  type PendingRevision,
  type ResumePlan,
  type StageState,
} from "./stateMachine.js";
export {
  buildEnvelope,
  createFileEventStore,
  createMemoryEventStore,
  parseAndVerifyChain,
  type EventStore,
  type MemoryEventStore,
} from "./eventStore.js";
export {
  createOrchestrator,
  type DriveResult,
  type Orchestrator,
  type OrchestratorExecutors,
  type StageExecutionResult,
  type StageExecutor,
  type StageExecutorContext,
  type StartRunInput,
} from "./orchestrator.js";
