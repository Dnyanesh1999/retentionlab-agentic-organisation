# GitHub Copilot review — Gate 6 Maker Slice 2

Date: 5 August 2026

Session: `Gate 6 slice 2 architecture & security r`

Worktree: `dnyanesh1999-psychic-adventure`
Mode: Plan; Auto model; Default agent

Copilot received a read-only architecture and security review brief. It was explicitly prohibited
from editing repository files, reading `.env` files, inspecting ignored artefacts, using Autopilot,
committing or pushing. The app reported that it read the ten allow-listed tracked files and changed
no repository files. Its session-only plan was not approved for implementation.

## Findings accepted

- Preserve one typed evidence client between React and the existing Edge Function.
- Permit `ready` only after strict runtime decoding; never return fixtures, cached payloads or
  design-specification numbers after a source failure.
- Keep request cancellation distinct from timeouts and network failures.
- Give the hook exactly `loading`, `ready` and `error` states, with explicit manual retry.
- Reject replayed responses outside a bounded freshness window.
- Treat CORS, request cleanup and prop/request races as testable behavior.

## Findings corrected or deferred

- Copilot labelled every client-side API key as a critical secret-exposure risk. That is too broad.
  Supabase's current documentation explicitly permits publishable keys in browser clients and
  forbids secret/service-role keys. Slice 2 exposes only a modern publishable key name and keeps
  `SUPABASE_SECRET_KEY` server-only. The Edge Function reads only fictional, synthetic records and
  validates the publishable key before dispatch.
- Copilot proposed 27 tests across adapter, hook and final UI. Slice 2 implements the adapter and
  state-boundary risks now; final rendered loading/ready/error UI tests belong to Slice 3 and Slice 5.
- Automatic retry and snapshot caching were rejected. They can disguise source failure or replay
  stale evidence. Retry is explicit, and every request/response remains `no-store`.
- Product error copy and telemetry are deferred until the visual error state is implemented in
  Slice 5. The runtime error taxonomy is complete enough for that later presentation layer.

## Independence record

Copilot worked from the Slice 1 commit in its separate worktree while Codex implemented Slice 2 on
the main worktree. No Copilot-generated repository patch was merged. Codex independently checked
each adopted recommendation against current Supabase documentation, the deployed gateway contract,
unit tests and live cloud calls.
