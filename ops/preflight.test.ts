import { describe, expect, it } from "vitest";

import {
  formatPreflightReport,
  inspectEnvironment,
  parseCliArgs,
  preflightPassed,
  preflightVariables,
  PreflightUsageError,
} from "./preflight.js";
import { loadEvidenceConfiguration } from "../mcp/config.js";
import { loadResearcherConfiguration } from "../agents/researcher/config.js";
import { loadDesignerConfiguration } from "../agents/designer/config.js";
import { loadMakerConfiguration } from "../agents/maker/config.js";
import { loadCommunicatorConfiguration } from "../agents/communicator/config.js";
import { loadManagerConfiguration } from "../agents/manager/config.js";

// Distinctive fixture markers used to prove redaction. Their variable NAMES avoid
// SECRET/API_KEY tokens and their VALUES carry the readable "fake" token so the shared
// release secret-scanner treats them as inert placeholders, not leaked credentials.
const HIDDEN_SUPABASE_MARKER = "fake-hidden-supabase-service-value-marker";
const HIDDEN_OPENROUTER_MARKER = "fake-openrouter-live-value-marker-never-print";

// Runtime-shaped server environment: exactly what the local evidence + agent runtime
// needs. It intentionally omits SUPABASE_SECRET_KEY, mirroring the real .env.local, which
// the data-generation-only secret does not populate.
function validServerEnv(): NodeJS.ProcessEnv {
  return {
    SUPABASE_URL: "https://abcdefgh.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_serverkey01",
    OPENROUTER_API_KEY: HIDDEN_OPENROUTER_MARKER,
  };
}

function validBrowserEnv(): NodeJS.ProcessEnv {
  return {
    VITE_SUPABASE_URL: "https://abcdefgh.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browserkey1",
  };
}

describe("inspectEnvironment (server scope)", () => {
  it("passes on the runtime-shaped env (no SUPABASE_SECRET_KEY)", () => {
    const report = inspectEnvironment(validServerEnv(), "server");
    expect(report.ok).toBe(true);
    expect(preflightPassed(report)).toBe(true);
    expect(report.counts.missingRequired).toBe(0);
    expect(report.counts.invalid).toBe(0);
    expect(report.counts.satisfied).toBe(report.counts.required);
  });

  it("treats SUPABASE_SECRET_KEY as optional (data-generation-only)", () => {
    const report = inspectEnvironment(validServerEnv(), "server");
    const secret = report.variables.find((v) => v.name === "SUPABASE_SECRET_KEY");
    expect(secret?.requirement).toBe("optional");
    expect(secret?.status).toBe("missing");
    // Its absence must not fail the normal server gate.
    expect(report.ok).toBe(true);
  });

  it("fails closed when a required variable is missing", () => {
    const env = validServerEnv();
    delete env.OPENROUTER_API_KEY;
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(report.counts.missingRequired).toBe(1);
    const openRouter = report.variables.find((v) => v.name === "OPENROUTER_API_KEY");
    expect(openRouter?.status).toBe("missing");
  });

  it("treats a whitespace-free empty string as missing, not present", () => {
    const env = { ...validServerEnv(), OPENROUTER_API_KEY: "" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "OPENROUTER_API_KEY")?.present).toBe(false);
  });

  it("rejects a too-short OpenRouter key as invalid", () => {
    const env = { ...validServerEnv(), OPENROUTER_API_KEY: "short" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(report.counts.invalid).toBe(1);
    expect(report.variables.find((v) => v.name === "OPENROUTER_API_KEY")?.status).toBe("invalid");
  });

  it("rejects a non-HTTPS Supabase URL", () => {
    const env = { ...validServerEnv(), SUPABASE_URL: "http://abcdefgh.supabase.co" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    const supabase = report.variables.find((v) => v.name === "SUPABASE_URL");
    expect(supabase?.status).toBe("invalid");
    expect(supabase?.issue).toMatch(/HTTPS/i);
  });

  it("rejects a malformed evidence function slug", () => {
    const env = { ...validServerEnv(), SUPABASE_EVIDENCE_FUNCTION: "Not A Slug" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "SUPABASE_EVIDENCE_FUNCTION")?.status).toBe("invalid");
  });

  it("still validates SUPABASE_SECRET_KEY when it IS supplied", () => {
    const env = { ...validServerEnv(), SUPABASE_SECRET_KEY: "x" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "SUPABASE_SECRET_KEY")?.status).toBe("invalid");
  });

  it("passes when optional-with-default variables are omitted", () => {
    const report = inspectEnvironment(validServerEnv(), "server");
    const model = report.variables.find((v) => v.name === "OPENROUTER_RESEARCHER_MODEL");
    expect(model?.status).toBe("missing");
    expect(model?.requirement).toBe("optional");
    expect(report.ok).toBe(true);
  });
});

describe("secret safety", () => {
  it("never emits a secret value in the structured report", () => {
    const env = { ...validServerEnv(), SUPABASE_SECRET_KEY: HIDDEN_SUPABASE_MARKER };
    const report = inspectEnvironment(env, "server");
    const serialised = JSON.stringify(report);
    expect(serialised).not.toContain(HIDDEN_SUPABASE_MARKER);
    expect(serialised).not.toContain(HIDDEN_OPENROUTER_MARKER);
    const secretVar = report.variables.find((v) => v.name === "SUPABASE_SECRET_KEY");
    expect(secretVar?.preview).toBe("set (hidden)");
  });

  it("never emits a secret value even when the secret is invalid", () => {
    const env = { ...validServerEnv(), OPENROUTER_API_KEY: `${HIDDEN_OPENROUTER_MARKER}-but-flagged` };
    const shortSecretEnv = { ...validServerEnv(), SUPABASE_SECRET_KEY: "x" };
    const report = inspectEnvironment(shortSecretEnv, "server");
    expect(JSON.stringify(report)).not.toContain("x".repeat(20));
    expect(JSON.stringify(inspectEnvironment(env, "server"))).not.toContain(HIDDEN_OPENROUTER_MARKER);
    const invalidSecret = report.variables.find((v) => v.name === "SUPABASE_SECRET_KEY");
    expect(invalidSecret?.status).toBe("invalid");
    // A secret is redacted even when it fails validation — never its raw value.
    expect(invalidSecret?.preview).toBe("set (hidden)");
  });

  it("keeps the formatted terminal report free of secret values", () => {
    const env = { ...validServerEnv(), SUPABASE_SECRET_KEY: HIDDEN_SUPABASE_MARKER };
    const text = formatPreflightReport(inspectEnvironment(env, "server"));
    expect(text).not.toContain(HIDDEN_SUPABASE_MARKER);
    expect(text).not.toContain(HIDDEN_OPENROUTER_MARKER);
    expect(text).toContain("PREFLIGHT PASSED");
  });
});

describe("browser scope", () => {
  it("passes and previews the reachability origin when the core live variables are set", () => {
    const report = inspectEnvironment(validBrowserEnv(), "browser");
    expect(report.ok).toBe(true);
    const url = report.variables.find((v) => v.name === "VITE_SUPABASE_URL");
    expect(url?.preview).toBe("https://abcdefgh.supabase.co");
  });

  it("fails closed when the core live variables are absent (cannot claim a live route)", () => {
    const report = inspectEnvironment({}, "browser");
    expect(report.ok).toBe(false);
    expect(report.counts.missingRequired).toBe(2);
    for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      const variable = report.variables.find((v) => v.name === name);
      expect(variable?.requirement).toBe("required");
      expect(variable?.status).toBe("missing");
    }
  });

  it("fails when only VITE_SUPABASE_URL is missing", () => {
    const env = validBrowserEnv();
    delete env.VITE_SUPABASE_URL;
    const report = inspectEnvironment(env, "browser");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "VITE_SUPABASE_URL")?.status).toBe("missing");
  });

  it("fails when only VITE_SUPABASE_PUBLISHABLE_KEY is missing", () => {
    const env = validBrowserEnv();
    delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const report = inspectEnvironment(env, "browser");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "VITE_SUPABASE_PUBLISHABLE_KEY")?.status).toBe("missing");
  });

  it("treats the currently-unused VITE_API_BASE_URL as optional", () => {
    const report = inspectEnvironment(validBrowserEnv(), "browser");
    const apiBase = report.variables.find((v) => v.name === "VITE_API_BASE_URL");
    expect(apiBase?.requirement).toBe("optional");
    expect(apiBase?.status).toBe("missing");
    // Its absence does not fail the browser gate.
    expect(report.ok).toBe(true);
  });

  it("requires a modern sb_publishable_ browser key", () => {
    const env = { ...validBrowserEnv(), VITE_SUPABASE_PUBLISHABLE_KEY: "legacy-anon-key-value-1234" };
    const report = inspectEnvironment(env, "browser");
    expect(report.ok).toBe(false);
    expect(report.variables.find((v) => v.name === "VITE_SUPABASE_PUBLISHABLE_KEY")?.status).toBe("invalid");
  });
});

describe("all scope", () => {
  it("fails when the server env is runtime-shaped but the core browser live variables are absent", () => {
    const report = inspectEnvironment(validServerEnv(), "all");
    expect(report.ok).toBe(false);
    expect(report.counts.missingRequired).toBe(2);
  });

  it("passes when both server and core browser live variables are present", () => {
    const env = { ...validServerEnv(), ...validBrowserEnv() };
    const report = inspectEnvironment(env, "all");
    expect(report.ok).toBe(true);
    expect(report.counts.missingRequired).toBe(0);
    expect(report.counts.invalid).toBe(0);
  });
});

describe("parseCliArgs (fail-closed argument handling)", () => {
  it("defaults to the server scope with no arguments", () => {
    expect(parseCliArgs([])).toEqual({ scope: "server", json: false });
  });

  it("accepts the known scopes and --json", () => {
    expect(parseCliArgs(["--scope=browser"]).scope).toBe("browser");
    expect(parseCliArgs(["--scope=all"]).scope).toBe("all");
    expect(parseCliArgs(["--scope=server", "--json"])).toEqual({ scope: "server", json: true });
  });

  it("throws on an unknown --scope value rather than defaulting to server", () => {
    expect(() => parseCliArgs(["--scope=prod"])).toThrow(PreflightUsageError);
    expect(() => parseCliArgs(["--scope=prod"])).toThrow(/Unknown --scope value/);
  });

  it("throws on an empty --scope value", () => {
    expect(() => parseCliArgs(["--scope="])).toThrow(PreflightUsageError);
  });

  it("throws on an unknown flag", () => {
    expect(() => parseCliArgs(["--deploy"])).toThrow(PreflightUsageError);
    expect(() => parseCliArgs(["--json", "--wat"])).toThrow(/Unknown argument/);
  });

  it("throws on a bare --scope with no value", () => {
    expect(() => parseCliArgs(["--scope"])).toThrow(PreflightUsageError);
  });

  it("throws on a positional argument", () => {
    expect(() => parseCliArgs(["server"])).toThrow(PreflightUsageError);
  });
});

describe("registry integrity (must not drift from the real loaders)", () => {
  it("the runtime-shaped env satisfies every real runtime loader", () => {
    const env = validServerEnv();
    expect(() => loadEvidenceConfiguration(env)).not.toThrow();
    expect(() => loadResearcherConfiguration(env)).not.toThrow();
    expect(() => loadDesignerConfiguration(env)).not.toThrow();
    expect(() => loadMakerConfiguration(env)).not.toThrow();
    expect(() => loadCommunicatorConfiguration(env)).not.toThrow();
    expect(() => loadManagerConfiguration(env)).not.toThrow();
  });

  it("agrees with the MCP evidence loader on a bad Supabase URL", () => {
    const env = { ...validServerEnv(), SUPABASE_URL: "http://insecure.example" };
    const report = inspectEnvironment(env, "server");
    expect(report.ok).toBe(false);
    expect(() => loadEvidenceConfiguration(env)).toThrow();
  });

  it("agrees with the agent loaders on a missing OpenRouter key", () => {
    const env = validServerEnv();
    delete env.OPENROUTER_API_KEY;
    expect(inspectEnvironment(env, "server").ok).toBe(false);
    expect(() => loadResearcherConfiguration(env)).toThrow();
    expect(() => loadManagerConfiguration(env)).toThrow();
  });

  it("covers every OPENROUTER_*_MODEL used by the five agent loaders", () => {
    const modelVars = preflightVariables
      .filter((v) => v.name.startsWith("OPENROUTER_") && v.name.endsWith("_MODEL"))
      .map((v) => v.name);
    expect(modelVars).toEqual([
      "OPENROUTER_RESEARCHER_MODEL",
      "OPENROUTER_DESIGNER_MODEL",
      "OPENROUTER_MAKER_MODEL",
      "OPENROUTER_COMMUNICATOR_MODEL",
      "OPENROUTER_MANAGER_MODEL",
    ]);
  });
});
