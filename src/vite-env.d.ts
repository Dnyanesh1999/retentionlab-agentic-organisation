/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_EVIDENCE_FUNCTION?: string;
  readonly VITE_SUPABASE_CLARIFICATION_FUNCTION?: string;
  readonly VITE_SUPABASE_RUNS_FUNCTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
