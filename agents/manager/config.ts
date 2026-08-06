import { z } from "zod";

const managerConfigurationSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_MANAGER_MODEL: z.string().min(1).default("nvidia/nemotron-3-super-120b-a12b:free"),
}).strict();

export type ManagerConfiguration = { apiKey: string; model: string };

export function loadManagerConfiguration(environment: NodeJS.ProcessEnv = process.env): ManagerConfiguration {
  const parsed = managerConfigurationSchema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_MANAGER_MODEL: environment.OPENROUTER_MANAGER_MODEL,
  });
  return { apiKey: parsed.OPENROUTER_API_KEY, model: parsed.OPENROUTER_MANAGER_MODEL };
}
