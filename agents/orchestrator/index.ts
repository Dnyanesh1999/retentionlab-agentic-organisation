// Gate 9 orchestration backbone — public composition surface.
export * from "./contracts.js";
export * from "./errors.js";
export {
  applyEvent,
  assertManagerOutcome,
  EMPTY_STATE,
  expectedStage,
  failedStage,
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
export {
  artifactFileName,
  artifactPath,
  compactArtifactHash,
  loadArtifactIfPresent,
  writeArtifactExclusive,
  STAGE_FILE_BASE,
  type LoadedArtifact,
} from "./artifactStore.js";
export {
  ARTIFACT_SCHEMAS,
  createLivePipelineExecutors,
  createLiveProducers,
  isLivePipelineError,
  LivePipelineError,
  REAL_RUNNERS,
  type LivePipelineErrorCode,
  type LiveProducersConfig,
  type LivePipelineExecutorConfig,
  type PipelineModels,
  type PipelineProducers,
  type PipelineRunners,
  type StageProduceContext,
  type StageProducer,
} from "./livePipeline.js";
export {
  runInputSchema,
  readRunInput,
  writeRunInput,
  RUN_INPUT_FILE,
  type RunInputRecord,
} from "./runInput.js";
export {
  acquireRunLock,
  defaultRunLockDeps,
  RUN_LOCK_FILE,
  type RunLock,
  type RunLockDeps,
} from "./runLock.js";
export { resumeExplicitRun } from "./resumeRun.js";
export {
  artifactKey,
  buildPipelineTranscript,
  renderTranscriptMarkdown,
  serializePipelineTranscript,
  type ArtifactBundle,
  type PipelineTranscript,
  type TranscriptSource,
} from "./transcript.js";
export {
  loadTranscriptSource,
  writePipelineTranscript,
  transcriptSnapshotSlug,
  TRANSCRIPT_FILE_PREFIX,
  type WrittenTranscript,
} from "./transcriptSource.js";
