import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type OpenAIClient = Pick<OpenAI, "responses">;

export type OpenAIUsageSample = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export interface StructuredOutputParser {
  parse<T extends z.ZodTypeAny>(
    instructions: string,
    userInput: string,
    schema: T,
    schemaName: string
  ): Promise<z.infer<T>>;
}

export class OpenAIConfigurationError extends Error {
  constructor() {
    super("OPENAI_API_KEY is required");
    this.name = "OpenAIConfigurationError";
  }
}

export class OpenAIStructuredOutput implements StructuredOutputParser {
  private readonly client: OpenAIClient;

  constructor(
    private readonly model: string,
    options: {
      client?: OpenAIClient;
      apiKey?: string;
      onUsage?: (usage: OpenAIUsageSample) => void;
    }
  ) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!options.client && !apiKey) {
      throw new OpenAIConfigurationError();
    }
    this.client = options.client ?? new OpenAI({ apiKey });
    this.onUsage = options.onUsage;
  }

  private readonly onUsage: ((usage: OpenAIUsageSample) => void) | undefined;

  async parse<T extends z.ZodTypeAny>(
    instructions: string,
    userInput: string,
    schema: T,
    schemaName: string
  ): Promise<z.infer<T>> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      temperature: 0,
      instructions,
      input: userInput,
      text: {
        format: zodTextFormat(schema, schemaName)
      }
    });

    if (!response.output_parsed) {
      throw new Error(`OpenAI returned no parsed output for ${schemaName}`);
    }
    if (response.usage) {
      this.onUsage?.({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens
      });
    }

    return response.output_parsed;
  }
}
