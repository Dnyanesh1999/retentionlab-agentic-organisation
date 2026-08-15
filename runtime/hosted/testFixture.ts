import {
  type HostedRun,
  type HostedRunCreateInput,
  type HostedRunDecisionInput,
  HOSTED_RUN_CONTRACT_VERSION,
} from "./contracts.js";

// Deterministic, valid fixtures for the hosted run contract. Every builder returns a fresh, mutable
// object so a test can perturb a single field and assert the schema rejects it. Values are fixed (no
// clock, no randomness) so tests stay reproducible.

const RUN_ID = "8f14e45f-ceea-467a-9575-0e2d6b3f1a20";
const ACCOUNT_ID = "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91";
const CREATED_AT = "2026-08-14T09:00:00.000Z";
const STARTED_AT = "2026-08-14T09:00:01.000Z";
const COMPLETED_AT = "2026-08-14T09:00:05.000Z";
const PAUSED_AT = "2026-08-14T09:00:06.000Z";

export function makeHostedRunCreateInput(): HostedRunCreateInput {
  return {
    account_slug: "northwind-retail",
    objective: "Recover lapsed premium subscribers with a consent-first winback sequence.",
    idempotency_key: "req-2026-08-14-northwind-001",
  };
}

const MANAGER_ARTIFACT_SHA256 =
  "3f2b1c8e9d4a7605f1e2c3b4a5968778899aabbccddeeff00112233445566778";

export function makeHostedRunDecisionInput(): HostedRunDecisionInput {
  return {
    run_id: RUN_ID,
    expected_manager_artifact_sha256: MANAGER_ARTIFACT_SHA256,
    decision: "approve",
    rationale:
      "The sealed chain verifies end to end and the invitation stays within the consented channel.",
    idempotency_key: "decision-2026-08-14-northwind-001",
  };
}

export function makeHostedRun(): HostedRun {
  return {
    contract_version: HOSTED_RUN_CONTRACT_VERSION,
    run_id: RUN_ID,
    account_id: ACCOUNT_ID,
    account_slug: "northwind-retail",
    idempotency_key: "req-2026-08-14-northwind-001",
    objective: "Recover lapsed premium subscribers with a consent-first winback sequence.",
    status: "awaiting_human_approval",
    current_stage: "manager",
    public_summary: "Researcher and designer complete; manager decision awaiting human approval.",
    created_at: CREATED_AT,
    updated_at: PAUSED_AT,
    events: [
      {
        type: "run_created",
        sequence: 1,
        run_id: RUN_ID,
        account_id: ACCOUNT_ID,
        account_slug: "northwind-retail",
        occurred_at: CREATED_AT,
      },
      {
        type: "stage_started",
        sequence: 2,
        stage: "researcher",
        occurred_at: STARTED_AT,
      },
      {
        type: "stage_completed",
        sequence: 3,
        stage: "researcher",
        public_summary: "Segmented 1,240 lapsed subscribers into three consent-eligible cohorts.",
        occurred_at: COMPLETED_AT,
      },
      {
        type: "run_paused_for_approval",
        sequence: 4,
        stage: "manager",
        occurred_at: PAUSED_AT,
      },
    ],
  };
}
