import {
  markHandoffIntent,
  responseLocaleFor,
  selectResponseLocale,
  transitionToIntent,
  type WorkflowResult
} from "../conversation/transitions";
import { AssistantProviderError } from "../errors";
import type {
  AuditEvent,
  ChatInput,
  ConversationState,
  EvidenceSource,
  HandoffReason,
  Intent,
  RequestContext
} from "../types";
import { event, redactPii } from "../utils";
import { HandoffWorkflow } from "../workflows/handoff-workflow";
import { OrderWorkflow } from "../workflows/order-workflow";
import { ProductWorkflow } from "../workflows/product-workflow";
import { ReturnWorkflow } from "../workflows/return-workflow";
import { extractOrderId, resolveGlobalInterrupt, resolveReadinessHandoff } from "./signals";
import type { SupportRuntime } from "./runtime";
import { MessageWorkflowSelector } from "./message-workflow-selector";
import { PendingIntentCoordinator } from "./pending-intent-coordinator";
import { ServerActionDispatcher } from "./server-action-dispatcher";

const BUSINESS_INTENTS: Intent[] = [
  "product_information",
  "return_policy_information",
  "order_tracking",
  "return_request"
];

export class ChatRouter {
  private readonly handoff: HandoffWorkflow;
  private readonly order: OrderWorkflow;
  private readonly product: ProductWorkflow;
  private readonly actions: ServerActionDispatcher;
  private readonly messages: MessageWorkflowSelector;

  constructor(private readonly runtime: SupportRuntime) {
    this.handoff = new HandoffWorkflow(runtime);
    this.order = new OrderWorkflow(runtime, this.handoff);
    this.product = new ProductWorkflow(runtime, this.handoff);
    const workflows = {
      order: this.order,
      product: this.product,
      returns: new ReturnWorkflow(runtime, this.handoff)
    };
    const pendingIntents = new PendingIntentCoordinator(workflows);
    this.actions = new ServerActionDispatcher(workflows, pendingIntents);
    this.messages = new MessageWorkflowSelector(workflows, pendingIntents);
  }

  async route(
    context: RequestContext,
    state: ConversationState,
    input: ChatInput,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    try {
      if (input.inputType === "submit_otp") {
        if (state.phase !== "awaiting_verification" || !state.orderId) {
          events.push(
            event(
              "safety",
              "Server input rejected",
              `submit_otp is not valid for conversation phase ${state.phase}.`
            )
          );
          return {
            kind: "unavailable",
            message:
              state.preferredResponseLocale === "ar"
                ? "لا يوجد تحقق نشط لهذا الرمز. ابدأ بطلب تتبع صالح."
                : "There is no active verification for that code. Start with a valid tracking request."
          };
        }
        return await this.order.verify(context, state, input.code, events);
      }
      if (input.inputType !== "message") {
        return await this.actions.dispatch(context, state, input, events, sources);
      }
      return await this.routeMessage(context, state, input, events, sources);
    } catch (error) {
      if (error instanceof AssistantProviderError) {
        return this.providerFailure(context, state, events);
      }
      throw error;
    }
  }

  private async routeMessage(
    context: RequestContext,
    state: ConversationState,
    input: Extract<ChatInput, { inputType: "message" }>,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const understanding = await this.runtime.model.understand({
      text: redactPii(input.message),
      locale: responseLocaleFor(state),
      recentMessages: state.messages.slice(-8)
    });
    const responseLocale = state.explicitResponseLocale ?? understanding.responseLocale;
    selectResponseLocale(state, responseLocale);
    events.push(
      event(
        "intent",
        "Intent recognized",
        `${understanding.intents.join("+")} · ${understanding.readiness} · response ${responseLocale}`
      )
    );

    const interrupt = resolveGlobalInterrupt(understanding.escalation);
    if (understanding.escalation.authorizationBypassAttempt) {
      transitionToIntent(state, "order_tracking", events);
      return this.order.rejectAuthorizationBypass(
        context,
        state,
        understanding.entities.orderId ?? extractOrderId(input.message),
        events
      );
    }
    if (
      interrupt &&
      isProhibitedBusinessAction(interrupt) &&
      understanding.intents.includes("return_policy_information")
    ) {
      transitionToIntent(state, "return_policy_information", events);
      const policy = await this.product.handle(
        context,
        state,
        input.message,
        {
          ...understanding,
          intent: "return_policy_information",
          intents: ["return_policy_information"],
          readiness: "ready"
        },
        events,
        sources,
        "return_policy_information"
      );
      markHandoffIntent(state);
      events.push(
        event(
          "safety",
          "Compound policy and action",
          `Public policy was answered before ${interrupt}; no transactional action was executed.`
        )
      );
      return this.handoff.create(context, state, interrupt, events, policy.message);
    }
    if (
      understanding.escalation.unsafeActionRequest &&
      !interruptUsefulForHumanAssistance(interrupt)
    ) {
      events.push(
        event(
          "safety",
          "Unsafe request refused",
          "Protected content or action was refused without creating a support ticket."
        )
      );
      return refuseUnsafeRequest(state, understanding.safetyCategory);
    }
    if (interrupt || understanding.intent === "human_handoff") {
      markHandoffIntent(state);
      events.push(
        event(
          "safety",
          "Global workflow interrupt",
          `${interrupt ?? "explicit_request"} interrupted ${state.phase}.`
        )
      );
      return this.handoff.create(context, state, interrupt ?? "explicit_request", events);
    }
    const readinessHandoff = resolveReadinessHandoff(understanding.readiness);
    if (readinessHandoff) {
      markHandoffIntent(state);
      events.push(
        event(
          "safety",
          "Readiness safety gate",
          `${understanding.readiness} routed to ${readinessHandoff}; no transactional action was executed.`
        )
      );
      return this.handoff.create(context, state, readinessHandoff, events);
    }
    if (understanding.intent === "conversation_acknowledgement") {
      return acknowledge(state);
    }
    if (
      BUSINESS_INTENTS.includes(understanding.intent) &&
      !this.runtime.tenant.enabledIntents.includes(understanding.intent)
    ) {
      markHandoffIntent(state);
      events.push(
        event(
          "policy",
          "Intent not enabled for tenant",
          `${understanding.intent} is not enabled for ${context.tenantId}; routed to a human.`
        )
      );
      return this.handoff.create(context, state, "unsupported_action", events);
    }
    return this.messages.select(context, state, input, understanding, events, sources);
  }

  private async providerFailure(
    context: RequestContext,
    state: ConversationState,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    events.push(event("safety", "Provider failure", "No transactional action was executed."));
    const handoff = await this.handoff.create(
      context,
      state,
      "provider_failure",
      events,
      state.preferredResponseLocale === "ar"
        ? "الخدمة غير متاحة حالياً. حفظت سياق المحادثة ويمكنني تحويلك لموظف."
        : "The service is temporarily unavailable. I preserved the conversation and can hand you to an agent."
    );
    return { ...handoff, kind: "provider_failure" };
  }
}

function isProhibitedBusinessAction(reason: HandoffReason): boolean {
  return [
    "payment_dispute",
    "refund_request",
    "cancellation_request",
    "address_change_request"
  ].includes(reason);
}

function interruptUsefulForHumanAssistance(reason: HandoffReason | undefined): boolean {
  return (
    reason !== undefined && reason !== "unsupported_action" && reason !== "insufficient_knowledge"
  );
}

function refuseUnsafeRequest(
  state: ConversationState,
  category: import("../types").SafetyRequestCategory | undefined
): WorkflowResult {
  const ar = state.preferredResponseLocale === "ar";
  if (category === "duplicate_action" && state.returnDraftId) {
    return {
      kind: "unavailable",
      message: ar
        ? `تم إنشاء طلب الإرجاع ${state.returnDraftId} مسبقاً، ولن أنشئ طلباً مكرراً.`
        : `Return ${state.returnDraftId} already exists, so I won't create a duplicate.`
    };
  }
  return {
    kind: "unavailable",
    message: ar
      ? "ما أقدر أوفر تعليمات النظام أو بيانات الدخول أو مخرجات الأدوات الداخلية أو بيانات العملاء المحمية، ولا أنفذ إجراءً محمياً مكرراً. أقدر أساعدك عبر المسارات الآمنة المتاحة."
      : "I can’t provide system instructions, credentials, raw internal tool output, protected customer data, or duplicate protected actions. I can still help through the supported secure flows."
  };
}

function acknowledge(state: ConversationState): WorkflowResult {
  return {
    kind: "answered",
    message:
      state.preferredResponseLocale === "ar"
        ? "العفو! إذا احتجت أي مساعدة ثانية أنا حاضر."
        : "You're welcome! I'm here if you need anything else."
  };
}
