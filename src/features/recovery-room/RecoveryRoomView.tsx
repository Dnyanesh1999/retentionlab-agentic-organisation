import { RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { createBrowserSignalGardenEvidenceClient } from "./browserEvidenceClient";
import type { SignalGardenEvidenceClient } from "./contracts";
import { LoadingState } from "./LoadingState";
import { SignalCanvas } from "./SignalCanvas";
import { useSignalGardenSnapshot } from "./useSignalGardenSnapshot";

export type RecoveryRoomViewProps = {
  accountSlug: string;
  client: SignalGardenEvidenceClient;
  reducedMotion?: boolean;
};

export function RecoveryRoomView({ accountSlug, client, reducedMotion }: RecoveryRoomViewProps) {
  const { state, retry } = useSignalGardenSnapshot(client, accountSlug);

  if (state.status === "loading") {
    return <LoadingState progress={35} reducedMotion={reducedMotion} />;
  }

  if (state.status === "error") {
    return (
      <section className="signal-garden-error" role="alert" data-error-code={state.error.code}>
        <TriangleAlert aria-hidden="true" strokeWidth={1.5} />
        <h2>Signal garden unavailable</h2>
        <p>We couldn&apos;t prepare the live account snapshot. No fallback values were shown.</p>
        <button type="button" onClick={retry}>
          <RefreshCw aria-hidden="true" size={17} strokeWidth={1.7} />
          Try again
        </button>
      </section>
    );
  }

  return <SignalCanvas snapshot={state.snapshot} reducedMotion={reducedMotion} />;
}

type ClientResolution =
  | { status: "ready"; client: SignalGardenEvidenceClient }
  | { status: "invalid-configuration" };

function resolveBrowserClient(): ClientResolution {
  try {
    return { status: "ready", client: createBrowserSignalGardenEvidenceClient() };
  } catch {
    return { status: "invalid-configuration" };
  }
}

export function RecoveryRoomRoute() {
  const [resolution] = useState(resolveBrowserClient);

  if (resolution.status === "invalid-configuration") {
    return (
      <section className="signal-garden-error" role="alert" data-error-code="invalid_configuration">
        <TriangleAlert aria-hidden="true" strokeWidth={1.5} />
        <h2>Signal garden unavailable</h2>
        <p>The live evidence connection is not configured for this environment.</p>
      </section>
    );
  }

  return <RecoveryRoomView accountSlug="copper-finch" client={resolution.client} />;
}
