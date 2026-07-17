import {
  AssistantProviderError,
  type AssistantModel,
  type HandoffReason,
  type Intent,
  type Locale,
  type RedactedMessage,
  type UnderstandingResult
} from "@/core";
import { getOpenAIModel } from "./openai-config";
import { composeGroundedResponse, summarizeHandoff } from "./openai/response-writer";
import {
  OpenAIStructuredOutput,
  type OpenAIClient,
  type OpenAIUsageSample
} from "./openai/structured-output";
import { understandSupportMessage } from "./openai/understanding";

export { OpenAIConfigurationError, type OpenAIUsageSample } from "./openai/structured-output";

export class OpenAIAssistantModel implements AssistantModel {
  private readonly structuredOutput: OpenAIStructuredOutput;

  constructor(
    options: {
      client?: OpenAIClient;
      model?: string;
      apiKey?: string;
      onUsage?: (usage: OpenAIUsageSample) => void;
    } = {}
  ) {
    this.structuredOutput = new OpenAIStructuredOutput(options.model ?? getOpenAIModel(), options);
  }

  async understand(input: {
    text: string;
    locale: Locale;
    recentMessages: RedactedMessage[];
  }): Promise<UnderstandingResult> {
    try {
      return await understandSupportMessage(this.structuredOutput, input);
    } catch (error) {
      throw new AssistantProviderError("understand", { cause: error });
    }
  }

  async composeResponse(input: {
    locale: Locale;
    intent: Intent;
    userText: string;
    evidence: string[];
    groundedDraft: string;
  }): Promise<string> {
    try {
      return await composeGroundedResponse(this.structuredOutput, input);
    } catch (error) {
      throw new AssistantProviderError("compose", { cause: error });
    }
  }

  async summarizeHandoff(input: {
    locale: Locale;
    reason: HandoffReason;
    transcript: RedactedMessage[];
    attemptedResolutions: string[];
  }): Promise<string> {
    try {
      return await summarizeHandoff(this.structuredOutput, input);
    } catch (error) {
      throw new AssistantProviderError("summarize", { cause: error });
    }
  }
}
