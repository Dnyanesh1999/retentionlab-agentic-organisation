import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import {
  researchBriefSchema,
  type ResearcherInput,
} from "./contracts.js";
import type { ResearcherEvidenceAccess } from "./evidenceSession.js";
import { buildResearcherTask, RESEARCHER_SYSTEM_PROMPT } from "./prompt.js";

export type ResearcherModelResult = {
  text: string;
  resolvedModel: string;
};
export type ResearcherRevisionFeedback = { validation_error: string; previous_output: string };

export interface ResearcherModelAdapter {
  readonly requestedModel: string;
  generate(input: ResearcherInput, evidence: ResearcherEvidenceAccess, revision?: ResearcherRevisionFeedback): Promise<ResearcherModelResult>;
}

export class OpenRouterResearcherModel implements ResearcherModelAdapter {
  readonly requestedModel: string;
  private readonly client: OpenRouter;

  constructor(configuration: { apiKey: string; model: string }) {
    this.requestedModel = configuration.model;
    this.client = new OpenRouter({ apiKey: configuration.apiKey });
  }

  async generate(input: ResearcherInput, evidence: ResearcherEvidenceAccess, revision?: ResearcherRevisionFeedback): Promise<ResearcherModelResult> {
    const response = await this.client.chat.send({
      appTitle: "RetentionLab Researcher",
      appCategories: "education,agent",
      chatRequest: {
        model: this.requestedModel,
        messages: [
          { role: "system", content: RESEARCHER_SYSTEM_PROMPT },
          { role: "user", content: buildResearcherTask(input, evidence.calls.map((call) => call.envelope), revision) },
        ],
        stream: false,
        maxCompletionTokens: 6_000,
        temperature: 0.1,
        reasoningEffort: "none",
        sessionId: input.run_id,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "retentionlab_research_brief",
            description: "Evidence-cited Researcher handoff for the RetentionLab Designer.",
            schema: z.toJSONSchema(researchBriefSchema),
            strict: true,
          },
        },
        metadata: {
          project: "retentionlab",
          agent: "researcher",
          run_id: input.run_id,
          prompt_version: "researcher.v1.1.0",
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
      throw new Error("OpenRouter unexpectedly returned a stream for a non-streaming Researcher request.");
    }
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("OpenRouter returned no textual ResearchBrief.");
    }
    return { text: content, resolvedModel: response.model };
  }
}
