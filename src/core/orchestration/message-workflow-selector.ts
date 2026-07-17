import {
  askForOrderNumber,
  clearClarification,
  mergeReturnContext,
  offerPendingIntent,
  requestClarification,
  transition,
  transitionToIntent,
  type WorkflowResult
} from "../conversation/transitions";
import type {
  AuditEvent,
  ChatInput,
  ConversationState,
  EvidenceSource,
  RequestContext,
  UnderstandingResult
} from "../types";
import { event } from "../utils";
import type { OrderWorkflow } from "../workflows/order-workflow";
import type { ProductWorkflow } from "../workflows/product-workflow";
import type { ReturnWorkflow } from "../workflows/return-workflow";
import { PendingIntentCoordinator } from "./pending-intent-coordinator";
import {
  mergeProductClarification,
  needsProductReference,
  requestProductReference
} from "./product-routing";

type MessageInput = Extract<ChatInput, { inputType: "message" }>;
type Workflows = {
  order: OrderWorkflow;
  product: ProductWorkflow;
  returns: ReturnWorkflow;
};

export class MessageWorkflowSelector {
  constructor(
    private readonly workflows: Workflows,
    private readonly pendingIntents: PendingIntentCoordinator
  ) {}

  async select(
    context: RequestContext,
    state: ConversationState,
    input: MessageInput,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    if (state.activeIntent === "return_request") {
      captureReturnContext(state, understanding);
    }

    switch (state.phase) {
      case "awaiting_intent_clarification":
        return understanding.entities.workflowSelection
          ? this.pendingIntents.select(
              context,
              state,
              understanding.entities.workflowSelection,
              events,
              sources
            )
          : this.pendingIntents.askForSelection(state);
      case "awaiting_product_clarification":
        return this.resumeProductClarification(
          context,
          state,
          input,
          understanding,
          events,
          sources
        );
      case "awaiting_verification":
        return verificationPrompt(state);
      case "awaiting_return_item":
        return this.workflows.returns.selectItem(
          context,
          state,
          input,
          understanding,
          events,
          sources
        );
      case "awaiting_return_condition":
        return this.workflows.returns.setCondition(
          context,
          state,
          input,
          understanding,
          events,
          sources
        );
      case "awaiting_return_reason":
        return this.workflows.returns.setReason(
          context,
          state,
          input,
          understanding,
          events,
          sources
        );
      case "awaiting_return_confirmation":
        return this.routePendingReturn(context, state, input, understanding, events, sources);
      case "return_draft_created":
        if (understanding.entities.confirmationDecision === "confirm") {
          return this.workflows.returns.duplicateConfirmation(state, events);
        }
        break;
    }

    const pending = state.pendingIntents?.[0];
    if (pending && understanding.intent === pending.intent) {
      return this.pendingIntents.resume(context, state, pending.intent, events, sources);
    }
    return this.start(context, state, input.message, understanding, events, sources);
  }

  private async resumeProductClarification(
    context: RequestContext,
    state: ConversationState,
    input: MessageInput,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const merged = mergeProductClarification(state.pendingUnderstanding, understanding);
    if (needsProductReference(state, merged)) {
      return requestProductReference(state, input.message, merged, events);
    }
    clearClarification(state);
    return this.start(context, state, input.message, merged, events, sources);
  }

  private async routePendingReturn(
    context: RequestContext,
    state: ConversationState,
    input: MessageInput,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    if (understanding.entities.confirmationDecision) {
      return this.workflows.returns.confirm(context, state, input, understanding, events);
    }
    if (
      understanding.intent !== "return_request" &&
      understanding.intent !== "needs_clarification"
    ) {
      events.push(
        event(
          "safety",
          "Pending return invalidated",
          `A new ${understanding.intent} workflow replaced the unconfirmed return action.`
        )
      );
      return this.start(context, state, input.message, understanding, events, sources);
    }
    return this.workflows.returns.confirm(context, state, input, understanding, events);
  }

  private async start(
    context: RequestContext,
    state: ConversationState,
    text: string,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const actionable = understanding.intents.filter(
      (intent): intent is "product_information" | "order_tracking" =>
        intent === "product_information" || intent === "order_tracking"
    );
    if (actionable.includes("product_information") && actionable.includes("order_tracking")) {
      transitionToIntent(state, "needs_clarification", events);
      requestClarification(
        state,
        "awaiting_intent_clarification",
        {
          type: "intent_order",
          originalText: text,
          options: ["product_information", "order_tracking"]
        },
        events,
        understanding
      );
      events.push(event("intent", "Compound request", "Model detected product and order intents."));
      return this.pendingIntents.askForSelection(state);
    }

    transitionToIntent(state, understanding.intent, events);
    captureReturnContext(state, understanding);
    if (needsProductReference(state, understanding)) {
      return requestProductReference(state, text, understanding, events);
    }
    if (state.pendingClarification?.type === "product_reference") {
      clearClarification(state);
    }

    if (
      understanding.intent === "product_information" ||
      understanding.intent === "return_policy_information"
    ) {
      const result = await this.workflows.product.handle(
        context,
        state,
        text,
        understanding,
        events,
        sources,
        understanding.intent
      );
      return state.phase === "resolved" ? offerPendingIntent(state, result) : result;
    }
    if (understanding.intent === "order_tracking" || understanding.intent === "return_request") {
      return understanding.entities.orderId
        ? this.workflows.order.startOrReuseAccess(
            context,
            state,
            understanding.entities.orderId,
            events
          )
        : askForOrderNumber(state, events);
    }

    transition(state, "idle", events);
    return generalClarification(state);
  }
}

function captureReturnContext(state: ConversationState, understanding: UnderstandingResult): void {
  if (understanding.intent !== "return_request") return;
  const condition = understanding.entities.returnCondition;
  const derivedFacts =
    condition === "unopened"
      ? { packageOpened: false, unused: true }
      : condition === "opened"
        ? { packageOpened: true }
        : condition === "damaged"
          ? { damaged: true }
          : {};
  mergeReturnContext(state, {
    ...(condition ? { condition } : {}),
    conditionFacts: {
      ...derivedFacts,
      ...(understanding.entities.returnConditionFacts ?? {})
    },
    ...(understanding.entities.returnReason ? { reason: understanding.entities.returnReason } : {})
  });
}

function verificationPrompt(state: ConversationState): WorkflowResult {
  return {
    kind: "action_required",
    message:
      state.preferredResponseLocale === "ar"
        ? "أدخل رمز التحقق في الحقل الآمن، أو اطلب موظفاً إذا احتجت مساعدة."
        : "Enter the verification code in the secure field, or ask for a human if you need help.",
    demoOtpAvailable: true
  };
}

function generalClarification(state: ConversationState): WorkflowResult {
  return {
    kind: "clarification_required",
    message:
      state.preferredResponseLocale === "ar"
        ? "أقدر أساعدك بمعلومات المنتجات، تتبع الطلب، أو بدء طلب إرجاع. وش تحتاج؟"
        : "I can help with product information, order tracking, or starting a return. What do you need?",
    suggestedReplies:
      state.preferredResponseLocale === "ar"
        ? ["وين طلبي؟", "أبغى أرجع منتج", "هل المقاس متوفر؟"]
        : ["Track my order", "Start a return", "Check product availability"]
  };
}
