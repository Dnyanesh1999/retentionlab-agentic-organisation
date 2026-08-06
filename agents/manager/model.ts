import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import { MANAGER_PROMPT_VERSION, managerDecisionDraftSchema, type ManagerInput } from "./contracts.js";
import { buildManagerTask, MANAGER_SYSTEM_PROMPT } from "./prompt.js";

export type ManagerModelResult = { text: string; resolvedModel: string };
export type ManagerRevisionFeedback = { validation_error: string; previous_output: string };

export interface ManagerModelAdapter {
  readonly requestedModel: string;
  generate(input: ManagerInput, revision?: ManagerRevisionFeedback): Promise<ManagerModelResult>;
}

export class OpenRouterManagerModel implements ManagerModelAdapter {
  readonly requestedModel: string;
  private readonly client: OpenRouter;

  constructor(configuration: { apiKey: string; model: string }) {
    this.requestedModel = configuration.model;
    this.client = new OpenRouter({ apiKey: configuration.apiKey });
  }

  async generate(input: ManagerInput, revision?: ManagerRevisionFeedback): Promise<ManagerModelResult> {
    const response = await this.client.chat.send({
      appTitle: "RetentionLab Manager",
      appCategories: "education,agent,governance",
      chatRequest: {
        model: this.requestedModel,
        messages: [
          { role: "system", content: MANAGER_SYSTEM_PROMPT },
          { role: "user", content: buildManagerTask(input, revision) },
        ],
        stream: false,
        maxCompletionTokens: 6_000,
        temperature: 0.1,
        reasoningEffort: "none",
        sessionId: input.run_id,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "retentionlab_manager_decision",
            description: "Accountable approve/revise/reject decision over the complete artefact chain.",
            schema: z.toJSONSchema(managerDecisionDraftSchema),
            strict: true,
          },
        },
        metadata: {
          project: "retentionlab",
          agent: "manager",
          run_id: input.run_id,
          prompt_version: MANAGER_PROMPT_VERSION,
        },
      },
    }, {
      timeoutMs: 300_000,
      signal: AbortSignal.timeout(300_000),
      retries: {
        strategy: "backoff",
        retryConnectionErrors: true,
        backoff: { initialInterval: 500, maxInterval: 4_000, exponent: 2, maxElapsedTime: 15_000 },
      },
      retryCodes: ["429", "502", "503", "504"],
    });

    if (!("choices" in response)) {
      throw new Error("OpenRouter unexpectedly returned a stream for a non-streaming Manager request.");
    }
    const content = response.choices[0]?.message.content;
    if (response.choices[0]?.finishReason === "length") {
      throw new Error("OpenRouter truncated the ManagerOperationalDecision at the model output limit.");
    }
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("OpenRouter returned no ManagerOperationalDecision draft.");
    }
    return { text: content, resolvedModel: response.model };
  }
}
