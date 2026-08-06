import { z } from "zod";

const schema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_COMMUNICATOR_MODEL: z.string().min(1).default("nvidia/nemotron-3-super-120b-a12b:free"),
}).strict();

export function loadCommunicatorConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const value = schema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_COMMUNICATOR_MODEL: environment.OPENROUTER_COMMUNICATOR_MODEL,
  });
  return { apiKey: value.OPENROUTER_API_KEY, model: value.OPENROUTER_COMMUNICATOR_MODEL };
}
