import type { Locale, RedactedMessage, UnderstandingResult } from "@/core";
import { normalizeUnderstanding } from "./normalize-understanding";
import type { StructuredOutputParser } from "./structured-output";
import { understandingInstructions } from "./understanding-prompt";
import { UnderstandingSchema } from "./understanding-schema";

export async function understandSupportMessage(
  parser: StructuredOutputParser,
  input: {
    text: string;
    locale: Locale;
    recentMessages: RedactedMessage[];
  }
): Promise<UnderstandingResult> {
  const parsed = await parser.parse(
    understandingInstructions,
    JSON.stringify({
      text: input.text,
      preferredResponseLocale: input.locale,
      recentMessages: input.recentMessages
    }),
    UnderstandingSchema,
    "support_understanding"
  );
  return normalizeUnderstanding(parsed, input.text);
}
