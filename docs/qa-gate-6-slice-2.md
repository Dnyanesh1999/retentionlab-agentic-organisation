# Gate 6 QA — Maker Slice 2

Date: 5 August 2026

Cloud function: `retentionlab-evidence`, version 2, active

Scope: live Signal Garden adapter and loading → ready/error orchestration

## Implemented boundary

`LiveSignalGardenEvidenceClient` calls the existing allow-listed `get_account_snapshot` tool with
the fictional account slug and a Supabase publishable key. It sends `cache: no-store`, imposes a
10-second timeout, composes caller cancellation with the timeout, validates the full relevant live
envelope, selects the newest required signal rows and then passes the normalized result through the
Slice 1 `SignalGardenSnapshot` decoder.

`createBrowserSignalGardenEvidenceClient` is the only Vite configuration factory. It accepts an
HTTPS project URL and a modern `sb_publishable_` value, rejects secret/service-role formats before
any request, and constructs the exact allow-listed function URL.

The client fails closed for:

- invalid configuration or account input;
- cancellation, timeout and network failure;
- unauthorized, missing, rate-limited or unavailable gateway responses;
- mismatched accounts, unsupported units or malformed contracts;
- missing required evidence; and
- responses older than the five-minute freshness window.

There is no fixture, local-storage, last-known-good or design-number fallback. `useSignalGardenSnapshot`
exposes only `loading`, decoded `ready`, or typed `error`, aborts in-flight work on cleanup and offers
an explicit retry that begins a new request.

## Current Supabase alignment

The Supabase changelog was checked for current breaking changes; none affects hosted browser
invocation of this function. Current guidance requires browser preflight handling and allows
publishable keys in browser clients while forbidding secret/service-role keys:

- [CORS for browser invocation](https://supabase.com/docs/guides/functions/cors)
- [Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets)
- [JavaScript function invocation](https://supabase.com/docs/reference/javascript/functions-invoke)

The function now answers `OPTIONS` before authentication and returns the documented CORS headers.
`verify_jwt` remains disabled because this existing function validates the modern publishable key in
its own handler; the Supabase secret key remains inside the Edge runtime.

## Live cloud proof

- Deployment through the connected Supabase integration created active function version 2.
- Browser preflight returned HTTP 204 with `Access-Control-Allow-Origin: *`, the bounded header list,
  `POST, OPTIONS` methods and `Cache-Control: no-store`.
- A cross-origin POST returned HTTP 200, `no-store` and `nosniff`.
- The new browser adapter decoded a fresh `signal-garden-snapshot.v1` for `copper-finch`, containing
  exactly `feature_adoption`, `active_users`, `session_frequency` and a cited seat-utilisation reading.
- The existing live MCP smoke still passed all seven tools and the deliberate no-fallback failure.

The wildcard CORS policy is intentional only for this public portfolio demonstration because the
gateway contains exclusively fictional synthetic data, accepts no writes and uses a public
publishable identifier. A real customer deployment would add authenticated users, authorization and
an origin allow-list.

## Automated verification

- Adapter, browser configuration and state-boundary tests: 10 passed
- Full Vitest suite: 40 passed across 14 files
- Cancellation, timeout, stale response, error classification and missing-evidence paths: passed
- Typecheck: passed
- Lint: passed
- Production build: passed
- Synthetic-data generator tests: 2 passed
- MCP build and live smoke: passed
- Production dependency audit: 0 vulnerabilities
- Hardcoded design-evidence scan and `git diff --check`: passed

Slice 2 deliberately does not render the final ready canvas. Routing it now would expose an
unfinished surface. Slice 3 owns `SignalStrand`, `SignalCanvas`, active inspection and the first
faithful browser comparison against the accepted concept.
