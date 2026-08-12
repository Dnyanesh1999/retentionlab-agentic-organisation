// CLI wrapper for the deployment configuration preflight.
//
// Usage (via npm run preflight [-- <flags>]):
//   --scope=server|browser|all   Which variable set to inspect (default: server).
//   --json                       Emit the secret-free report as JSON instead of text.
//
// Fail-closed on every axis: an unknown flag or invalid --scope prints a usage error to
// stderr and exits non-zero (it never silently defaults to server); any missing required
// variable or invalid value also exits non-zero. It reads only the process environment
// (the npm script preloads .env.local if present), contacts no network, and never prints
// a secret value.

import { formatPreflightReport, inspectEnvironment, parseCliArgs, PreflightUsageError } from "./preflight.js";

try {
  const { scope, json } = parseCliArgs(process.argv.slice(2));
  const report = inspectEnvironment(process.env, scope);

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatPreflightReport(report)}\n`);
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  if (error instanceof PreflightUsageError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
