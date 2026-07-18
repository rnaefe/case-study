import type {
  EscalationSignals,
  HumanRequestTarget,
  Intent,
  Readiness,
  SafetyRequestCategory,
  UnderstandingEntities,
  UnderstandingResult
} from "@/core";
import type { ParsedUnderstanding } from "./understanding-schema";

export function normalizeUnderstanding(
  parsed: ParsedUnderstanding,
  text: string
): UnderstandingResult {
  const entities = cleanEntities(parsed, text);
  const signals = reinforceSignals(parsed, text);
  const readiness = resolveReadiness(parsed, entities, signals.hasEscalation);
  const intent = resolveIntent(parsed.intent, signals);
  const intents = resolveIntents(intent, parsed.intents, signals, text);

  return {
    intent,
    intents,
    responseLocale: parsed.responseLocale,
    readiness,
    conversation: parsed.conversation,
    ...(signals.humanRequestTarget ? { humanRequestTarget: signals.humanRequestTarget } : {}),
    ...(signals.safetyCategory !== "none" ? { safetyCategory: signals.safetyCategory } : {}),
    detectedLocale: localeFromWritingStyle(parsed.inputWritingStyle),
    entities,
    escalation: signals.escalation
  };
}

function cleanEntities(parsed: ParsedUnderstanding, text: string): UnderstandingEntities {
  const orderId = cleanModelOrderId(parsed.entities.orderId);
  const productReference = cleanModelString(parsed.entities.productReference);
  const requestedVariant = cleanModelString(parsed.entities.requestedVariant);
  const returnReason = cleanModelString(parsed.entities.returnReason);
  const returnConditionFacts = parsed.entities.returnConditionFacts
    ? Object.fromEntries(
        Object.entries(parsed.entities.returnConditionFacts).filter((entry) => entry[1] !== null)
      )
    : undefined;
  const productQuestionType = isWarrantyQuestion(text)
    ? ("warranty" as const)
    : (parsed.entities.productQuestionType ?? undefined);

  return {
    ...(orderId ? { orderId } : {}),
    ...(productReference ? { productReference } : {}),
    ...(requestedVariant ? { requestedVariant } : {}),
    ...(parsed.entities.returnCondition
      ? { returnCondition: parsed.entities.returnCondition }
      : {}),
    ...(returnConditionFacts && Object.keys(returnConditionFacts).length
      ? { returnConditionFacts }
      : {}),
    ...(returnReason ? { returnReason } : {}),
    ...(productQuestionType ? { productQuestionType } : {}),
    ...(parsed.entities.workflowSelection
      ? { workflowSelection: parsed.entities.workflowSelection }
      : {}),
    ...(parsed.entities.confirmationDecision
      ? { confirmationDecision: parsed.entities.confirmationDecision }
      : {}),
    ...(parsed.entities.selectedItemNumber
      ? { selectedItemNumber: parsed.entities.selectedItemNumber }
      : {})
  };
}

function reinforceSignals(parsed: ParsedUnderstanding, text: string): {
  escalation: EscalationSignals;
  hasEscalation: boolean;
  hasBusinessInterrupt: boolean;
  humanRequestTarget: HumanRequestTarget | undefined;
  safetyCategory: SafetyRequestCategory;
} {
  const inferredHumanTarget = inferHumanRequestTarget(text);
  const humanRequestTarget = parsed.humanRequestTarget ?? inferredHumanTarget;
  const explicitHumanRequest = coerceExplicitHumanRequest({
    text,
    humanRequestTarget,
    modelExplicitHumanRequest: parsed.escalation.explicitHumanRequest,
    modelHumanRequestTarget: parsed.humanRequestTarget
  });
  const detectedSafetyCategory = detectSafetyCategory(text);
  const safetyCategory =
    parsed.safetyCategory === "none" ? detectedSafetyCategory : parsed.safetyCategory;
  const authorizationBypassAttempt =
    parsed.escalation.authorizationBypassAttempt ||
    safetyCategory === "authorization_bypass" ||
    isAuthorizationBypass(text);
  const protectedBoundaryRequest = isProtectedBoundaryRequest(text);
  const escalation: EscalationSignals = {
    ...parsed.escalation,
    explicitHumanRequest,
    authorizationBypassAttempt,
    paymentDispute: parsed.escalation.paymentDispute || isPaymentDispute(text),
    unsafeActionRequest:
      parsed.escalation.unsafeActionRequest ||
      authorizationBypassAttempt ||
      protectedBoundaryRequest ||
      safetyCategory !== "none"
  };
  const hasBusinessInterrupt =
    escalation.refundRequest ||
    escalation.cancellationRequest ||
    escalation.addressChangeRequest ||
    escalation.paymentDispute ||
    escalation.complaintOrAnger ||
    escalation.criticalSafety;

  return {
    escalation,
    hasEscalation: Object.values(escalation).some(Boolean),
    hasBusinessInterrupt,
    humanRequestTarget,
    safetyCategory
  };
}

function resolveReadiness(
  parsed: ParsedUnderstanding,
  entities: UnderstandingEntities,
  hasEscalation: boolean
): Readiness {
  if (hasEscalation) return "must_escalate";
  if (parsed.readiness !== "needs_clarification") return parsed.readiness;
  return hasReadyWorkflowContext(parsed, entities) ? "ready" : parsed.readiness;
}

function hasReadyWorkflowContext(
  parsed: ParsedUnderstanding,
  entities: UnderstandingEntities
): boolean {
  if (
    parsed.intent === "order_tracking" ||
    parsed.intent === "return_request" ||
    parsed.intent === "return_policy_information"
  ) {
    return true;
  }
  if (parsed.intent !== "product_information") return false;

  const questionType = entities.productQuestionType;
  return (
    questionType === "discovery" ||
    questionType === "shipping" ||
    questionType === "cod" ||
    questionType === "warranty" ||
    (questionType !== undefined && Boolean(entities.productReference)) ||
    parsed.conversation.refersToPreviousProduct
  );
}

function resolveIntent(
  modelIntent: Intent,
  signals: {
    escalation: EscalationSignals;
    hasBusinessInterrupt: boolean;
  }
): Intent {
  if (signals.escalation.authorizationBypassAttempt) return "unsupported";
  if (signals.escalation.explicitHumanRequest || signals.hasBusinessInterrupt) {
    return "human_handoff";
  }
  if (signals.escalation.unsafeActionRequest || modelIntent === "human_handoff") {
    return "unsupported";
  }
  return modelIntent;
}

function resolveIntents(
  intent: Intent,
  modelIntents: Intent[],
  signals: { hasBusinessInterrupt: boolean },
  text: string
): Intent[] {
  const reinforcedIntents: Intent[] =
    signals.hasBusinessInterrupt && isPublicPolicyQuestion(text)
      ? ["return_policy_information"]
      : [];

  return [
    ...new Set([
      intent,
      ...reinforcedIntents,
      ...modelIntents.filter((candidate) => candidate !== intent && candidate !== "human_handoff")
    ])
  ].slice(0, 3);
}

function localeFromWritingStyle(
  style: ParsedUnderstanding["inputWritingStyle"]
): UnderstandingResult["detectedLocale"] {
  if (style === "arabic_script") return "ar";
  if (style === "arabizi") return "arabizi";
  return "en";
}

const emptyModelValues = new Set(["", "null", "undefined", "n/a", "none", "/"]);

function cleanModelString(value: string | null): string | undefined {
  if (value === null) return undefined;
  const cleaned = value.trim();
  return emptyModelValues.has(cleaned.toLocaleLowerCase()) ? undefined : cleaned;
}

function cleanModelOrderId(value: string | null): string | undefined {
  return cleanModelString(value)
    ?.toUpperCase()
    .match(/\bORD-\d{4}\b/)?.[0];
}

function isAuthorizationBypass(text: string): boolean {
  return (
    /\b(?:pretend|assume|bypass|skip)\b[^.?!]{0,80}\b(?:otp|verification code|verification)\b/i.test(
      text
    ) || isCrossConversationVerificationClaim(text)
  );
}

function isProtectedBoundaryRequest(text: string): boolean {
  return (
    isAuthorizationBypass(text) ||
    /\b(?:another|other)\s+(?:tenant|customer)|\b(?:change|switch)\s+(?:the\s+)?tenant\b/i.test(
      text
    ) ||
    /\buse\b[^.?!]{0,60}\btenant(?:'s)?\b[^.?!]{0,60}\border\b/i.test(text) ||
    /\b(?:show|reveal|output|expose)\b[^.?!]{0,80}\b(?:private|customer|order)\b[^.?!]{0,40}\b(?:address|data|record|details?)\b/i.test(
      text
    ) ||
    /\b(?:repeat|reveal|recover)\b[^.?!]{0,50}\b(?:otp|verification code)\b/i.test(text)
  );
}

function inferHumanRequestTarget(text: string): HumanRequestTarget | undefined {
  if (/\b(?:supervisor|مشرف|mushrif)\b/iu.test(text)) return "supervisor";
  if (/\b(?:manager|management|مدير|mudeer|modir)\b/iu.test(text)) return "manager";
  if (/\b(?:representative|operator|موظف|mowazaf|muwazaf)\b/iu.test(text)) {
    return "representative";
  }
  if (/\b(?:agent|support staff)\b/iu.test(text)) return "agent";
  if (/\b(?:human|real person|person|someone real|إنسان|شخص|shakhs|insan)\b/iu.test(text)) {
    return "person";
  }
  return undefined;
}

function detectSafetyCategory(text: string): SafetyRequestCategory {
  if (isAuthorizationBypass(text)) return "authorization_bypass";
  if (
    /\b(?:another|other)\s+(?:tenant|customer)|\b(?:change|switch|use)\b[^.?!]{0,60}\btenant\b/iu.test(
      text
    )
  ) {
    return "cross_tenant";
  }
  if (/\b(?:system prompt|hidden (?:business )?rules?|tool definitions?)\b/iu.test(text)) {
    return "prompt_disclosure";
  }
  if (/\b(?:api key|secret key|access token|credential)\b/iu.test(text)) {
    return "credential_extraction";
  }
  if (
    /\b(?:raw|complete|internal)\b[^.?!]{0,50}\b(?:tool outputs?|tool payloads?)\b/iu.test(text)
  ) {
    return "raw_tool_output";
  }
  if (
    /\b(?:address|phone digits?|customer initials?|customer record|private data)\b/iu.test(text) &&
    /\bORD-\d{4}\b/iu.test(text)
  ) {
    return "private_data";
  }
  if (
    /\b(?:again|second|duplicate)\b/iu.test(text) &&
    /\b(?:return|rma|refund|cancel|create)\b/iu.test(text)
  ) {
    return "duplicate_action";
  }
  return "none";
}

function isCrossConversationVerificationClaim(text: string): boolean {
  return (
    /\b(?:another|previous|other)\s+(?:conversation|chat|tab)\b/iu.test(text) &&
    /\b(?:verified|verification|entered (?:the )?otp|confirmed)\b/iu.test(text)
  );
}

function isPaymentDispute(text: string): boolean {
  return /\b(?:charged twice|duplicate charge|double charg(?:e|ed)|unauthorized charge|incorrect charge|charge I (?:did not|didn't) make)\b|(?:خصم|عملية)\s+(?:مكرر|غير مصرح)/iu.test(
    text
  );
}

function isPublicPolicyQuestion(text: string): boolean {
  return /\b(?:refund|return)\s+polic(?:y|ies)\b|سياسة\s+(?:الاسترجاع|الإرجاع)/iu.test(text);
}

function isWarrantyQuestion(text: string): boolean {
  return /\b(?:warranty|guarantee)\b|ضمان/iu.test(text);
}

function coerceExplicitHumanRequest(input: {
  text: string;
  humanRequestTarget: HumanRequestTarget | undefined;
  modelExplicitHumanRequest: boolean;
  modelHumanRequestTarget: HumanRequestTarget | null;
}): boolean {
  if (!input.humanRequestTarget) return false;
  // Imperative data/action demands are not human-contact requests even if the
  // model fills humanRequestTarget from verbs like "show/give/create".
  if (isImperativeDataOrActionDemand(input.text) && !hasHumanContactIntent(input.text)) {
    return false;
  }
  return (
    input.modelExplicitHumanRequest ||
    input.modelHumanRequestTarget !== null ||
    hasHumanContactIntent(input.text)
  );
}

function isImperativeDataOrActionDemand(text: string): boolean {
  return /\b(?:show|print|give|reveal|expose|dump|create|output)\b/iu.test(text);
}

function hasHumanContactIntent(text: string): boolean {
  return (
    /\b(?:speak|talk|connect|transfer|escalate|hand\s*off|want|need|get me|ask for)\b/iu.test(
      text
    ) || /(?:أبي|ابغى|أريد|أكلم|حولني|حوّلني|abi|abgha)/iu.test(text)
  );
}
