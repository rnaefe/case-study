import {
  cancelReturn,
  mergeReturnContext,
  recordReturnDraft,
  requestReturnConfirmation,
  resetVerificationState,
  selectReturnItem,
  transition,
  type WorkflowResult
} from "../conversation/transitions";
import type { SupportRuntime } from "../orchestration/runtime";
import type {
  AuditEvent,
  ChatInput,
  ConversationState,
  EvidenceSource,
  RequestContext,
  UnderstandingResult
} from "../types";
import { evaluateReturn } from "../returns/return-policy";
import { event, redactPii } from "../utils";
import { HandoffWorkflow } from "./handoff-workflow";

export class ReturnWorkflow {
  constructor(
    private readonly runtime: SupportRuntime,
    private readonly handoff: HandoffWorkflow
  ) {}

  async selectItem(
    context: RequestContext,
    state: ConversationState,
    input: ChatInput,
    understanding: UnderstandingResult | undefined,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    if (!state.authenticatedAccess) throw new Error("Return item selection without authorization");
    const order = await this.runtime.commerce.getAuthorizedOrder(
      context,
      state.authenticatedAccess
    );
    const selectedItemId = input.inputType === "select_return_item" ? input.itemId : undefined;
    const selectedNumber = understanding?.entities.selectedItemNumber;
    const item = selectedItemId
      ? order.items.find((candidate) => candidate.id === selectedItemId)
      : selectedNumber
        ? order.items[selectedNumber - 1]
        : undefined;
    if (!item) {
      return {
        kind: "clarification_required",
        message:
          state.preferredResponseLocale === "ar"
            ? "اختر منتجاً صحيحاً من القائمة."
            : "Please choose a valid item from the list."
      };
    }
    selectReturnItem(state, item.id);
    const condition = state.returnContext?.condition;
    const reason = state.returnContext?.reason;
    if (!condition || condition === "unknown")
      return this.askForCondition(state, events, item.name);
    if (!reason) return this.askForReason(state, events);
    return this.prepareConfirmation(context, state, events, sources);
  }

  async setCondition(
    context: RequestContext,
    state: ConversationState,
    input: ChatInput,
    understanding: UnderstandingResult | undefined,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const condition =
      input.inputType === "set_return_condition"
        ? input.condition
        : understanding?.entities.returnCondition;
    if (!condition || condition === "unknown") {
      return this.askForCondition(state, events);
    }
    mergeReturnContext(state, {
      condition,
      conditionFacts: {
        ...factsForCondition(condition),
        ...(understanding?.entities.returnConditionFacts ?? {})
      }
    });
    if (state.returnContext?.reason) {
      return this.prepareConfirmation(context, state, events, sources);
    }
    return this.askForReason(state, events);
  }

  async setReason(
    context: RequestContext,
    state: ConversationState,
    input: ChatInput,
    understanding: UnderstandingResult | undefined,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const reason =
      input.inputType === "set_return_reason" ? input.reason : understanding?.entities.returnReason;
    if (!reason || reason.trim().length < 3) {
      return {
        kind: "clarification_required",
        message:
          state.preferredResponseLocale === "ar"
            ? "اكتب سبب الإرجاع باختصار."
            : "Please briefly describe the return reason."
      };
    }
    mergeReturnContext(state, { reason: redactPii(reason.trim()) });
    return this.prepareConfirmation(context, state, events, sources);
  }

  async confirm(
    context: RequestContext,
    state: ConversationState,
    input: ChatInput,
    understanding: UnderstandingResult | undefined,
    events: AuditEvent[]
  ): Promise<WorkflowResult> {
    if (!state.pendingAction) throw new Error("Missing pending return action");
    const cancelled =
      (input.inputType === "confirm_return" && !input.confirmed) ||
      understanding?.entities.confirmationDecision === "cancel";
    if (cancelled) {
      cancelReturn(state, events);
      events.push(event("safety", "Return cancelled", "No return draft was created."));
      return {
        kind: "answered",
        message:
          state.preferredResponseLocale === "ar"
            ? "تم الإلغاء، ولم ننشئ طلب إرجاع."
            : "Cancelled. No return draft was created."
      };
    }
    const confirmedByAction =
      input.inputType === "confirm_return" &&
      input.confirmed &&
      input.confirmationToken === state.pendingAction.confirmationToken;
    if (!confirmedByAction) {
      return {
        kind: "action_required",
        message:
          state.preferredResponseLocale === "ar"
            ? "أكد إنشاء مسودة الإرجاع أو اختر إلغاء."
            : "Please confirm creating the return draft or choose cancel.",
        suggestedActions: this.confirmationActions(state)
      };
    }
    if (state.authenticatedAccess?.orderId !== state.pendingAction.orderId) {
      throw new Error("Return draft requested without matching verified order access");
    }
    const draft = await this.runtime.commerce.createReturnDraft(context, {
      ...state.pendingAction,
      customerId: state.authenticatedAccess.customerId,
      idempotencyKey: `${context.tenantId}:${context.conversationId}:${state.pendingAction.orderId}:${state.pendingAction.itemIds.join(",")}`
    });
    recordReturnDraft(state, draft.id, events);
    events.push(event("tool_call", "Return draft created", `${draft.id} (idempotent)`));
    return {
      kind: "answered",
      message:
        state.preferredResponseLocale === "ar"
          ? `تم إنشاء مسودة الإرجاع ${draft.id}. سيراجع الفريق الطلب قبل أي استرداد مالي.`
          : `Return draft ${draft.id} was created. The team will review it before any refund.`
    };
  }

  duplicateConfirmation(state: ConversationState, events: AuditEvent[]): WorkflowResult {
    events.push(
      event(
        "safety",
        "Duplicate return confirmation ignored",
        "The existing idempotent draft was reused."
      )
    );
    return {
      kind: "answered",
      message:
        state.preferredResponseLocale === "ar"
          ? `مسودة الإرجاع ${state.returnDraftId ?? "الحالية"} موجودة بالفعل؛ ما أنشأنا نسخة ثانية.`
          : `Return draft ${state.returnDraftId ?? "already exists"}; no duplicate was created.`
    };
  }

  private askForCondition(
    state: ConversationState,
    events: AuditEvent[],
    itemName?: string
  ): WorkflowResult {
    transition(state, "awaiting_return_condition", events);
    const ar = state.preferredResponseLocale === "ar";
    const options = [
      { label: ar ? "غير مفتوح" : "Unopened", condition: "unopened" as const },
      { label: ar ? "مفتوح" : "Opened", condition: "opened" as const },
      { label: ar ? "تالف" : "Damaged", condition: "damaged" as const }
    ];
    return {
      kind: "action_required",
      message: ar
        ? itemName
          ? `وش حالة ${itemName}؟`
          : "اختر حالة المنتج: غير مفتوح، مفتوح، أو تالف."
        : itemName
          ? `What is the condition of ${itemName}?`
          : "Please choose the item condition: unopened, opened, or damaged.",
      suggestedReplies: options.map((option) => option.label),
      suggestedActions: options.map((option) => ({
        label: option.label,
        action: { inputType: "set_return_condition", condition: option.condition }
      }))
    };
  }

  private askForReason(state: ConversationState, events: AuditEvent[]): WorkflowResult {
    transition(state, "awaiting_return_reason", events);
    const ar = state.preferredResponseLocale === "ar";
    const options = ar
      ? [
          { label: "المقاس ما ناسبني", reason: "Wrong size or fit" },
          { label: "غيرت رأيي", reason: "Changed mind" },
          { label: "وصل تالف", reason: "Item arrived damaged" }
        ]
      : [
          { label: "Wrong size or fit", reason: "Wrong size or fit" },
          { label: "Changed my mind", reason: "Changed mind" },
          { label: "Item arrived damaged", reason: "Item arrived damaged" }
        ];
    return {
      kind: "action_required",
      message: ar ? "وش سبب الإرجاع؟" : "What is the reason for the return?",
      suggestedReplies: options.map((option) => option.label),
      suggestedActions: options.map((option) => ({
        label: option.label,
        action: { inputType: "set_return_reason", reason: option.reason }
      }))
    };
  }

  private async prepareConfirmation(
    context: RequestContext,
    state: ConversationState,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    if (!state.authenticatedAccess || !state.selectedItemIds?.[0]) {
      throw new Error("Return policy evaluation without authorized item context");
    }
    const order = await this.runtime.commerce.getAuthorizedOrder(
      context,
      state.authenticatedAccess
    );
    if (order.status !== "delivered" || !order.deliveredAt) {
      resetVerificationState(state);
      transition(state, "awaiting_order_number", events);
      events.push(
        event(
          "policy",
          "Return blocked before delivery",
          `${order.id} is ${order.status}; no return action was prepared.`
        )
      );
      return {
        kind: "clarification_required",
        message:
          state.preferredResponseLocale === "ar"
            ? `الطلب ${order.id} ما تم تسليمه، لذلك ما نقدر نبدأ إرجاعه. هل تقصد طلباً آخر؟`
            : `Order ${order.id} has not been delivered, so it cannot enter the return flow. Are you referring to another order?`,
        suggestedReplies: ["ORD-2002"]
      };
    }
    const item = order.items.find((candidate) => candidate.id === state.selectedItemIds?.[0]);
    if (!item) throw new Error("Selected return item not found");
    const condition = state.returnContext?.condition;
    const conditionFacts = state.returnContext?.conditionFacts;
    const policyItem = {
      ...item,
      opened: item.opened || condition === "opened" || conditionFacts?.packageOpened === true,
      damaged:
        item.damaged ||
        condition === "damaged" ||
        conditionFacts?.damaged === true ||
        conditionFacts?.missingParts === true
    };
    const eligibility = evaluateReturn(this.runtime.returnPolicy, policyItem, order.deliveredAt);
    events.push(event("policy", "Deterministic return policy", eligibility.reason));
    const policyQuery = state.preferredResponseLocale === "ar" ? "سياسة الإرجاع" : "return policy";
    const policyDoc = (await this.runtime.knowledge.searchApproved(context, policyQuery))[0];
    if (policyDoc) {
      sources.push({ id: policyDoc.id, label: policyDoc.title });
      events.push(
        event("knowledge", "Approved return policy", `${policyDoc.id} supports the decision.`)
      );
    }
    if (eligibility.requiresHumanReview || !eligibility.eligible) {
      return this.handoff.create(
        context,
        state,
        "out_of_policy",
        events,
        state.preferredResponseLocale === "ar" ? eligibility.reasonAr : eligibility.reason,
        order
      );
    }
    requestReturnConfirmation(
      state,
      {
        type: "create_return_draft",
        orderId: order.id,
        itemIds: [item.id],
        reason: state.returnContext?.reason ?? "Customer requested return",
        confirmationToken: crypto.randomUUID()
      },
      events
    );
    return {
      kind: "action_required",
      message:
        state.preferredResponseLocale === "ar"
          ? `${eligibility.reasonAr} هل تؤكد إنشاء مسودة إرجاع لـ ${item.name}؟ لن يتم إصدار استرداد تلقائياً.`
          : `${eligibility.reason} Confirm creating a return draft for ${item.name}? No refund will be issued automatically.`,
      suggestedReplies:
        state.preferredResponseLocale === "ar" ? ["نعم، أؤكد", "لا"] : ["Yes, confirm", "No"],
      suggestedActions: this.confirmationActions(state)
    };
  }

  private confirmationActions(state: ConversationState) {
    if (!state.pendingAction) return [];
    const ar = state.preferredResponseLocale === "ar";
    return [
      {
        label: ar ? "نعم، أؤكد" : "Yes, confirm",
        action: {
          inputType: "confirm_return" as const,
          confirmationToken: state.pendingAction.confirmationToken,
          confirmed: true
        }
      },
      {
        label: ar ? "لا" : "No",
        action: {
          inputType: "confirm_return" as const,
          confirmationToken: state.pendingAction.confirmationToken,
          confirmed: false
        }
      }
    ];
  }
}

function factsForCondition(condition: "unopened" | "opened" | "damaged") {
  switch (condition) {
    case "unopened":
      return { packageOpened: false, unused: true };
    case "opened":
      return { packageOpened: true };
    case "damaged":
      return { damaged: true };
  }
}
