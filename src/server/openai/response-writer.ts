import type { HandoffReason, Intent, Locale, RedactedMessage } from "@/core";
import { z } from "zod";
import type { StructuredOutputParser } from "./structured-output";

const ComposedResponseSchema = z.object({
  message: z.string().min(1).max(2000)
});

const HandoffSummarySchema = z.object({
  summary: z.string().min(1).max(800)
});

export async function composeGroundedResponse(
  parser: StructuredOutputParser,
  input: {
    locale: Locale;
    intent: Intent;
    userText: string;
    evidence: string[];
    groundedDraft: string;
  }
): Promise<string> {
  const result = await parser.parse(
    [
      "Rewrite the grounded ecommerce-support draft into a concise, natural customer response.",
      "Use the user's dominant style: English, Saudi/Gulf Arabic, or Arabizi/code-switching.",
      "Do not add facts, promises, policy decisions, tools, or actions.",
      "Preserve all order IDs, dates, prices, stock states, reference numbers, and safety caveats exactly.",
      "Use only the supplied evidence and grounded draft."
    ].join(" "),
    JSON.stringify(input),
    ComposedResponseSchema,
    "localized_support_response"
  );
  return preservesGroundedFacts(input.groundedDraft, result.message)
    ? result.message
    : input.groundedDraft;
}

export async function summarizeHandoff(
  parser: StructuredOutputParser,
  input: {
    locale: Locale;
    reason: HandoffReason;
    transcript: RedactedMessage[];
    attemptedResolutions: string[];
  }
): Promise<string> {
  const result = await parser.parse(
    [
      "Summarize this already-redacted ecommerce support conversation for a human agent.",
      "Be factual and concise. Include the customer's goal, handoff reason, and attempted resolutions.",
      "Do not reconstruct masked data or invent actions."
    ].join(" "),
    JSON.stringify(input),
    HandoffSummarySchema,
    "handoff_summary"
  );
  return result.summary;
}

function preservesGroundedFacts(groundedDraft: string, composed: string): boolean {
  return protectedFacts(groundedDraft).every((fact) => composed.includes(fact));
}

function protectedFacts(text: string): string[] {
  return [
    ...new Set(
      text.match(/\b(?:ORD|RMA)-\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:[.,]\d+)?\b/gi) ?? []
    )
  ];
}
