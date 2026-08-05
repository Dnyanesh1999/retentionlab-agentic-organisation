import { useCallback, useEffect, useState } from "react";

import type { SignalGardenEvidenceClient, SignalGardenSnapshot } from "./contracts";
import { SignalGardenClientError } from "./liveEvidenceClient";

export type SignalGardenLoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: SignalGardenSnapshot }
  | { status: "error"; error: SignalGardenClientError };

function normalizeError(error: unknown) {
  if (error instanceof SignalGardenClientError) return error;
  return new SignalGardenClientError(
    "invalid_contract",
    "Signal Garden evidence failed without a recognized source error.",
    502,
  );
}

export function useSignalGardenSnapshot(
  client: SignalGardenEvidenceClient,
  accountSlug: string,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    client: SignalGardenEvidenceClient;
    accountSlug: string;
    attempt: number;
    state: SignalGardenLoadState;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void client.getSnapshot(accountSlug, controller.signal).then(
      (snapshot) => {
        if (!controller.signal.aborted) {
          setResult({ client, accountSlug, attempt, state: { status: "ready", snapshot } });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            client,
            accountSlug,
            attempt,
            state: { status: "error", error: normalizeError(error) },
          });
        }
      },
    );

    return () => controller.abort();
  }, [accountSlug, attempt, client]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const state = result?.client === client
    && result.accountSlug === accountSlug
    && result.attempt === attempt
    ? result.state
    : { status: "loading" as const };

  return { state, retry } as const;
}
