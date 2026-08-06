import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import {
  makerDraftSchema,
  type MakerDraft,
  type MakerImplementationEvidence,
  type MakerInput,
} from "./contracts.js";
import { buildMakerTask, MAKER_SYSTEM_PROMPT } from "./prompt.js";

export type MakerModelResult = { text: string; resolvedModel: string };
export type MakerRevisionFeedback = { validation_error: string; previous_output: string };

export interface MakerModelAdapter {
  readonly requestedModel: string;
  generate(
    input: MakerInput,
    implementation: MakerImplementationEvidence,
    revision?: MakerRevisionFeedback,
  ): Promise<MakerModelResult>;
}

export class OpenRouterMakerModel implements MakerModelAdapter {
  readonly requestedModel: string;
  private readonly client: OpenRouter;

  constructor(configuration: { apiKey: string; model: string }) {
    this.requestedModel = configuration.model;
    this.client = new OpenRouter({ apiKey: configuration.apiKey });
  }

  async generate(
    input: MakerInput,
    implementation: MakerImplementationEvidence,
    revision?: MakerRevisionFeedback,
  ): Promise<MakerModelResult> {
    const response = await this.client.chat.send({
      appTitle: "RetentionLab Maker",
      appCategories: "education,agent,coding",
      chatRequest: {
        model: this.requestedModel,
        messages: [
          { role: "system", content: MAKER_SYSTEM_PROMPT },
          { role: "user", content: buildMakerTask(input, implementation, revision) },
        ],
        stream: false,
        maxCompletionTokens: 6_000,
        temperature: 0.1,
        reasoningEffort: "none",
        sessionId: input.run_id,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "retentionlab_maker_draft",
            description: "Maker description and Communicator handoff for a verified Recovery Room build.",
            schema: z.toJSONSchema(makerDraftSchema),
            strict: true,
          },
        },
        metadata: {
          project: "retentionlab",
          agent: "maker",
          run_id: input.run_id,
          prompt_version: "maker.v1.1.0",
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
      throw new Error("OpenRouter unexpectedly returned a stream for a non-streaming Maker request.");
    }
    const content = response.choices[0]?.message.content;
    if (response.choices[0]?.finishReason === "length") {
      throw new Error("OpenRouter truncated the Maker draft at the model output limit.");
    }
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("OpenRouter returned no textual Maker draft.");
    }
    return { text: content, resolvedModel: response.model };
  }
}

export type { MakerDraft };
