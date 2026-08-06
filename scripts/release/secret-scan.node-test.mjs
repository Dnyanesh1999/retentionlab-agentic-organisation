import assert from "node:assert/strict";
import test from "node:test";

import { scanContent, scanEntries } from "./secret-scan.mjs";

test("flags a PEM private key block", () => {
  const header = ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ");
  const findings = scanContent(
    "server/key.pem",
    `${header}\nMIIEpAIBAAKC\n-----END RSA PRIVATE KEY-----\n`,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "private-key-block");
  assert.ok(!findings[0].redacted.includes("MIIEpAIBAAKC"));
});

test("flags an OpenRouter-style secret key", () => {
  const token = ["sk", "or", "v1", "0123456789abcdef0123456789abcdef"].join("-");
  const findings = scanContent("agents/config.ts", `const key = "${token}";`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "openai-openrouter-key");
});

test("flags a three-segment JWT as a possible service-role key", () => {
  const jwt = ["ey", "JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghij_klmnop"].join("");
  const findings = scanContent(".env.local", `SUPABASE_SECRET_KEY=${jwt}`);
  assert.ok(findings.some((finding) => finding.rule === "jwt-service-token"));
});

test("flags AWS, Google, GitHub and Slack credential shapes", () => {
  const findings = scanEntries([
    { path: "a.txt", content: ["AK", "IA", "IOSFODNN7EXAMPLE"].join("") },
    { path: "b.txt", content: ["AI", "za", "b".repeat(35)].join("") },
    { path: "c.txt", content: ["gh", "p_", "0123456789012345678901234567890123456789"].join("") },
    { path: "d.txt", content: ["xo", "xb-", "1234567890-abcdefghij"].join("") },
  ]);
  const rules = new Set(findings.map((finding) => finding.rule));
  assert.ok(rules.has("aws-access-key-id"));
  assert.ok(rules.has("google-api-key"));
  assert.ok(rules.has("github-token"));
  assert.ok(rules.has("slack-token"));
});

test("flags an inline assignment to a secret-named slot", () => {
  const value = ["super", "secret", "value", "1234567890"].join("-");
  const findings = scanContent(
    "src/bad.ts",
    `export const SUPABASE_SERVICE_ROLE_KEY = "${value}";`,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "inline-secret-assignment");
});

test("flags a real Supabase secret key but not underscore test fixtures", () => {
  const realToken = ["sb", "secret", "a".repeat(40)].join("_");
  const real = scanContent("leak.ts", `const k = "${realToken}";`);
  assert.ok(real.some((finding) => finding.rule === "supabase-secret-key"));
  const fixture = scanContent(
    "index.test.ts",
    'const secretKey = "sb_secret_clarification_edge_test";',
  );
  assert.deepEqual(fixture, []);
});

test("ignores empty and placeholder secret slots", () => {
  const clean = [
    "SUPABASE_SECRET_KEY=",
    "OPENROUTER_API_KEY=",
    'const key = process.env.SUPABASE_SECRET_KEY;',
    'const key: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;',
    'API_KEY="<your-key-here>"',
    'PASSWORD="changeme"',
    "SUPABASE_SECRET_KEY: string;",
    'apikey: "sb_publishable_clarification_test_key",',
    'openai_api_key = "env(OPENAI_API_KEY)"',
    'auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"',
  ].join("\n");
  assert.deepEqual(scanContent(".env.example", clean), []);
});

test("a marker cannot exempt a file containing a credential", () => {
  const marker = ["secret-scan", "allow-file"].join(":");
  const token = ["sk", "or", "v1", "a".repeat(40)].join("-");
  const content = `// ${marker}\nconst k = "${token}";`;
  assert.equal(scanContent("fixtures.ts", content).length, 1);
});

test("does not scan value bytes of binary/lock artefacts by extension", () => {
  // A PNG blob may contain byte runs that look like tokens; it must not error
  // or false-positive.
  const token = ["AK", "IA", "IOSFODNN7EXAMPLE"].join("");
  assert.deepEqual(scanContent("output/shot.png", token), []);
});

test("scanEntries returns a deterministic, path-sorted order", () => {
  const anotherValue = ["another", "long", "secret", "value", "here"].join("-");
  const firstValue = ["one", "long", "secret", "value", "goes", "here"].join("-");
  const findings = scanEntries([
    { path: "z.ts", content: `K_API_KEY = "${anotherValue}"` },
    { path: "a.ts", content: `J_SECRET = "${firstValue}"` },
  ]);
  assert.deepEqual(
    findings.map((finding) => finding.path),
    ["a.ts", "z.ts"],
  );
});
