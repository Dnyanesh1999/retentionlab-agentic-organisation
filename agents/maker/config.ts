import { z } from "zod";

const makerConfigurationSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_MAKER_MODEL: z.string().min(1).default("nvidia/nemotron-3-super-120b-a12b:free"),
}).strict();

export type MakerConfiguration = { apiKey: string; model: string };

export function loadMakerConfiguration(environment: NodeJS.ProcessEnv = process.env): MakerConfiguration {
  const parsed = makerConfigurationSchema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_MAKER_MODEL: environment.OPENROUTER_MAKER_MODEL,
  });
  return { apiKey: parsed.OPENROUTER_API_KEY, model: parsed.OPENROUTER_MAKER_MODEL };
}
