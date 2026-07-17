import {
  activatePendingIntent,
  askForOrderNumber,
  clearClarification,
  offerPendingIntent,
  replacePendingIntents,
  type WorkflowResult
} from "../conversation/transitions";
import type {
  AuditEvent,
  ConversationState,
  EvidenceSource,
  PendingIntent,
  RequestContext
} from "../types";
import {
  createProductFollowUpUnderstanding,
  focusUnderstanding,
  needsProductReference,
  requestProductReference
} from "./product-routing";
import type { OrderWorkflow } from "../workflows/order-workflow";
import type { ProductWorkflow } from "../workflows/product-workflow";

type SelectableIntent = "product_information" | "order_tracking";
type Workflows = { order: OrderWorkflow; product: ProductWorkflow };

export class PendingIntentCoordinator {
  constructor(private readonly workflows: Workflows) {}

  async select(
    context: RequestContext,
    state: ConversationState,
    selected: SelectableIntent,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const understanding = state.pendingUnderstanding;
    const originalText =
      state.pendingClarification?.originalText ?? state.messages.at(-1)?.content ?? "";
    if (!understanding) return this.askForSelection(state);

    clearClarification(state);
    const remaining: PendingIntent = {
      intent: selected === "product_information" ? "order_tracking" : "product_information",
      originalText,
      ...(understanding.entities.orderId ? { orderId: understanding.entities.orderId } : {}),
      understanding
    };
    replacePendingIntents(state, [remaining]);
    activatePendingIntent(state, selected);

    if (selected === "order_tracking") {
      return understanding.entities.orderId
        ? this.workflows.order.startOrReuseAccess(
            context,
            state,
            understanding.entities.orderId,
            events
          )
        : askForOrderNumber(state, events);
    }

    const focused = focusUnderstanding(understanding, selected);
    if (needsProductReference(state, focused)) {
      return requestProductReference(state, originalText, focused, events);
    }
    const result = await this.workflows.product.handle(
      context,
      state,
      originalText,
      focused,
      events,
      sources,
      "product_information"
    );
    return offerPendingIntent(state, result);
  }

  async resume(
    context: RequestContext,
    state: ConversationState,
    selected: SelectableIntent,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const pending = state.pendingIntents?.find((item) => item.intent === selected);
    if (!pending) return this.askForSelection(state);

    replacePendingIntents(state, state.pendingIntents?.filter((item) => item !== pending) ?? []);
    activatePendingIntent(state, selected);

    if (selected === "order_tracking") {
      const orderId = pending.orderId ?? pending.understanding?.entities.orderId;
      return orderId
        ? this.workflows.order.startOrReuseAccess(context, state, orderId, events)
        : askForOrderNumber(state, events);
    }

    const understanding = focusUnderstanding(
      pending.understanding ?? createProductFollowUpUnderstanding(state),
      "product_information"
    );
    if (needsProductReference(state, understanding)) {
      return requestProductReference(state, pending.originalText, understanding, events);
    }
    return this.workflows.product.handle(
      context,
      state,
      pending.originalText,
      understanding,
      events,
      sources,
      "product_information"
    );
  }

  askForSelection(state: ConversationState): WorkflowResult {
    const ar = state.preferredResponseLocale === "ar";
    const actions = [
      {
        label: ar ? "توفر المنتج أولاً" : "Product availability first",
        action: {
          inputType: "select_intent" as const,
          intent: "product_information" as const
        }
      },
      {
        label: ar ? "تتبع الطلب أولاً" : "Order tracking first",
        action: { inputType: "select_intent" as const, intent: "order_tracking" as const }
      }
    ];
    return {
      kind: "action_required",
      message: ar
        ? "واضح إن عندك سؤال عن توفر منتج وتتبع طلب. أي واحد نبدأ فيه؟"
        : "I can see both a product-availability question and an order-tracking request. Which should we handle first?",
      suggestedReplies: actions.map((item) => item.label),
      suggestedActions: actions
    };
  }
}
