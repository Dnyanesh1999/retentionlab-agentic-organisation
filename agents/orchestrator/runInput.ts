import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { OrchestratorError } from "./errors.js";

// The immutable run inputs the Researcher needs (objective, initiated_at) that are not carried on the
// orchestrator's run_started event. Written once, exclusively, at run start; reloaded verbatim on
// every resume so the Researcher's input is identical across a crash boundary. `initiated_at` is
// frozen at start so a resumed run does not silently re-stamp its objective time.

export const RUN_INPUT_FILE = "run-input.json";

export const runInputSchema = z.object({
  run_id: z.string().uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  objective: z.string().min(20).max(500),
  initiated_at: z.string().datetime({ offset: true }),
}).strict();

export type RunInputRecord = z.infer<typeof runInputSchema>;

export async function writeRunInput(runDir: string, record: RunInputRecord): Promise<void> {
  const parsed = runInputSchema.parse(record);
  try {
    await writeFile(join(runDir, RUN_INPUT_FILE), `${JSON.stringify(parsed, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new OrchestratorError("RUN_EXISTS", `Run inputs already exist for ${record.run_id}; refusing to overwrite.`);
    }
    throw error;
  }
}

export async function readRunInput(runDir: string): Promise<RunInputRecord> {
  let raw: string;
  try {
    raw = await readFile(join(runDir, RUN_INPUT_FILE), { encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new OrchestratorError("RUN_NOT_FOUND", `No run inputs found in ${runDir}.`);
    }
    throw error;
  }
  return runInputSchema.parse(JSON.parse(raw));
}
