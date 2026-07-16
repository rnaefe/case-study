import type {
  AuditEvent,
  ChatInput,
  ConversationPhase,
  ConversationState,
  Intent,
  PendingClarification,
  PendingIntent,
  PendingAction,
  Product,
  RedactedMessage,
  ResponseLocale,
  ReturnConditionFacts,
  UnderstandingResult,
  VerifiedOrderAccess
} from "../types";
import type { ApplicationResult } from "../application-result";
import { event } from "../utils";

export type WorkflowResult = ApplicationResult;

export function initializeConversation(state: ConversationState, locale: ResponseLocale): void {
  state.preferredResponseLocale ??= locale;
  state.verificationFailureCount ??= 0;
  state.selfServiceFailureCount ??= 0;
}

export function selectResponseLocale(
  state: ConversationState,
  locale: ResponseLocale,
  explicit = false
): void {
  state.preferredResponseLocale = locale;
  if (explicit) state.explicitResponseLocale = locale;
}

export function responseLocaleFor(state: ConversationState): ResponseLocale {
  return state.preferredResponseLocale ?? "en";
}

export function appendTranscriptMessage(state: ConversationState, message: RedactedMessage): void {
  state.messages.push(message);
}

export function recordAuditHistory(state: ConversationState, events: AuditEvent[]): void {
  state.auditHistory = [
    ...(state.auditHistory ?? []),
    ...events.filter((entry) => entry.type !== "usage")
  ].slice(-100);
}

export function transition(
  state: ConversationState,
  next: ConversationPhase,
  events: AuditEvent[]
) {
  const previous = state.phase;
  state.phase = next;
  events.push(event("state_transition", "State transition", `${previous} → ${next}`));
}

export function resetVerificationState(state: ConversationState) {
  delete state.authenticatedAccess;
  delete state.orderId;
  delete state.selectedItemIds;
  delete state.pendingAction;
}

export function beginOrderVerification(
  state: ConversationState,
  orderId: string,
  events: AuditEvent[]
): void {
  resetVerificationState(state);
  state.verificationFailureCount = 0;
  state.orderId = orderId;
  transition(state, "awaiting_verification", events);
}

export function recordVerificationFailure(state: ConversationState): number {
  state.verificationFailureCount += 1;
  return state.verificationFailureCount;
}

export function recordSelfServiceFailure(state: ConversationState): number {
  state.selfServiceFailureCount += 1;
  return state.selfServiceFailureCount;
}

function resetSelfServiceFailures(state: ConversationState): void {
  state.selfServiceFailureCount = 0;
}

export function grantOrderAccess(
  state: ConversationState,
  access: VerifiedOrderAccess,
  events: AuditEvent[]
): void {
  state.verificationFailureCount = 0;
  state.authenticatedAccess = access;
  transition(state, "order_authenticated", events);
}

export function requestClarification(
  state: ConversationState,
  phase: Extract<
    ConversationPhase,
    "awaiting_intent_clarification" | "awaiting_product_clarification" | "awaiting_order_number"
  >,
  clarification: PendingClarification,
  events: AuditEvent[],
  understanding?: UnderstandingResult
): void {
  state.pendingClarification = clarification;
  if (understanding) state.pendingUnderstanding = understanding;
  transition(state, phase, events);
}

export function clearClarification(state: ConversationState): void {
  delete state.pendingClarification;
  delete state.pendingUnderstanding;
}

export function replacePendingIntents(state: ConversationState, intents: PendingIntent[]): void {
  if (intents.length) state.pendingIntents = intents;
  else delete state.pendingIntents;
}

export function activatePendingIntent(state: ConversationState, intent: Intent): void {
  state.activeIntent = intent;
}

export function markHandoffIntent(state: ConversationState): void {
  state.activeIntent = "human_handoff";
}

export function rememberProduct(
  state: ConversationState,
  product: Product,
  query: string,
  requestedVariant?: string
): void {
  state.productContext = {
    productId: product.id,
    query,
    ...(requestedVariant ? { requestedVariant } : {})
  };
}

export function mergeReturnContext(
  state: ConversationState,
  input: {
    condition?: "unopened" | "opened" | "damaged" | "unknown";
    conditionFacts?: ReturnConditionFacts;
    reason?: string;
  }
): void {
  state.returnContext = {
    ...(state.returnContext ?? {}),
    ...(input.condition ? { condition: input.condition } : {}),
    conditionFacts: {
      ...(state.returnContext?.conditionFacts ?? {}),
      ...(input.conditionFacts ?? {})
    },
    ...(input.reason ? { reason: input.reason } : {})
  };
}

export function selectReturnItem(state: ConversationState, itemId: string): void {
  state.selectedItemIds = [itemId];
}

export function requestReturnConfirmation(
  state: ConversationState,
  action: PendingAction,
  events: AuditEvent[]
): void {
  state.pendingAction = action;
  transition(state, "awaiting_return_confirmation", events);
}

export function recordReturnDraft(
  state: ConversationState,
  draftId: string,
  events: AuditEvent[]
): void {
  resetSelfServiceFailures(state);
  transition(state, "return_draft_created", events);
  state.lastResolvedIntent = "return_request";
  state.returnDraftId = draftId;
}

export function cancelReturn(state: ConversationState, events: AuditEvent[]): void {
  state.lastResolvedIntent = "return_request";
  transitionToIdle(state, events);
}

export function resolveIntent(
  state: ConversationState,
  intent: Intent,
  events: AuditEvent[]
): void {
  resetSelfServiceFailures(state);
  state.lastResolvedIntent = intent;
  transition(state, "resolved", events);
}

export function transitionToIntent(state: ConversationState, intent: Intent, events: AuditEvent[]) {
  if (state.activeIntent && state.activeIntent !== intent) {
    resetSelfServiceFailures(state);
    resetVerificationState(state);
    delete state.returnContext;
    delete state.pendingClarification;
    delete state.pendingUnderstanding;
    delete state.pendingIntents;
    events.push(
      event(
        "state_transition",
        "Workflow context reset",
        `${state.activeIntent} → ${intent}; stale transactional state cleared.`
      )
    );
  }
  state.activeIntent = intent;
}

function transitionToIdle(state: ConversationState, events: AuditEvent[]) {
  resetSelfServiceFailures(state);
  resetVerificationState(state);
  delete state.returnContext;
  delete state.pendingClarification;
  delete state.pendingUnderstanding;
  delete state.pendingIntents;
  delete state.activeIntent;
  transition(state, "idle", events);
}

export function transitionToEscalated(state: ConversationState, events: AuditEvent[]) {
  resetVerificationState(state);
  delete state.returnContext;
  delete state.pendingClarification;
  delete state.pendingUnderstanding;
  delete state.pendingIntents;
  transition(state, "escalated", events);
}

export function askForOrderNumber(state: ConversationState, events: AuditEvent[]): WorkflowResult {
  transition(state, "awaiting_order_number", events);
  return {
    kind: "clarification_required",
    message:
      state.preferredResponseLocale === "ar"
        ? "أكيد. أرسل رقم الطلب بصيغة ORD-1001، وبعدها نتحقق بشكل آمن."
        : "Sure — send your order number (for example, ORD-1001), then we’ll verify it securely.",
    suggestedReplies: ["ORD-1001"]
  };
}

export function offerPendingIntent(
  state: ConversationState,
  result: WorkflowResult
): WorkflowResult {
  const pending = state.pendingIntents?.[0];
  if (!pending) return result;
  const ar = state.preferredResponseLocale === "ar";
  const continuation =
    pending.intent === "order_tracking"
      ? ar
        ? "نكمل تتبع الطلب؟"
        : "Would you like to continue with order tracking?"
      : ar
        ? "نكمل سؤال توفر المنتج؟"
        : "Would you like to continue with product availability?";
  const label =
    pending.intent === "order_tracking"
      ? ar
        ? "كمل التتبع"
        : "Continue tracking"
      : ar
        ? "كمل المنتج"
        : "Continue product question";
  return {
    ...result,
    kind: "action_required",
    message: `${result.message}\n\n${continuation}`,
    suggestedReplies: [...(result.suggestedReplies ?? []), label],
    suggestedActions: [
      ...(result.suggestedActions ?? []),
      { label, action: { inputType: "continue_intent", intent: pending.intent } }
    ]
  };
}

export function transcriptContent(input: ChatInput): string {
  switch (input.inputType) {
    case "message":
      return input.message;
    case "submit_otp":
      return "[OTP submitted securely]";
    default:
      return `[Structured action: ${input.inputType}]`;
  }
}
