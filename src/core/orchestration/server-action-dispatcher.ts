import { selectResponseLocale, type WorkflowResult } from "../conversation/transitions";
import type {
  AuditEvent,
  ChatActionInput,
  ConversationState,
  EvidenceSource,
  RequestContext
} from "../types";
import { event } from "../utils";
import type { ReturnWorkflow } from "../workflows/return-workflow";
import { PendingIntentCoordinator } from "./pending-intent-coordinator";

type Workflows = { returns: ReturnWorkflow };

export class ServerActionDispatcher {
  constructor(
    private readonly workflows: Workflows,
    private readonly pendingIntents: PendingIntentCoordinator
  ) {}

  async dispatch(
    context: RequestContext,
    state: ConversationState,
    input: ChatActionInput,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    if (!isActionAllowed(state, input)) {
      events.push(
        event(
          "safety",
          "Server action rejected",
          `${input.inputType} is not valid for conversation phase ${state.phase}.`
        )
      );
      return {
        kind: "unavailable",
        message:
          state.preferredResponseLocale === "ar"
            ? "هذا الإجراء لم يعد متاحاً. استخدم الخيارات الحالية في المحادثة."
            : "That action is no longer available. Use the current conversation options."
      };
    }

    switch (input.inputType) {
      case "select_intent":
        return this.pendingIntents.select(context, state, input.intent, events, sources);
      case "continue_intent":
        return this.pendingIntents.resume(context, state, input.intent, events, sources);
      case "select_return_item":
        return this.workflows.returns.selectItem(context, state, input, undefined, events, sources);
      case "set_return_condition":
        return this.workflows.returns.setCondition(
          context,
          state,
          input,
          undefined,
          events,
          sources
        );
      case "set_return_reason":
        return this.workflows.returns.setReason(context, state, input, undefined, events, sources);
      case "confirm_return":
        return state.phase === "return_draft_created"
          ? this.workflows.returns.duplicateConfirmation(state, events)
          : this.workflows.returns.confirm(context, state, input, undefined, events);
      case "set_language":
        selectResponseLocale(state, input.locale, true);
        return {
          kind: "answered",
          message:
            input.locale === "ar"
              ? "تم تغيير لغة الرد إلى العربية."
              : "Response language changed to English."
        };
    }
  }
}

function isActionAllowed(state: ConversationState, input: ChatActionInput): boolean {
  switch (input.inputType) {
    case "set_language":
      return true;
    case "select_intent":
      return (
        state.phase === "awaiting_intent_clarification" &&
        state.pendingClarification?.type === "intent_order" &&
        state.pendingClarification.options.includes(input.intent)
      );
    case "continue_intent":
      return state.pendingIntents?.some((pending) => pending.intent === input.intent) ?? false;
    case "select_return_item":
      return state.phase === "awaiting_return_item" && Boolean(state.authenticatedAccess);
    case "set_return_condition":
      return (
        state.phase === "awaiting_return_condition" &&
        state.activeIntent === "return_request" &&
        Boolean(state.authenticatedAccess && state.selectedItemIds?.length)
      );
    case "set_return_reason":
      return (
        state.phase === "awaiting_return_reason" &&
        state.activeIntent === "return_request" &&
        Boolean(state.authenticatedAccess && state.selectedItemIds?.length)
      );
    case "confirm_return":
      return (
        (state.phase === "awaiting_return_confirmation" ||
          state.phase === "return_draft_created") &&
        state.pendingAction?.type === "create_return_draft" &&
        input.confirmationToken === state.pendingAction.confirmationToken
      );
  }
}
