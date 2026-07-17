import { loadEnvConfig } from "@next/env";
import type {
  EscalationSignals,
  Intent,
  Locale,
  Readiness,
  ResponseLocale,
  UnderstandingEntities,
  UnderstandingResult
} from "@/core";
import type { OpenAIUsageSample } from "@/server/openai-assistant-model";

type ModelTag =
  | "correctness"
  | "security"
  | "authorization"
  | "tenant"
  | "retrieval"
  | "Arabic"
  | "Arabizi"
  | "multilingual"
  | "stateful"
  | "adversarial"
  | "holdout"
  | "regression";

export type ModelCase = {
  id: string;
  tags: ModelTag[];
  text: string;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  expected: {
    intent: Intent;
    intents?: Intent[];
    detectedLocale: Locale;
    responseLocale: ResponseLocale;
    readiness: Readiness;
    entities?: Partial<UnderstandingEntities>;
    escalation?: Partial<EscalationSignals>;
    conversation?: Partial<UnderstandingResult["conversation"]>;
  };
  compose?: {
    intent: Intent;
    locale: ResponseLocale;
    groundedDraft: string;
    evidence: string[];
    includes: string[];
    excludes?: string[];
  };
};

export function loadModelEnvironment(): void {
  loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for npm run eval:model");
  }
}

export function selectedTag(): string | undefined {
  const inline = process.argv.find((value) => value.startsWith("--tag="));
  if (inline) return inline.slice("--tag=".length);
  const index = process.argv.indexOf("--tag");
  if (index >= 0) return process.argv[index + 1];
  return process.env.npm_config_tag;
}

export function estimatedCost(usage: OpenAIUsageSample): number {
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_MILLION ?? "0.15");
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_MILLION ?? "0.60");
  return (usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000;
}
