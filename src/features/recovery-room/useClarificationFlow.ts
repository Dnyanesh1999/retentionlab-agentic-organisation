import { useCallback, useEffect, useRef, useState } from "react";

import type { ClarificationClient } from "./clarificationClient";
import { normalizeObservation, type ClarificationReceipt } from "./clarificationContracts";

type ClarificationFlowState =
  | { status: "closed"; observation: ""; error: null; receipt: null }
  | { status: "open"; observation: string; error: string | null; receipt: null }
  | { status: "submitting"; observation: string; error: null; receipt: null }
  | { status: "shared"; observation: ""; error: null; receipt: ClarificationReceipt };

export type UseClarificationFlowInput = {
  accountSlug: string;
  supportEvidenceKey: string;
  preferenceEvidenceKey: string;
  client: ClarificationClient | null;
  createRequestId?: () => string;
};

const closedState: ClarificationFlowState = {
  status: "closed",
  observation: "",
  error: null,
  receipt: null,
};

export function useClarificationFlow({
  accountSlug,
  supportEvidenceKey,
  preferenceEvidenceKey,
  client,
  createRequestId = () => crypto.randomUUID(),
}: UseClarificationFlowInput) {
  const [state, setState] = useState<ClarificationFlowState>(closedState);
  const requestIdRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const open = useCallback(() => {
    if (!client || state.status === "shared") return;
    requestIdRef.current = null;
    setState({ status: "open", observation: "", error: null, receipt: null });
  }, [client, state.status]);

  const setObservation = useCallback((observation: string) => {
    setState((current) => current.status === "open"
      ? { ...current, observation, error: null }
      : current);
  }, []);

  const dismiss = useCallback(() => {
    if (submittingRef.current) return;
    requestIdRef.current = null;
    setState((current) => current.status === "shared" ? current : closedState);
  }, []);

  const share = useCallback(async () => {
    if (!client || submittingRef.current || state.status !== "open") return;

    const observation = state.observation;
    setState({ status: "submitting", observation, error: null, receipt: null });

    submittingRef.current = true;
    const requestId = requestIdRef.current ?? createRequestId();
    requestIdRef.current = requestId;
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const receipt = await client.share({
        schema_version: "clarification-submission.v1",
        account_slug: accountSlug,
        support_evidence_key: supportEvidenceKey,
        preference_evidence_key: preferenceEvidenceKey,
        observation: normalizeObservation(observation),
        consent: { action: "share_observation", copy_version: "clarification-consent.v1" },
      }, requestId, controller.signal);
      requestIdRef.current = null;
      setState({ status: "shared", observation: "", error: null, receipt });
    } catch {
      if (!controller.signal.aborted) {
        setState({
          status: "open",
          observation,
          error: "Observation not shared. Your text is still here.",
          receipt: null,
        });
      }
    } finally {
      submittingRef.current = false;
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [accountSlug, client, createRequestId, preferenceEvidenceKey, state, supportEvidenceKey]);

  return {
    available: client !== null,
    dialogOpen: state.status === "open" || state.status === "submitting",
    submitting: state.status === "submitting",
    shared: state.status === "shared",
    observation: state.observation,
    error: state.error,
    receipt: state.receipt,
    open,
    setObservation,
    dismiss,
    share,
  } as const;
}
