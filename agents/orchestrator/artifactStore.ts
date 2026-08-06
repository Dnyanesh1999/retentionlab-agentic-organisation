import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { z } from "zod";

import { STAGE_ORDER, type OrchestratorStage } from "./contracts.js";
import { OrchestratorError } from "./errors.js";

// ---------------------------------------------------------------------------
// Run-owned artefact store for the live five-agent composition (Gate 9 slice 2).
//
// Every real typed artefact a stage produces is persisted under ONE run directory
// with a versioned, stage-scoped filename and EXCLUSIVE creation. The store never
// overwrites and never silently reuses: a caller that finds a durable file must
// schema-validate and hash-check it against orchestration state before adopting it.
//
// SHA-256 references use the repository compact schema-parsed JSON convention:
//   sha256( JSON.stringify( schema.parse(artifact) ) )
// identical to how the Designer/Maker/Communicator/Manager runtimes embed their
// predecessor lineage hashes, so an orchestrator ArtifactReference and an embedded
// lineage link over the same artefact are byte-for-byte the same digest.
// ---------------------------------------------------------------------------

// The on-disk base name for each stage. Versioned as `<base>.v<version>.json`.
export const STAGE_FILE_BASE: Readonly<Record<OrchestratorStage, string>> = {
  researcher: "researcher.research-brief",
  designer: "designer.recovery-design",
  maker: "maker.recovery-room-artifact",
  communicator: "communicator.communication-plan",
  manager: "manager.operational-decision",
};

export function artifactFileName(stage: OrchestratorStage, version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new OrchestratorError("ILLEGAL_EVENT", `Refusing artefact version ${version} for ${stage}.`);
  }
  return `${STAGE_FILE_BASE[stage]}.v${version}.json`;
}

export function artifactPath(runDir: string, stage: OrchestratorStage, version: number): string {
  return join(runDir, artifactFileName(stage, version));
}

// Repository compact hashing convention over the schema-parsed artefact. Re-parsing an already-valid
// object is idempotent and pins key order to the schema definition, so the digest is stable and
// independent of file formatting or how the object was constructed.
export function compactArtifactHash<T>(schema: z.ZodType<T>, value: unknown): string {
  const parsed = schema.parse(value);
  return createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
}

export type LoadedArtifact<T> = {
  readonly parsed: T;
  readonly sha256: string;
  readonly path: string;
};

// Load + schema-validate a durable artefact. Returns null ONLY when the file is absent (ENOENT), so a
// caller can distinguish "nothing written yet" (produce) from "written but unreadable/invalid"
// (fail closed). A torn or tampered file surfaces as a thrown OrchestratorError, never as null.
export async function loadArtifactIfPresent<T>(
  runDir: string,
  stage: OrchestratorStage,
  version: number,
  schema: z.ZodType<T>,
): Promise<LoadedArtifact<T> | null> {
  const path = artifactPath(runDir, stage, version);
  let raw: string;
  try {
    raw = await readFile(path, { encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OrchestratorError("CORRUPTED_HISTORY", `Artefact ${path} is not valid JSON (torn or truncated write).`);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new OrchestratorError("CORRUPTED_HISTORY", `Artefact ${path} failed schema validation: ${result.error.message}`);
  }
  const parsed = result.data;
  return { parsed, sha256: createHash("sha256").update(JSON.stringify(parsed)).digest("hex"), path };
}

// Persist a freshly produced artefact with exclusive creation. The file is pretty-printed for
// inspection; the returned digest is the compact convention. A second attempt to write the same
// stage/version fails with RUN_EXISTS rather than overwriting — the single-writer invariant is also
// enforced by the run lock, but this is the last line of defence.
export async function writeArtifactExclusive<T>(
  runDir: string,
  stage: OrchestratorStage,
  version: number,
  schema: z.ZodType<T>,
  artifact: unknown,
): Promise<LoadedArtifact<T>> {
  const parsed = schema.parse(artifact);
  const path = artifactPath(runDir, stage, version);
  await mkdir(runDir, { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new OrchestratorError("RUN_EXISTS", `Refusing to overwrite existing artefact ${path}.`);
    }
    throw error;
  }
  return { parsed, sha256: createHash("sha256").update(JSON.stringify(parsed)).digest("hex"), path };
}

export const ORDERED_STAGES: readonly OrchestratorStage[] = STAGE_ORDER;
