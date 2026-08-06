import { ClarificationClientError, LiveClarificationClient } from "./clarificationClient";

export type BrowserClarificationEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_CLARIFICATION_FUNCTION?: string;
};

const functionNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const capabilityPattern = /^[A-Za-z0-9._~-]{32,2048}$/;

export function createBrowserClarificationClient(
  capabilityToken: string,
  environment: BrowserClarificationEnvironment = import.meta.env,
  fetchImplementation: typeof fetch = fetch,
) {
  const baseUrl = environment.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
  const functionName = environment.VITE_SUPABASE_CLARIFICATION_FUNCTION
    ?? "retentionlab-clarification";

  if (!baseUrl?.startsWith("https://")) {
    throw new ClarificationClientError(
      "invalid_request",
      "Browser clarification configuration requires an HTTPS Supabase URL.",
      500,
    );
  }
  if (!publishableKey?.startsWith("sb_publishable_")) {
    throw new ClarificationClientError(
      "invalid_request",
      "Browser clarification configuration requires a modern Supabase publishable key.",
      500,
    );
  }
  if (!functionNamePattern.test(functionName)) {
    throw new ClarificationClientError(
      "invalid_request",
      "Browser clarification function name is invalid.",
      500,
    );
  }
  if (!capabilityPattern.test(capabilityToken)) {
    throw new ClarificationClientError(
      "forbidden",
      "Recovery capability is unavailable.",
      403,
    );
  }

  return new LiveClarificationClient({
    gatewayUrl: `${baseUrl}/functions/v1/${functionName}`,
    publishableKey,
    capabilityToken,
  }, fetchImplementation);
}
