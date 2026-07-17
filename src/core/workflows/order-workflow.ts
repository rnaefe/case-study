import {
  askForOrderNumber,
  beginOrderVerification,
  grantOrderAccess,
  offerPendingIntent,
  recordSelfServiceFailure,
  recordVerificationFailure,
  requestClarification,
  resetVerificationState,
  resolveIntent,
  transition,
  type WorkflowResult
} from "../conversation/transitions";
import type { SupportRuntime } from "../orchestration/runtime";
import type { AuditEvent, ConversationState, RequestContext } from "../types";
import { event } from "../utils";
import { HandoffWorkflow } from "./handoff-workflow";

export class OrderWorkflow {
  constructor(
    private readonly runtime: SupportRuntime,
    private readonly handoff: HandoffWorkflow
  ) {}

  async startOrReuseAccess(
    context: RequestContext,
    state: ConversationState,
    orderId: string,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    if (state.authenticatedAccess?.orderId === orderId) {
      events.push(
        event(
          "verification",
          "Verified access reused",
          "Existing tenant-scoped conversation access reused; no new OTP challenge was issued."
        )
      );
      return this.continueAuthorizedWorkflow(context, state, state.authenticatedAccess, events);
    }
    return this.startVerification(context, state, orderId, events);
  }

  async startVerification(
    context: RequestContext,
    state: ConversationState,
    orderId: string,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    resetVerificationState(state);
    const challenge = await this.runtime.verification.requestChallenge(context, orderId);
    if (!challenge.accepted) {
      const failures = recordSelfServiceFailure(state);
      events.push(
        event(
          "verification",
          "Verification unavailable",
          "No challenge was issued and no order data was exposed."
        )
      );
      events.push(
        event(
          "policy",
          "Self-service attempt failed",
          `${failures}/2 failed attempts; the supplied order reference could not start verification.`
        )
      );
      if (failures >= 2) {
        return this.handoff.create(context, state, "failed_self_service", events);
      }
      transition(state, "awaiting_order_number", events);
      return {
        kind: "clarification_required",
        message:
          state.preferredResponseLocale === "ar"
            ? "تعذر بدء التحقق لرقم الطلب هذا. تأكد من الرقم وحاول مرة أخرى بصيغة ORD-1001."
            : "We couldn't start verification for that order number. Check it and try again using a format like ORD-1001.",
        suggestedReplies: ["ORD-1001"]
      };
    }
    beginOrderVerification(state, orderId, events);
    events.push(
      event(
        "verification",
        "Verification challenge",
        "Mock OTP challenge issued; code is excluded from logs."
      )
    );
    return {
      kind: "action_required",
      message:
        state.preferredResponseLocale === "ar"
          ? `أرسلنا رمز تحقق للرقم المرتبط بالطلب ${orderId}. أدخل الرمز في الحقل الآمن.`
          : `We sent a verification code to the phone linked to ${orderId}. Enter it in the secure field.`,
      demoOtpAvailable: true
    };
  }

  async rejectAuthorizationBypass(
    context: RequestContext,
    state: ConversationState,
    orderId: string | undefined,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    events.push(
      event(
        "safety",
        "Verification bypass rejected",
        "No order or customer data was exposed; structured OTP verification remains required."
      )
    );
    const ar = state.preferredResponseLocale === "ar";
    const cannotBypass = ar ? "لا يمكنني تجاوز التحقق." : "I can't bypass verification.";
    const activeOrderId = orderId ?? state.orderId;
    if (!activeOrderId) {
      const clarification = askForOrderNumber(state, events);
      return {
        ...clarification,
        message: `${cannotBypass} ${clarification.message}`
      };
    }

    let verification: WorkflowResult;
    if (state.phase === "awaiting_verification" && state.orderId === activeOrderId) {
      verification = {
        kind: "action_required",
        message: ar
          ? `أدخل رمز التحقق للطلب ${activeOrderId} في الحقل الآمن.`
          : `Enter the verification code for ${activeOrderId} in the secure field.`,
        demoOtpAvailable: true
      };
    } else {
      verification = await this.startVerification(context, state, activeOrderId, events);
    }
    if (state.phase !== "awaiting_verification") {
      return {
        ...verification,
        kind: "action_required",
        message: `${cannotBypass} ${verification.message}`
      };
    }

    if (recordVerificationFailure(state) >= 2) {
      return this.handoff.create(context, state, "unsupported_action", events);
    }
    return {
      ...verification,
      kind: "action_required",
      message: ar
        ? `لا يمكنني اعتبار التحقق مكتملاً بدون رمز. ${verification.message}`
        : `I can't treat verification as completed without an OTP. ${verification.message}`,
      demoOtpAvailable: true
    };
  }

  async verify(
    context: RequestContext,
    state: ConversationState,
    code: string,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    if (!state.orderId) throw new Error("Missing order context");
    const access = await this.runtime.verification.verifyChallenge(context, {
      orderId: state.orderId,
      code
    });
    if (!access) {
      const failures = recordVerificationFailure(state);
      events.push(event("verification", "Verification failed", "No order data was exposed."));
      if (failures >= 2) {
        return this.handoff.create(context, state, "verification_failed_twice", events);
      }
      return {
        kind: "action_required",
        message:
          state.preferredResponseLocale === "ar"
            ? "الرمز غير صحيح. حاول مرة ثانية؛ لم نعرض أي بيانات للطلب."
            : "That code is not correct. Try once more; no order data was exposed.",
        demoOtpAvailable: true
      };
    }

    grantOrderAccess(state, access, events);
    events.push(event("verification", "Order verified", "Tenant-scoped access granted."));
    return this.continueAuthorizedWorkflow(context, state, access, events);
  }

  private async continueAuthorizedWorkflow(
    context: RequestContext,
    state: ConversationState,
    access: NonNullable<ConversationState["authenticatedAccess"]>,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    const order = await this.runtime.commerce.getAuthorizedOrder(context, access);
    events.push(
      event("tool_call", "Mock Medusa order lookup", `${order.id} retrieved after verification`)
    );
    if (order.isVip)
      return this.handoff.create(context, state, "vip_customer", events, undefined, order);

    if (state.activeIntent === "return_request") {
      if (order.status !== "delivered" || !order.deliveredAt) {
        resetVerificationState(state);
        requestClarification(
          state,
          "awaiting_order_number",
          {
            type: "order_reference",
            originalText: order.id,
            options: ["another_delivered_order"]
          },
          events
        );
        events.push(
          event(
            "policy",
            "Return blocked before delivery",
            `${order.id} is ${order.status}; return eligibility was not evaluated.`
          )
        );
        return {
          kind: "clarification_required",
          message:
            state.preferredResponseLocale === "ar"
              ? `الطلب ${order.id} ما زال ${order.status === "shipped" ? "في الطريق" : "قيد المعالجة"}، لذلك ما نقدر نبدأ إرجاعه الآن. هل تقصد طلباً آخر تم تسليمه؟`
              : `Order ${order.id} is still ${order.status === "shipped" ? "in transit" : "being processed"}, so it cannot be returned yet. Are you referring to another delivered order?`,
          suggestedReplies: ["ORD-2002"]
        };
      }
      transition(state, "awaiting_return_item", events);
      const options = order.items.map((item, index) => ({
        label: `${index + 1}. ${item.name}`,
        action: { inputType: "select_return_item" as const, itemId: item.id }
      }));
      return {
        kind: "action_required",
        message:
          state.preferredResponseLocale === "ar"
            ? `تم التحقق. اختر المنتج المراد إرجاعه:\n${options.map((item) => item.label).join("\n")}`
            : `Verified. Choose the item to return:\n${options.map((item) => item.label).join("\n")}`,
        suggestedReplies: options.map((item) => item.label),
        suggestedActions: options
      };
    }

    if (!order.shipmentId) {
      return this.handoff.create(context, state, "delivery_exception", events, undefined, order);
    }
    const tracking = await this.runtime.shipping.getTracking(context, order.shipmentId);
    events.push(event("tool_call", "Mock Aramex tracking lookup", tracking.status));
    if (tracking.status === "exception") {
      return this.handoff.create(context, state, "delivery_exception", events, undefined, order);
    }
    resolveIntent(state, "order_tracking", events);
    const groundedDraft =
      state.preferredResponseLocale === "ar"
        ? `طلبك ${order.id}: ${tracking.descriptionAr}${tracking.eta ? ` الوصول المتوقع ${tracking.eta}.` : ""}`
        : `Order ${order.id}: ${tracking.description}${tracking.eta ? ` Expected delivery: ${tracking.eta}.` : ""}`;
    const message = await this.runtime.model.composeResponse({
      locale: state.preferredResponseLocale ?? "en",
      intent: "order_tracking",
      userText: "Verified order tracking result",
      evidence: [JSON.stringify({ orderId: order.id, tracking })],
      groundedDraft
    });
    events.push(
      event(
        "tool_call",
        "Localized response composition",
        "Model composed from verified order and shipment evidence."
      )
    );
    return offerPendingIntent(state, { kind: "answered", message });
  }
}
