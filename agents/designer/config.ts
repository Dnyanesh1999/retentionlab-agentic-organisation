import { z } from "zod";

const designerConfigurationSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_DESIGNER_MODEL: z.string().min(1).default("nvidia/nemotron-3-super-120b-a12b:free"),
}).strict();

export type DesignerConfiguration = { apiKey: string; model: string };

export function loadDesignerConfiguration(environment: NodeJS.ProcessEnv = process.env): DesignerConfiguration {
  const parsed = designerConfigurationSchema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_DESIGNER_MODEL: environment.OPENROUTER_DESIGNER_MODEL,
  });
  return { apiKey: parsed.OPENROUTER_API_KEY, model: parsed.OPENROUTER_DESIGNER_MODEL };
}
