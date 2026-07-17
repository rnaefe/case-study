import type { SupportRuntime } from "../orchestration/runtime";
import type { ApplicationResultOf } from "../application-result";
import type { AuditEvent, ConversationState, HandoffReason, Order, RequestContext } from "../types";
import { event, maskName } from "../utils";
import { handoffReasonLabel, routingFor } from "../escalation/routing";
import { transitionToEscalated } from "../conversation/transitions";

export class HandoffWorkflow {
  constructor(private readonly runtime: SupportRuntime) {}

  async create(
    context: RequestContext,
    state: ConversationState,
    reason: HandoffReason,
    events: AuditEvent[],
    customMessage?: string,
    order?: Order
  ): Promise<ApplicationResultOf<"handoff_required">> {
    let safeOrder = order;
    if (!safeOrder && state.authenticatedAccess) {
      try {
        safeOrder = await this.runtime.commerce.getAuthorizedOrder(
          context,
          state.authenticatedAccess
        );
        events.push(
          event(
            "tool_call",
            "Authorized handoff context",
            `${safeOrder.id} added with masked customer context.`
          )
        );
      } catch {
        events.push(
          event(
            "safety",
            "Handoff context unavailable",
            "The handoff continued without private order context."
          )
        );
      }
    }
    const eventHistory = [...(state.auditHistory ?? []), ...events];
    const attemptedResolutions = eventHistory
      .filter((entry) => entry.type === "tool_call")
      .map((entry) => entry.label)
      .filter((label, index, all) => all.indexOf(label) === index);
    let summary = `Support handoff: ${reason.replaceAll("_", " ")}`;
    if (reason !== "provider_failure") {
      try {
        summary = await this.runtime.model.summarizeHandoff({
          locale: state.preferredResponseLocale ?? "en",
          reason,
          transcript: state.messages,
          attemptedResolutions
        });
        events.push(
          event(
            "tool_call",
            "Redacted handoff summary",
            "Model summarized the already-redacted conversation."
          )
        );
      } catch {
        events.push(
          event(
            "safety",
            "Handoff summary fallback",
            "Deterministic summary used so provider failure cannot block escalation."
          )
        );
      }
    }

    const ticket = await this.runtime.helpdesk.createHandoff(context, {
      conversationId: context.conversationId,
      tenantId: context.tenantId,
      summary,
      transcript: state.messages,
      ...(safeOrder
        ? {
            customerContext: {
              customerId: safeOrder.customerId,
              maskedName: maskName(safeOrder.customerName)
            },
            orderContext: { orderId: safeOrder.id, status: safeOrder.status }
          }
        : {}),
      attemptedResolutions,
      toolCalls: eventHistory
        .filter((entry) => entry.type === "tool_call")
        .map((entry) => ({ name: entry.label, outcome: entry.detail })),
      reason,
      ...routingFor(reason)
    });
    transitionToEscalated(state, events);
    events.push(event("handoff", "Mock HubSpot handoff created", `${ticket.id} · ${reason}`));
    const locale = state.preferredResponseLocale ?? "en";
    const label = handoffReasonLabel(reason, locale);
    const defaultMessage =
      locale === "ar"
        ? `حوّلت المحادثة لفريق خدمة العملاء برقم ${ticket.id}. سبب التحويل: ${label}. أرسلت لهم السياق بعد إخفاء البيانات الحساسة.`
        : `I handed this to the support team as ${ticket.id}. Handoff reason: ${label}. They received the redacted context so you won't need to repeat everything.`;
    return {
      kind: "handoff_required",
      message: customMessage ? `${customMessage}\n\n${defaultMessage}` : defaultMessage,
      ticket
    };
  }
}
