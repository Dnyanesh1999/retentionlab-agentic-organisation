import { z } from "zod";

const researcherConfigurationSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(20),
  OPENROUTER_RESEARCHER_MODEL: z.string().min(1).default("nvidia/nemotron-3-super-120b-a12b:free"),
}).strict();

export type ResearcherConfiguration = {
  apiKey: string;
  model: string;
};

export function loadResearcherConfiguration(environment: NodeJS.ProcessEnv = process.env): ResearcherConfiguration {
  const parsed = researcherConfigurationSchema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_RESEARCHER_MODEL: environment.OPENROUTER_RESEARCHER_MODEL,
  });
  return { apiKey: parsed.OPENROUTER_API_KEY, model: parsed.OPENROUTER_RESEARCHER_MODEL };
}
