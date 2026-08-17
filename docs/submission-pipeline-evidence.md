# The Pipeline in Action — evidence sheet

Assembled 17 August 2026 for the submission section of the same name. Every id, hash, count and
timestamp below is copied from committed transcripts or recorded production QA. Nothing here is
estimated, rounded or reconstructed. Where a claim has no live proof, §7 says so.

This is a source sheet, not the submission section. Write that section in your own words; use this to
get the facts right and to know which screen proves which claim.

---

## 1. Read this first: there are two runs, and they are different

The single most confusable thing in this project. Both are real, both are evidence, and mixing them up
in the submission would read as carelessness.

| | **Local assessed run** | **Hosted production run** |
| --- | --- | --- |
| Run id | `a9f629aa-2a87-4723-8711-0a8039077adc` | `982ac99a-d9aa-47a6-ba61-09f366143715` |
| Account | `copper-finch` | `marble-current` |
| Runtime | `agents/orchestrator` — local, reproducible | Supabase Edge Functions — hosted, live |
| Events | 14, hash-chained | 29, append-only sequenced |
| Model | `google/gemma-4-26b-a4b-it:free` | `nvidia/nemotron-3-super-120b-a12b:free` |
| Final status | `awaiting_human_approval` | `approved` |
| Communicator channel | `email` (view-only invitation) | `in_app` |
| What it proves | The chain itself: every event hashed to its predecessor, crash-safe, replayable | That the same contracts run in production, and survive a real human approval |
| Where to see it | `#/cases/overview` | `#/control-room`, `#/portfolio`, `#/cases/approved/982ac99a-d9aa-47a6-ba61-09f366143715` |

**Why both exist, in one sentence you can reuse:** the local runtime proves the pipeline is
deterministic and auditable end to end, and the hosted runtime proves the same contracts hold when a
real authenticated human stands at the boundary.

---

## 2. The handoff mechanism — what actually makes this a chain

Each stage does three things before it is allowed to speak to a model:

1. It **claims** the stage under a service-only 140-second lease, so two workers cannot run one stage.
2. It **reads the exact stored SHA-256** of its predecessor's sealed artefact for the same run and the
   same account — not a recomputed hash, not a guess, not one passed in the request.
3. It **verifies** that hash against the stored artefact. A mismatch aborts before any model call.

Only then is the model invoked, and its reply must parse against a strict JSON Schema. The artefact is
canonicalised, hashed, and sealed privately. The browser receives a bounded public summary — never the
artefact, never the full hash.

The sentence worth putting in the submission: **the model chooses words; it never owns lineage,
evidence identity, permissions or governance.** Those live in code, checked after the model speaks.

---

## 3. The chain, with real hashes

### 3.1 Sealed artefacts — local assessed run

| # | Stage | Version | Artefact SHA-256 |
| --- | --- | --- | --- |
| 1 | Researcher | v1 | `56a9566f816b453b0aa5c64ccac770c85f5d14f6b503df4095c5d0ab5719f515` |
| 2 | Designer | v1 | `852c48229086b3160d481bed7c84c43a1de4a1f7778bf4d88ec19bfaf4ec4899` |
| 3 | Maker | v1 | `be01166f32c134cc90abd0a4fd213dd96357bfb994cc47d4b3065bd61ec93807` |
| 4 | Communicator | **v2** | `175695ed9c416b09ad205f40d77200eefbf7e100d40cb45ef4b295b493baadac` |
| 5 | Manager | v1 | `d313369f31abf42324793efbf7227c5153a8d6726bc0cede561f5cfd519e1fa2` |

Communicator is **v2** because v1 failed. That is §5.

### 3.2 Verified lineage links

Seven links, each verified against the exact stored predecessor:

```
researcher   → designer      56a9566f816b…   verified
designer     → maker         852c48229086…   verified
maker        → communicator  be01166f32c1…   verified
researcher   → manager       56a9566f816b…   verified
designer     → manager       852c48229086…   verified
maker        → manager       be01166f32c1…   verified
communicator → manager       175695ed9c41…   verified
```

Manager verifies all four predecessors, not just the one immediately before it. That is what makes the
chain unbroken rather than merely sequential.

### 3.3 The hash-chained event stream

Fourteen events, each carrying the hash of the one before it, beginning from the zero hash. This is the
tamper-evidence: altering any event breaks every hash after it.

| seq | Event | Stage | Hash | Previous |
| --- | --- | --- | --- | --- |
| 0 | `run_started` | — | `f92688f5cd` | `0000000000` |
| 1 | `stage_started` | researcher | `0a4815b919` | `f92688f5cd` |
| 2 | `stage_completed` | researcher | `8110e5f6ee` | `0a4815b919` |
| 3 | `stage_started` | designer | `9965622052` | `8110e5f6ee` |
| 4 | `stage_completed` | designer | `f7788c75d4` | `9965622052` |
| 5 | `stage_started` | maker | `f33756ef5b` | `f7788c75d4` |
| 6 | `stage_completed` | maker | `0c73a0f54e` | `f33756ef5b` |
| 7 | `stage_started` | communicator | `f3bf13d6df` | `0c73a0f54e` |
| **8** | **`stage_failed`** | **communicator** | `324321ed64` | `f3bf13d6df` |
| **9** | **`failed_stage_retry_requested`** | **communicator** | `b5fef7110d` | `324321ed64` |
| 10 | `stage_started` | communicator | `b3690683b0` | `b5fef7110d` |
| **11** | **`stage_completed`** | **communicator** | `27c8125243` | `b3690683b0` |
| 12 | `stage_started` | manager | `e3e3b6f233` | `27c8125243` |
| 13 | `manager_decided` | — | `a35e54b80f` | `e3e3b6f233` |

Sequences 8, 9 and 11 are the failure, the named-operator retry, and the reseal. They are still in the
stream. Nothing was cleaned up for the submission.

---

## 4. What each agent actually produced

Sealed outputs, not role descriptions.

### Local assessed run — `copper-finch`

| Agent | What it sealed |
| --- | --- |
| Researcher | 4 cited observations and 2 hypotheses → 3 priority outcomes, 3 success signals |
| Designer | 3 experience principles, 3 journey steps, 10 reusable components across 7 interaction states |
| Maker | 3 regions and 2 evidence-backed claims, over commit `c38febd` |
| Communicator | 2 sourced message claims, one view-only email invitation |
| Manager | Assessed all 4 predecessors, decision `approve`, permitted next action `await_human_approval` only |

### Hosted production run — `marble-current`

| Agent | What it sealed |
| --- | --- |
| Researcher | 7 cited observations and 2 hypotheses, from 5 freshly queried evidence tools |
| Designer | 3 principles, 3 journey steps, 10 reviewed components |
| Maker | 7 interaction states, 10 reviewed components, 3 evidence-backed claims |
| Communicator | A consent-bound `in_app` invitation with 3 evidence-linked claims — **nothing sent** |
| Manager | Verified the complete chain, produced `run_paused_for_approval` |

**The cumulative-output claim, stated precisely:** the Maker's interaction states exist because the
Designer's journey steps exist, which exist because the Researcher's cited observations exist. Remove
the Researcher and the Maker has nothing to build against — and the code enforces that, because the
Maker cannot start without verifying the Designer's hash, which cannot exist without the Researcher's.

---

## 5. The failures — the most valuable evidence in the project

The brief rewards evidence of iteration. This project has it recorded rather than described.

### 5.1 The Communicator's email assumption

At sequence 8 of the local run, on 2026-08-06T16:25:22.842Z, Communicator v1 failed:

> Communicator cited a claim absent from the Maker handoff.

Underneath it was a design error, not a model error: the contract assumed every account permitted
email. It does not. The fix compiled a **channel-neutral** invitation that inherits the exact sealed
Maker channel. A named operator retried at sequence 9, only the failed stage reran, and v2 sealed at
sequence 11. Researcher, Designer and Maker were **not** rerun — they were already sealed.

In the hosted run the same lesson shows up as `in_app` rather than `email`, because that is what Marble
Current's sealed Maker channel actually permitted.

### 5.2 Eight preserved failures in the hosted run

The approved production run still carries **8 `run_failed` events**: 3 Designer (sequences 5, 7, 9) and
5 Communicator (15, 17, 19, 21, 23). Sequence 23 reads *"email is not present in the sealed Maker
channel."*

They survived a human approval, two live migrations and an Edge Function redeploy. Verified after
approval: the event count went **28 → 29** — exactly one event appended, nothing rewritten.

### 5.3 A run that failed and stayed failed

Run `81fa6967-561f-42aa-9e46-eb20cc2b59d0` failed closed at Researcher because the free model returned
an invalid ResearchBrief. It has not been rewritten or presented as a success.

### 5.4 Two defects that only production could find

Every test that touches an RPC mocks `fetch`, so plpgsql never executes locally. Two defects shipped
green and were caught by curl probes against the deployed function, both in **refusal** branches:

1. An ambiguous plpgsql identifier made a non-allow-listed operator receive **502** instead of **403**.
2. A read failure reported as a failed **write**, with the wrong status code.

Both failed *closed* — nothing was recorded either time. That is worth saying out loud: a defect that
failed open, recording a decision against an unverified hash, would have been far more serious.

---

## 6. The human boundary, and the approval

Manager completion is **not** approval. The Manager can only reach
`permitted_next_action = await_human_approval`; it cannot send, publish, deploy, mutate customer data
or approve itself.

The live approval, recorded **15 August 2026, 01:58:54 UTC**:

- The operator signed in, and the decision sheet displayed the sealed Manager hash
  `d253e409ec1984b5f316e831e85637d77dd0900aaf55e0f342753af21494e605`, `SEALED CHAIN Verified`,
  `CONSENTED CHANNEL in_app`, `EXTERNAL ACTIONS 0`.
- They attested to **the artefact they actually saw** — the same hash the authenticated context call
  returned.
- Approval promoted the case record **internally**. It authorised no send, publish or deploy.
  `external_actions_permitted` is still `0`.

**The single strongest line of live evidence in this project** is probe P9: an operator holding a valid
token, correctly allow-listed, at a run genuinely awaiting approval, was **refused** because the
Manager hash they presented did not match the sealed record. Authentication is not authorisation, and
the hash — not the person — governs the decision.

Also worth citing: authentication alone is insufficient. The operator identity is never read from a
request body; it is only the subject Supabase Auth returns for a bearer token the Edge Function
verifies itself.

---

## 7. What is *not* demonstrated live — say this, don't hide it

Disclosing these strengthens the submission. Hiding one and being asked about it would not.

- **The `reject` path has no live proof.** It has 13 hosted tests and probe P9, but no recorded live
  rejection. A live rejection needs a run sitting at `awaiting_human_approval`. Four attempts were made
  on 16 August; each reached a valid ResearchBrief and was then refused by the Researcher's
  citation-integrity guard, because the model named a real evidence key but attributed it to the wrong
  `source_tool`.

  **The guard was not relaxed.** Two capable models — `nvidia/nemotron-3-super-120b-a12b:free` and
  `openai/gpt-4o-mini` — both attempted to mis-attribute evidence provenance, and the Researcher failed
  closed on both. Those refusals are better evidence than the demonstration would have been. This is a
  good paragraph for the reflection: choosing the integrity claim over the demo.
- **Idempotent decision replay against production** — unit tests only. Run `982ac99a…` is terminal, so
  a replay there would exercise the already-decided branch, not the replay branch.
- **390×844 QA of the decision sheet** — not performed.
- **Manager-directed typed revision** remains fail-closed. A Manager `revise` outcome is rejected by the
  RPC and recorded as a Manager stage *failure*. The human decision vocabulary is `approve` / `reject`
  only.
- **Two probe side effects, disclosed rather than deleted.** Verifying that a decided account is
  released was done by actually calling `create_run`, which opened a real run (`4f505d07…`). A second
  run (`068c2a2b…`) exists because the assistant asserted, without checking, that a create would resume
  an existing run. Their `run_failed` events are append-only and are not being removed.

---

## 8. Screenshot map — which screen proves which claim

Live site: <https://dnyanesh1999.github.io/retentionlab-agentic-organisation/>

| # | Claim to prove | Where | What to capture |
| --- | --- | --- | --- |
| 1 | Five agents, an unbroken chain | `#/control-room`, top | The orientation band: the five agents in order with what each seals |
| 2 | Live data queried at the moment of use | `#/control-room` | The account directory with the `No-store` stamp and "Account directory retrieved · Supabase · no-store" |
| 3 | The pipeline actually runs | `#/control-room` → *Watch the five agents run* | The launch sheet's three gates: Validate account, Bind live evidence, Enforce approval |
| 4 | Stage-by-stage execution | `#/control-room` during a run | The five-agent execution trace with sealed summaries |
| 5 | **The recorded failure** | `#/cases/overview` → Workstream → event scrubber | Sequence 8 failure → 9 retry → 11 reseal. **The best single screenshot in the project.** |
| 6 | Real lineage between artefacts | `#/cases/overview` → Overview | The lineage constellation — verified links solid, unverified dashed |
| 7 | Artefact identity | `#/cases/overview` | The artefact seals, each drawn from its own SHA-256 |
| 8 | The human boundary | `#/cases/overview` → Decision | The consent boundary and "Human decision retained · External actions 0" |
| 9 | Approval promoted a real case | `#/portfolio` | The Approved live cases register — Marble Current |
| 10 | The Maker built something usable | `#/cases/recovery-room` | The Signal Garden recovery experience, interactive |
| 11 | Answers are grounded, not generated | Case assistant, bottom-right | An answer with its citation, plus a refusal to an out-of-scope question |

For #11, two screenshots side by side — a cited answer and an honest refusal — prove more than either
alone.

---

## 9. Numbers you can quote safely

| Claim | Figure |
| --- | --- |
| Agents | 5, fixed order, enforced server-side |
| Local run events | 14, hash-chained from the zero hash |
| Hosted run events | 29, append-only, monotonic |
| Preserved failures in the approved run | 8 `run_failed` events |
| Verified lineage links | 7 |
| Evidence tools queried per hosted Researcher stage | 5, all `no-store` |
| Stage lease | 140 seconds, service-role only |
| Artefact identity | SHA-256, 64 hex characters |
| External actions permitted | **0**, a database invariant |
| Application tests | 515 |
| Edge Function tests | 46 |
| AI usage log entries | 45, every one carrying date, model and prompt |

---

## 10. Sources

Every claim above traces to one of these. Read the source before quoting a figure that matters.

- `docs/qa-hosted-five-agent-pipeline.md` — hosted production proof
- `docs/qa-human-approval.md` — probes P1–P16, the approval, §5.4 on what is not proven
- `docs/qa-gate-9-live-pipeline-transcript.md` — the local assessed transcript
- `design/specifications/gate-9-live-pipeline-transcript.v1.json` — the 14 hash-chained events
- `docs/claude-handoff.md` §1–§3 — live state and honest failure history
- `docs/brief-compliance.md` — the requirement matrix
- `output/release/ai-usage-appendix.md` — generated by `npm run release:ai-appendix`
