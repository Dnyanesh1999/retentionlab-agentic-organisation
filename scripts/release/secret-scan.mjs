// Deterministic secret scanner shared by the repository audit and the code-ZIP
// verification. It works on in-memory { path, content } entries so the same
// rules apply to tracked files and to the exact bytes written into the release
// archive. High-signal credential shapes are matched directly; a conservative
// secondary rule catches inline `KEY = "…"` assignments while ignoring the
// empty-value placeholders that `.env.example` and documentation legitimately
// contain.

// Files whose bytes are never scanned for secret *values*. These are binary or
// integrity-lock artefacts where a long base64/hex run is expected and is not a
// credential. Their presence in the ZIP is still governed by the packaging
// allow/deny lists, not here.
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".zip",
  ".gz",
  ".mp4",
  ".mov",
]);

// Values that read like a secret slot but are deliberately inert. Matched
// case-insensitively against the captured assignment value.
const PLACEHOLDER_VALUES = [
  "",
  "changeme",
  "change-me",
  "example",
  "your-key-here",
  "your_key_here",
  "replace-me",
  "todo",
  "xxx",
  "xxxx",
  "placeholder",
  "redacted",
];

const PLACEHOLDER_PATTERNS = [
  /^<.*>$/, // <your-key>
  /^\$\{.*\}$/, // ${SUPABASE_SECRET_KEY}
  /^process\.env\./, // process.env.SECRET
  /^import\.meta\.env\./,
  /^env\(.*\)$/i, // supabase config.toml env(NAME) references
  /^your[-_]/i,
  /^example[-_]/i,
  /^sk-or-\.\.\./, // documentation ellipsis
  /^sb_publishable_/, // Supabase publishable keys are public identifiers, not secrets
  // Named test/example/demo fixtures — a leaked real credential is a single
  // high-entropy run and never carries these readable underscore/dash tokens.
  /(^|[_-])(test|example|demo|sample|fake|dummy|mock|local|placeholder)([_-]|$)/i,
];

// High-signal credential shapes. Each rule redacts the match so the scanner
// output can be logged without re-leaking the value it found.
const CREDENTIAL_RULES = [
  {
    id: "private-key-block",
    description: "PEM private key block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: "openai-openrouter-key",
    description: "OpenAI/OpenRouter secret key",
    regex: /\bsk-(?:or-)?(?:v1-)?[A-Za-z0-9]{24,}\b/g,
  },
  {
    id: "aws-access-key-id",
    description: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "google-api-key",
    description: "Google API key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "github-token",
    description: "GitHub personal access / server token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
  },
  {
    id: "slack-token",
    description: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "supabase-secret-key",
    // A real Supabase secret key is `sb_secret_` followed by one continuous
    // base62 run. Underscore-separated test fixtures (sb_secret_..._test) break
    // the run and are correctly not matched here.
    description: "Supabase secret key",
    regex: /\bsb_secret_[A-Za-z0-9]{24,}\b/g,
  },
  {
    id: "jwt-service-token",
    // A three-segment JWT. Supabase secret/service-role keys are JWTs, so any
    // real JWT literal in tracked source is treated as a leaked credential.
    description: "JWT (possible Supabase service-role key)",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

// Secondary, conservative rule: an inline assignment of a secret-named slot to
// a quoted literal that is long enough and not a placeholder.
const ASSIGNMENT_REGEX =
  /\b([A-Za-z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|SERVICE_ROLE|API[_-]?KEY|AUTH[_-]?TOKEN)[A-Za-z0-9_]*)\s*[:=]\s*(["'])([^"'\n]+)\2/gi;

function extensionOf(path) {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

function redact(match) {
  if (match.length <= 8) return "***";
  return `${match.slice(0, 4)}…${match.slice(-2)} (${match.length} chars)`;
}

function isPlaceholder(rawValue) {
  const value = rawValue.trim();
  if (PLACEHOLDER_VALUES.includes(value.toLowerCase())) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i += 1) {
    if (content[i] === "\n") line += 1;
  }
  return line;
}

/**
 * Scan a single text file's content. Returns an array of findings; empty when
 * the content is clean. `path` is used only for reporting and extension checks.
 */
export function scanContent(path, content) {
  if (BINARY_EXTENSIONS.has(extensionOf(path))) return [];
  if (typeof content !== "string") return [];
  const findings = [];

  for (const rule of CREDENTIAL_RULES) {
    rule.regex.lastIndex = 0;
    let match;
    while ((match = rule.regex.exec(content)) !== null) {
      findings.push({
        path,
        rule: rule.id,
        description: rule.description,
        line: lineNumberAt(content, match.index),
        redacted: redact(match[0]),
      });
    }
  }

  ASSIGNMENT_REGEX.lastIndex = 0;
  let assignment;
  while ((assignment = ASSIGNMENT_REGEX.exec(content)) !== null) {
    const [, name, , value] = assignment;
    if (isPlaceholder(value)) continue;
    if (value.trim().length < 16) continue;
    findings.push({
      path,
      rule: "inline-secret-assignment",
      description: `Inline assignment to secret-named slot "${name}"`,
      line: lineNumberAt(content, assignment.index),
      redacted: redact(value),
    });
  }

  return findings;
}

/**
 * Scan many { path, content } entries. Returns a flat, path-sorted findings
 * array so callers can fail closed deterministically.
 */
export function scanEntries(entries) {
  const findings = [];
  for (const entry of entries) {
    findings.push(...scanContent(entry.path, entry.content));
  }
  return findings.sort(
    (a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
}
