import assert from "node:assert/strict";
import test from "node:test";

import { buildDemoDataset } from "./generate-demo-data.mjs";

test("builds a relational fictional dataset that satisfies Gate 2 invariants", () => {
  const dataset = buildDemoDataset({ seed: 42, generatedAt: "2026-08-05T12:00:00.000Z" });
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  const evidenceKeys = [
    ...dataset.productSignals,
    ...dataset.billingEvents,
    ...dataset.supportEvents,
    ...dataset.consentPreferences,
    ...dataset.vendorStatusEvents,
  ].map((row) => row.evidence_key);

  assert.equal(dataset.accounts.length, 8);
  assert.ok(dataset.accounts.every((account) => account.synthetic === true));
  assert.ok(dataset.accounts.every((account) => account.generation_run_id === dataset.run.id));
  assert.ok(dataset.productSignals.every((row) => accountIds.has(row.account_id)));
  assert.ok(dataset.billingEvents.every((row) => accountIds.has(row.account_id)));
  assert.ok(dataset.supportEvents.every((row) => accountIds.has(row.account_id)));
  assert.ok(dataset.consentPreferences.every((row) => accountIds.has(row.account_id)));
  assert.equal(new Set(evidenceKeys).size, evidenceKeys.length);
  assert.deepEqual(dataset.rowCounts, {
    accounts: 8,
    product_signals: 32,
    billing_events: 16,
    support_events: 16,
    consent_preferences: 8,
    vendor_status_events: 4,
  });
});

test("the same seed produces the same evidence values without fixed frontend fixtures", () => {
  const options = { seed: 99, generatedAt: "2026-08-05T12:00:00.000Z" };
  const first = buildDemoDataset(options);
  const second = buildDemoDataset(options);

  assert.deepEqual(
    first.accounts.map(({ id: _id, generation_run_id: _runId, ...account }) => account),
    second.accounts.map(({ id: _id, generation_run_id: _runId, ...account }) => account),
  );
  assert.deepEqual(
    first.productSignals.map(({ id: _id, account_id: _accountId, ...signal }) => signal),
    second.productSignals.map(({ id: _id, account_id: _accountId, ...signal }) => signal),
  );
});
