# Gate 3 QA — MCP evidence layer

Date: 5 August 2026  
Protocol server: `retentionlab-evidence@1.0.0`  
MCP SDK: `@modelcontextprotocol/server@2.0.0` and `@modelcontextprotocol/client@2.0.0`  
Live gateway: Supabase Edge Function `retentionlab-evidence`, version 1, active

The implementation follows the official [MCP TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) and its 2026-07-28 protocol line. The stdio entry writes protocol messages only to stdout; errors use stderr, matching the current [MCP transport requirements](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).

## Allow-listed tools

| Tool | Live source purpose |
|---|---|
| `get_account_snapshot` | Joined account, product, billing, support and preference snapshot |
| `list_product_signals` | Adoption and utilisation evidence |
| `list_billing_events` | Invoice and payment evidence |
| `list_support_events` | Service, severity and synthetic sentiment evidence |
| `get_preference_profile` | Consent and outreach boundaries |
| `list_vendor_status` | Fictional upstream-service conditions |
| `get_evidence_item` | Stable citation-key resolution |

Every tool is annotated read-only, non-destructive and idempotent. Inputs are strict Zod objects with bounded slug, evidence-key and limit fields. No arbitrary table name, SQL fragment, column name or filter is accepted from the caller.

## Protocol proof

The compiled stdio server was launched through the official MCP client:

- `initialize` returned `retentionlab-evidence@1.0.0`.
- `tools/list` returned exactly the seven expected tools.
- `tools/call` passed for all seven tools against live Supabase evidence.
- `get_evidence_item` resolved a key obtained dynamically from the preceding snapshot.
- The result contained `generated_at`, a new `retrieved_at` and `cache_mode: no-store`.

Representative live citation: `product:copper-finch:feature_adoption:2`. The citation was discovered at runtime and is recorded only as QA evidence, not as an application fixture.

## Failure behavior

A deliberate request for an unknown fictional account returned an MCP tool error with no `structuredContent`. The MCP server has no retry cache, fixture fallback or stale-response branch; a source failure cannot be represented as live evidence.

## Gateway boundary

The deployed Edge Function uses the current Supabase key model:

- Platform `verify_jwt` is disabled because it does not validate modern `sb_publishable_*` keys.
- The function validates the modern publishable key itself before dispatch.
- The internal `SUPABASE_SECRET_KEYS.default` value is read only inside the Edge runtime and never returned or committed.
- Incoming tools and arguments are checked against a fixed allow-list.
- Database calls send the secret key in the `apikey` header, following [Supabase's new-key migration guidance](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
- Every response sets `Cache-Control: no-store`.

An unsigned function request returned HTTP 401. An allow-listed snapshot request returned HTTP 200 and fresh database timestamps. The dataset is fictional and contains no customer PII.

## Automated verification

- MCP build: passed
- MCP unit/protocol tests: 3 passed
- Full Vitest suite: 7 unique tests passed (4 frontend and 3 MCP)
- Live tool calls: 7 passed
- Deliberate failure/no-cache test: passed

The Vercel Streamable HTTP transport remains a deployment-stage concern. Gate 3 proves the protocol and live data boundary through stdio; Gate 10 will expose the same server factory through the public server deployment.
