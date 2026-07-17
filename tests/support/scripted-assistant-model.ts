import {
  AssistantProviderError,
  type AssistantModel,
  type EscalationSignals,
  type Intent,
  type Locale,
  type Readiness,
  type RedactedMessage,
  type ResponseLocale,
  type UnderstandingEntities,
  type UnderstandingResult
} from "@/core";

const noEscalation: EscalationSignals = {
  explicitHumanRequest: false,
  authorizationBypassAttempt: false,
  refundRequest: false,
  cancellationRequest: false,
  addressChangeRequest: false,
  paymentDispute: false,
  complaintOrAnger: false,
  criticalSafety: false,
  unsafeActionRequest: false
};

export function understanding({
  intent,
  intents = [intent],
  detectedLocale = "en",
  responseLocale = detectedLocale === "en" ? "en" : "ar",
  readiness = "ready",
  entities = {},
  escalation = {},
  conversation = {}
}: {
  intent: Intent;
  intents?: Intent[];
  detectedLocale?: Locale;
  responseLocale?: ResponseLocale;
  readiness?: Readiness;
  entities?: UnderstandingEntities;
  escalation?: Partial<EscalationSignals>;
  conversation?: Partial<UnderstandingResult["conversation"]>;
}): UnderstandingResult {
  return {
    intent,
    intents,
    detectedLocale,
    responseLocale,
    readiness,
    entities,
    escalation: { ...noEscalation, ...escalation },
    conversation: {
      isFollowUp: false,
      refersToPreviousProduct: false,
      ...conversation
    }
  };
}

export class ScriptedAssistantModel implements AssistantModel {
  private index = 0;

  constructor(private readonly script: Array<UnderstandingResult | Error>) {}

  async understand(): Promise<UnderstandingResult> {
    const result = this.script[this.index++];
    if (!result) throw new Error("Unexpected model-understanding call");
    if (result instanceof Error) {
      throw new AssistantProviderError("understand", { cause: result });
    }
    return result;
  }

  async composeResponse(input: { groundedDraft: string }): Promise<string> {
    return input.groundedDraft;
  }

  async summarizeHandoff(input: {
    reason: string;
    transcript: RedactedMessage[];
  }): Promise<string> {
    return `Support handoff: ${input.reason.replaceAll("_", " ")}.`;
  }
}
