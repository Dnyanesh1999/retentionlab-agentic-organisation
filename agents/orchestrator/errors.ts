// Bounded, typed error surface for the Gate 9 orchestration backbone. Every failure the
// deterministic state machine or the append-only store can raise carries one of these codes so
// callers (and adversarial tests) can branch on the exact failure without string matching.

export type OrchestratorErrorCode =
  // State-machine legality
  | "RUN_ALREADY_STARTED"
  | "RUN_NOT_STARTED"
  | "TERMINAL_RUN"
  | "OUT_OF_ORDER_STAGE"
  | "STALE_VERSION"
  | "DOUBLE_COMPLETION"
  | "STAGE_NOT_ACTIVE"
  | "ILLEGAL_EVENT"
  | "REVISION_NOT_PENDING"
  | "DOWNSTREAM_MISMATCH"
  // Failed-stage recovery (operator-initiated retry)
  | "RUN_NOT_FAILED"
  | "RETRY_STAGE_MISMATCH"
  | "INVALID_OPERATOR_REASON"
  // Manager governance / outcome
  | "MISSING_MANAGER_OUTCOME"
  | "UNEXPECTED_MANAGER_OUTCOME"
  | "GOVERNANCE_VIOLATION"
  // Persistence / history integrity
  | "RUN_EXISTS"
  | "RUN_NOT_FOUND"
  | "RUN_INPUT_MISMATCH"
  | "CORRUPTED_HISTORY"
  | "TAMPERED_HISTORY"
  | "DUPLICATE_SEQUENCE";

export class OrchestratorError extends Error {
  public readonly code: OrchestratorErrorCode;

  constructor(code: OrchestratorErrorCode, message: string) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
  }
}

export function isOrchestratorError(value: unknown): value is OrchestratorError {
  return value instanceof OrchestratorError;
}
