import {
  LiveSignalGardenEvidenceClient,
  SignalGardenClientError,
} from "./liveEvidenceClient";

export type BrowserEvidenceEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_EVIDENCE_FUNCTION?: string;
};

const functionNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createBrowserSignalGardenEvidenceClient(
  environment: BrowserEvidenceEnvironment = import.meta.env,
  fetchImplementation: typeof fetch = fetch,
) {
  const baseUrl = environment.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
  const functionName = environment.VITE_SUPABASE_EVIDENCE_FUNCTION ?? "retentionlab-evidence";

  if (!baseUrl?.startsWith("https://")) {
    throw new SignalGardenClientError(
      "invalid_request",
      "Browser evidence configuration requires an HTTPS Supabase URL.",
      500,
    );
  }
  if (!publishableKey?.startsWith("sb_publishable_")) {
    throw new SignalGardenClientError(
      "invalid_request",
      "Browser evidence configuration requires a modern Supabase publishable key.",
      500,
    );
  }
  if (!functionNamePattern.test(functionName)) {
    throw new SignalGardenClientError(
      "invalid_request",
      "Browser evidence function name is invalid.",
      500,
    );
  }

  return new LiveSignalGardenEvidenceClient(
    {
      gatewayUrl: `${baseUrl}/functions/v1/${functionName}`,
      publishableKey,
    },
    fetchImplementation,
  );
}
