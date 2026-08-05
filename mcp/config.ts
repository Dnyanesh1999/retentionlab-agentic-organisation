import { z } from "zod";

const configurationSchema = z.object({
  SUPABASE_URL: z.string().url().refine((value) => value.startsWith("https://"), "SUPABASE_URL must use HTTPS"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_EVIDENCE_FUNCTION: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("retentionlab-evidence"),
}).strict();

export type EvidenceConfiguration = {
  gatewayUrl: string;
  publishableKey: string;
};

export function loadEvidenceConfiguration(environment: NodeJS.ProcessEnv = process.env): EvidenceConfiguration {
  const parsed = configurationSchema.parse({
    SUPABASE_URL: environment.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: environment.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_EVIDENCE_FUNCTION: environment.SUPABASE_EVIDENCE_FUNCTION,
  });

  return {
    gatewayUrl: `${parsed.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${parsed.SUPABASE_EVIDENCE_FUNCTION}`,
    publishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
  };
}
