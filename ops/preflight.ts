// Deployment configuration preflight — a single, fail-closed, offline check that
// verifies the complete runtime environment the deployed RetentionLab service needs
// before the live Supabase/OpenRouter path can work.
//
// Why this exists: the per-runtime loaders (mcp/config.ts and each agents/*/config.ts)
// each validate only their own slice and throw on the first missing variable, so an
// operator bringing up the live path has no aggregate, secret-safe readiness gate. The
// MCP and agent runtimes run as local server processes and the public Recovery Room calls
// the Supabase Edge Functions directly; a hosted Vercel API is a future target, not a
// currently deployed dependency. This module
// is that gate. It reuses validators that mirror those loaders exactly (kept honest by
// ops/preflight.test.ts, which cross-checks the real loaders), reports every variable at
// once, and NEVER prints a secret value — only presence, validity and a redacted preview.
//
// It contacts no network and reads no filesystem. It cannot deploy, and it makes no claim
// about live-endpoint reachability; that remains a separate, documented manual step.

import { z } from "zod";

export type PreflightScope = "server" | "browser";

export type PreflightRequirement = "required" | "recommended" | "optional";

export type PreflightVariableStatus = "ok" | "missing" | "invalid";

/** Declarative contract for one runtime environment variable. */
export interface PreflightVariable {
  readonly name: string;
  readonly scope: PreflightScope;
  readonly requirement: PreflightRequirement;
  /** Secret values are never previewed — only reported as present/absent. */
  readonly secret: boolean;
  /** Non-secret URLs are previewed as scheme+host so operators can eyeball the target. */
  readonly url?: boolean;
  readonly purpose: string;
  readonly schema: z.ZodTypeAny;
}

const openRouterKey = z.string().min(20);
const openRouterModel = z.string().min(1);
const supabaseUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "must use HTTPS");
const publishableKey = z.string().min(20);
const secretKey = z.string().min(20);
const functionSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");
const browserPublishableKey = z
  .string()
  .startsWith("sb_publishable_", "must be a modern Supabase publishable key")
  .min(20);
const httpUrl = z.string().url();

// The complete deployment matrix. Server variables are the hard gate for the live
// Supabase/OpenRouter path; browser (VITE_*) variables are what makes the public Pages
// app query live — the app still deploys as a non-live shell without them, so they are
// "recommended", not "required".
export const preflightVariables: readonly PreflightVariable[] = [
  // Server — Supabase evidence gateway (mcp/config.ts) and data generation.
  {
    name: "SUPABASE_URL",
    scope: "server",
    requirement: "required",
    secret: false,
    url: true,
    purpose: "Supabase project origin for the server evidence gateway.",
    schema: supabaseUrl,
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    scope: "server",
    requirement: "required",
    secret: false,
    purpose: "Publishable key the MCP gateway presents to the evidence Edge Function.",
    schema: publishableKey,
  },
  {
    name: "SUPABASE_SECRET_KEY",
    scope: "server",
    // Data-generation-only: consumed by scripts/generate-demo-data.mjs and configured
    // inside the Supabase Edge Functions as their own function secret. The local evidence
    // + agent runtime never reads it, and the real .env.local intentionally omits it, so
    // it is NOT a hard requirement for a normal server preflight.
    requirement: "optional",
    secret: true,
    purpose: "Data-generation-only secret key (scripts/generate-demo-data.mjs); unused by the evidence/agent runtime.",
    schema: secretKey,
  },
  {
    name: "SUPABASE_EVIDENCE_FUNCTION",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Evidence Edge Function name (defaults to retentionlab-evidence).",
    schema: functionSlug,
  },
  // Server — OpenRouter agent runtimes (agents/*/config.ts). One shared key, five models.
  {
    name: "OPENROUTER_API_KEY",
    scope: "server",
    requirement: "required",
    secret: true,
    purpose: "Shared server-only OpenRouter key for all five agent runtimes.",
    schema: openRouterKey,
  },
  {
    name: "OPENROUTER_RESEARCHER_MODEL",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Researcher model id (defaults to a free model).",
    schema: openRouterModel,
  },
  {
    name: "OPENROUTER_DESIGNER_MODEL",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Designer model id (defaults to a free model).",
    schema: openRouterModel,
  },
  {
    name: "OPENROUTER_MAKER_MODEL",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Maker model id (defaults to a free model).",
    schema: openRouterModel,
  },
  {
    name: "OPENROUTER_COMMUNICATOR_MODEL",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Communicator model id (defaults to a free model).",
    schema: openRouterModel,
  },
  {
    name: "OPENROUTER_MANAGER_MODEL",
    scope: "server",
    requirement: "optional",
    secret: false,
    purpose: "Manager model id (defaults to a free model).",
    schema: openRouterModel,
  },
  // Browser — public repository Variables. The Pages app calls the Supabase Edge Functions
  // directly, so a live public route REQUIRES the Supabase origin + publishable key.
  {
    name: "VITE_SUPABASE_URL",
    scope: "browser",
    requirement: "required",
    secret: false,
    url: true,
    purpose: "Supabase origin the browser evidence client queries directly (required for a live public route).",
    schema: supabaseUrl,
  },
  {
    name: "VITE_SUPABASE_PUBLISHABLE_KEY",
    scope: "browser",
    requirement: "required",
    secret: false,
    purpose: "Public Supabase publishable key (sb_publishable_…) the browser client presents (required for a live public route).",
    schema: browserPublishableKey,
  },
  {
    name: "VITE_API_BASE_URL",
    scope: "browser",
    // Not consumed by the current browser clients (they call Supabase Edge Functions
    // directly). Retained as a placeholder for a future Vercel API and validated only if set.
    requirement: "optional",
    secret: false,
    url: true,
    purpose: "Placeholder for a future server API origin; currently unused by the browser clients.",
    schema: httpUrl,
  },
  {
    name: "VITE_SUPABASE_EVIDENCE_FUNCTION",
    scope: "browser",
    requirement: "optional",
    secret: false,
    purpose: "Browser evidence Edge Function name (defaults to retentionlab-evidence).",
    schema: functionSlug,
  },
  {
    name: "VITE_SUPABASE_CLARIFICATION_FUNCTION",
    scope: "browser",
    requirement: "optional",
    secret: false,
    purpose: "Browser clarification Edge Function name (defaults to retentionlab-clarification).",
    schema: functionSlug,
  },
];

export interface PreflightVariableReport {
  readonly name: string;
  readonly scope: PreflightScope;
  readonly requirement: PreflightRequirement;
  readonly secret: boolean;
  readonly present: boolean;
  readonly status: PreflightVariableStatus;
  /** Present only on invalid values, and guaranteed never to contain the value itself. */
  readonly issue?: string;
  /** Redacted, non-reversible summary safe to print and log. */
  readonly preview?: string;
}

export interface PreflightReport {
  readonly scope: PreflightScope | "all";
  readonly ok: boolean;
  readonly counts: {
    readonly required: number;
    readonly satisfied: number;
    readonly missingRequired: number;
    readonly invalid: number;
    readonly recommendedMissing: number;
  };
  readonly variables: readonly PreflightVariableReport[];
}

/**
 * Build a redacted, non-reversible preview of a value. Secrets are reduced to
 * "set (hidden)"; non-secret URLs show only scheme+host; everything else shows only a
 * length and, where relevant, whether an expected prefix matched. No raw value ever
 * appears in the output.
 */
function previewValue(variable: PreflightVariable, raw: string): string {
  if (variable.secret) {
    return "set (hidden)";
  }
  if (variable.url) {
    try {
      const parsed = new URL(raw);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return `set (unparseable url, ${raw.length} chars)`;
    }
  }
  if (variable.name.endsWith("_KEY")) {
    const marker = raw.startsWith("sb_publishable_") ? "sb_publishable_…" : "opaque";
    return `set (${marker}, ${raw.length} chars)`;
  }
  // Model ids and function slugs are non-sensitive identifiers; show them verbatim.
  return raw;
}

/** Flatten a Zod error into a single short message that never echoes the value. */
function summariseIssue(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? first.message : "invalid value";
}

function inspectVariable(variable: PreflightVariable, env: NodeJS.ProcessEnv): PreflightVariableReport {
  const raw = env[variable.name];
  const present = typeof raw === "string" && raw.length > 0;

  if (!present) {
    const base = {
      name: variable.name,
      scope: variable.scope,
      requirement: variable.requirement,
      secret: variable.secret,
      present: false,
    } as const;
    return { ...base, status: "missing" };
  }

  const parsed = variable.schema.safeParse(raw);
  const preview = previewValue(variable, raw);
  const base = {
    name: variable.name,
    scope: variable.scope,
    requirement: variable.requirement,
    secret: variable.secret,
    present: true,
    preview,
  } as const;

  if (parsed.success) {
    return { ...base, status: "ok" };
  }
  return { ...base, status: "invalid", issue: summariseIssue(parsed.error) };
}

/**
 * Inspect the environment and produce a secret-free readiness report.
 *
 * @param env    Environment map to inspect (defaults to process.env).
 * @param scope  Limit the report to one scope, or "all" for the full matrix.
 */
export function inspectEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  scope: PreflightScope | "all" = "server",
): PreflightReport {
  const selected = preflightVariables.filter((variable) => scope === "all" || variable.scope === scope);
  const variables = selected.map((variable) => inspectVariable(variable, env));

  const required = variables.filter((variable) => variable.requirement === "required");
  const missingRequired = required.filter((variable) => variable.status === "missing").length;
  const invalid = variables.filter((variable) => variable.status === "invalid").length;
  const satisfied = required.filter((variable) => variable.status === "ok").length;
  const recommendedMissing = variables.filter(
    (variable) => variable.requirement === "recommended" && variable.status !== "ok",
  ).length;

  return {
    scope,
    ok: missingRequired === 0 && invalid === 0,
    counts: {
      required: required.length,
      satisfied,
      missingRequired,
      invalid,
      recommendedMissing,
    },
    variables,
  };
}

/** Fail-closed verdict: any missing required or any invalid variable fails the gate. */
export function preflightPassed(report: PreflightReport): boolean {
  return report.ok;
}

export const PREFLIGHT_USAGE = "Usage: preflight [--scope=server|browser|all] [--json]";

/** Thrown for an unknown flag or an invalid --scope value so the CLI can fail closed. */
export class PreflightUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreflightUsageError";
  }
}

export interface PreflightCliOptions {
  readonly scope: PreflightScope | "all";
  readonly json: boolean;
}

/**
 * Parse CLI arguments fail-closed. Unknown flags, positional arguments and invalid
 * --scope values throw {@link PreflightUsageError} rather than silently defaulting.
 */
export function parseCliArgs(argv: readonly string[]): PreflightCliOptions {
  let scope: PreflightScope | "all" = "server";
  let json = false;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      if (value !== "server" && value !== "browser" && value !== "all") {
        throw new PreflightUsageError(`Unknown --scope value "${value}". ${PREFLIGHT_USAGE}`);
      }
      scope = value;
      continue;
    }
    throw new PreflightUsageError(`Unknown argument "${arg}". ${PREFLIGHT_USAGE}`);
  }

  return { scope, json };
}

const STATUS_GLYPH: Record<PreflightVariableStatus, string> = {
  ok: "✓",
  missing: "·",
  invalid: "✗",
};

/** Render a human-readable, secret-free report for a terminal. */
export function formatPreflightReport(report: PreflightReport): string {
  const lines: string[] = [];
  lines.push(`RetentionLab deployment preflight — scope: ${report.scope}`);
  lines.push("");

  for (const variable of report.variables) {
    const glyph = STATUS_GLYPH[variable.status];
    const tag =
      variable.status === "missing" && variable.requirement !== "required"
        ? `${variable.requirement} · not set`
        : variable.status === "missing"
          ? "REQUIRED · missing"
          : variable.status === "invalid"
            ? `invalid · ${variable.issue ?? ""}`
            : (variable.preview ?? "ok");
    lines.push(`  ${glyph} ${variable.name.padEnd(38)} ${tag}`);
  }

  lines.push("");
  lines.push(
    `Required: ${report.counts.satisfied}/${report.counts.required} satisfied · ` +
      `${report.counts.missingRequired} missing · ${report.counts.invalid} invalid · ` +
      `${report.counts.recommendedMissing} recommended not set`,
  );
  lines.push(report.ok ? "PREFLIGHT PASSED (config shape only; live reachability not tested)" : "PREFLIGHT FAILED");
  return lines.join("\n");
}
