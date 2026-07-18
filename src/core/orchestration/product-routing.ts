import { requestClarification, type WorkflowResult } from "../conversation/transitions";
import type { AuditEvent, ConversationState, UnderstandingResult } from "../types";

export function mergeProductClarification(
  pending: UnderstandingResult | undefined,
  current: UnderstandingResult
): UnderstandingResult {
  const pendingQuestionType = pending?.entities.productQuestionType;
  return {
    ...(pending ?? current),
    ...current,
    intent: "product_information",
    intents: ["product_information"],
    readiness: current.entities.productReference ? "ready" : "needs_clarification",
    entities: {
      ...(pending?.entities ?? {}),
      ...current.entities,
      ...(pendingQuestionType && pendingQuestionType !== "discovery"
        ? { productQuestionType: pendingQuestionType }
        : {}),
      ...(current.entities.requestedVariant
        ? {}
        : pending?.entities.requestedVariant
          ? { requestedVariant: pending.entities.requestedVariant }
          : {})
    }
  };
}

export function needsProductReference(
  state: ConversationState,
  understanding: UnderstandingResult
): boolean {
  if (understanding.intent !== "product_information") return false;
  if (
    understanding.entities.productQuestionType === "discovery" ||
    understanding.entities.productQuestionType === "shipping" ||
    understanding.entities.productQuestionType === "cod"
  ) {
    return false;
  }
  return !(
    understanding.entities.productReference ||
    (understanding.conversation.refersToPreviousProduct && state.productContext?.productId)
  );
}

export function reuseProductContextForRestock(
  state: ConversationState,
  understanding: UnderstandingResult
): UnderstandingResult {
  if (
    understanding.intent !== "product_information" ||
    understanding.entities.productQuestionType !== "restock" ||
    understanding.entities.productReference ||
    understanding.conversation.refersToPreviousProduct ||
    !state.productContext?.productId
  ) {
    return understanding;
  }

  return {
    ...understanding,
    readiness:
      understanding.readiness === "needs_clarification" ? "ready" : understanding.readiness,
    conversation: {
      isFollowUp: true,
      refersToPreviousProduct: true
    }
  };
}

export function requestProductReference(
  state: ConversationState,
  originalText: string,
  understanding: UnderstandingResult,
  events: AuditEvent[]
): WorkflowResult {
  requestClarification(
    state,
    "awaiting_product_clarification",
    {
      type: "product_reference",
      originalText,
      options: []
    },
    events,
    understanding
  );
  return {
    kind: "clarification_required",
    message:
      state.preferredResponseLocale === "ar"
        ? "أكيد. أي منتج تقصد؟ اكتب اسم المنتج عشان أتحقق من المقاس والتوفر بدقة."
        : "Which product do you mean? Share its name so I can check the exact variant and stock.",
    suggestedReplies: []
  };
}

export function focusUnderstanding(
  understanding: UnderstandingResult,
  intent: "product_information" | "order_tracking"
): UnderstandingResult {
  return { ...understanding, intent, intents: [intent] };
}

export function createProductFollowUpUnderstanding(state: ConversationState): UnderstandingResult {
  return {
    intent: "product_information",
    intents: ["product_information"],
    detectedLocale: state.preferredResponseLocale ?? "en",
    responseLocale: state.preferredResponseLocale ?? "en",
    readiness: "ready",
    entities: {},
    escalation: {
      explicitHumanRequest: false,
      authorizationBypassAttempt: false,
      refundRequest: false,
      cancellationRequest: false,
      addressChangeRequest: false,
      paymentDispute: false,
      complaintOrAnger: false,
      criticalSafety: false,
      unsafeActionRequest: false
    },
    conversation: { isFollowUp: true, refersToPreviousProduct: true }
  };
}
