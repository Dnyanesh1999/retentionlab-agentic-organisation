import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import { communicationDraftSchema, type CommunicatorInput } from "./contracts.js";
import { buildCommunicatorTask, COMMUNICATOR_SYSTEM_PROMPT } from "./prompt.js";

export type CommunicatorModelResult = { text: string; resolvedModel: string };
export interface CommunicatorModelAdapter {
  readonly requestedModel: string;
  generate(input: CommunicatorInput, revision?: { validation_error: string; previous_output: string }): Promise<CommunicatorModelResult>;
}

export class OpenRouterCommunicatorModel implements CommunicatorModelAdapter {
  readonly requestedModel: string;
  private readonly client: OpenRouter;

  constructor(configuration: { apiKey: string; model: string }) {
    this.requestedModel = configuration.model;
    this.client = new OpenRouter({ apiKey: configuration.apiKey });
  }

  async generate(input: CommunicatorInput, revision?: { validation_error: string; previous_output: string }) {
    const response = await this.client.chat.send({
      appTitle: "RetentionLab Communicator",
      appCategories: "education,agent,marketing",
      chatRequest: {
        model: this.requestedModel,
        messages: [
          { role: "system", content: COMMUNICATOR_SYSTEM_PROMPT },
          { role: "user", content: buildCommunicatorTask(input, revision) },
        ],
        stream: false,
        maxCompletionTokens: 6_000,
        temperature: 0.1,
        reasoningEffort: "none",
        sessionId: input.run_id,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "retentionlab_communication_draft",
            description: "Evidence-disciplined customer invitation and Manager handoff.",
            schema: z.toJSONSchema(communicationDraftSchema),
            strict: true,
          },
        },
        metadata: { project: "retentionlab", agent: "communicator", run_id: input.run_id, prompt_version: "communicator.v1.2.0" },
      },
    }, {
      timeoutMs: 120_000,
      signal: AbortSignal.timeout(120_000),
      retries: {
        strategy: "backoff",
        retryConnectionErrors: true,
        backoff: { initialInterval: 500, maxInterval: 4_000, exponent: 2, maxElapsedTime: 15_000 },
      },
      retryCodes: ["429", "502", "503", "504"],
    });
    if (!("choices" in response)) throw new Error("OpenRouter unexpectedly returned a stream for the Communicator request.");
    const content = response.choices[0]?.message.content;
    if (response.choices[0]?.finishReason === "length") throw new Error("OpenRouter truncated the CommunicationPlan.");
    if (typeof content !== "string" || content.length === 0) throw new Error("OpenRouter returned no CommunicationPlan draft.");
    return { text: content, resolvedModel: response.model };
  }
}
