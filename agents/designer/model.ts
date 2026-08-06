import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import {
  recoveryDesignSpecificationSchema,
  type DesignerInput,
} from "./contracts.js";
import { buildDesignerTask, DESIGNER_SYSTEM_PROMPT } from "./prompt.js";

export type DesignerModelResult = { text: string; resolvedModel: string };
export type DesignerRevisionFeedback = { validation_error: string; previous_output: string };
export type DesignerMakerCapabilities = { reusable_components: readonly string[] };

export interface DesignerModelAdapter {
  readonly requestedModel: string;
  generate(input: DesignerInput, revision?: DesignerRevisionFeedback, makerCapabilities?: DesignerMakerCapabilities): Promise<DesignerModelResult>;
}

export class OpenRouterDesignerModel implements DesignerModelAdapter {
  readonly requestedModel: string;
  private readonly client: OpenRouter;

  constructor(configuration: { apiKey: string; model: string }) {
    this.requestedModel = configuration.model;
    this.client = new OpenRouter({ apiKey: configuration.apiKey });
  }

  async generate(input: DesignerInput, revision?: DesignerRevisionFeedback, makerCapabilities?: DesignerMakerCapabilities): Promise<DesignerModelResult> {
    const response = await this.client.chat.send({
      appTitle: "RetentionLab Designer",
      appCategories: "education,agent,design",
      chatRequest: {
        model: this.requestedModel,
        messages: [
          { role: "system", content: DESIGNER_SYSTEM_PROMPT },
          { role: "user", content: buildDesignerTask(input, revision, makerCapabilities) },
        ],
        stream: false,
        maxCompletionTokens: 8_000,
        temperature: 0.1,
        reasoningEffort: "none",
        sessionId: input.run_id,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "retentionlab_recovery_design_specification",
            description: "Typed Designer handoff from a validated ResearchBrief to the Maker.",
            schema: z.toJSONSchema(recoveryDesignSpecificationSchema),
            strict: true,
          },
        },
        metadata: {
          project: "retentionlab",
          agent: "designer",
          run_id: input.run_id,
          prompt_version: "designer.v1.8.0",
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
      throw new Error("OpenRouter unexpectedly returned a stream for a non-streaming Designer request.");
    }
    const content = response.choices[0]?.message.content;
    if (response.choices[0]?.finishReason === "length") {
      throw new Error("OpenRouter truncated the Recovery Design Specification at the model output limit.");
    }
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("OpenRouter returned no textual Recovery Design Specification.");
    }
    return { text: content, resolvedModel: response.model };
  }
}
