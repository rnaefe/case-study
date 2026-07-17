import {
  appendTranscriptMessage,
  initializeConversation,
  recordAuditHistory,
  responseLocaleFor,
  transcriptContent
} from "./conversation/transitions";
import { ChatRouter } from "./orchestration/chat-router";
import type { SupportRuntime } from "./orchestration/runtime";
import type { AuditEvent, ChatInput, ChatResponse, EvidenceSource, RequestContext } from "./types";
import { directionFor, estimateUsage, event, newState, redactPii } from "./utils";

export type { SupportRuntime } from "./orchestration/runtime";

export class SupportOrchestrator {
  private readonly router: ChatRouter;

  constructor(private readonly runtime: SupportRuntime) {
    this.router = new ChatRouter(runtime);
  }

  async reset(context: RequestContext): Promise<void> {
    await this.runtime.conversations.clear(context);
  }

  async chat(context: RequestContext, input: ChatInput): Promise<ChatResponse> {
    const state = (await this.runtime.conversations.get(context)) ?? newState();
    initializeConversation(state, "en");
    const events: AuditEvent[] = [];
    const sources: EvidenceSource[] = [];
    appendTranscriptMessage(state, {
      role: "user",
      content: redactPii(transcriptContent(input)),
      createdAt: new Date().toISOString()
    });

    const result = await this.router.route(context, state, input, events, sources);

    appendTranscriptMessage(state, {
      role: "assistant",
      content: result.message,
      createdAt: new Date().toISOString()
    });
    const usage = estimateUsage(
      this.runtime.tenant,
      context.conversationId,
      input.inputType === "message" ? input.message : input.inputType,
      result.message,
      state.activeIntent ?? "needs_clarification",
      state.phase === "escalated"
        ? "handoff"
        : state.phase === "resolved" || state.phase === "return_draft_created"
          ? "resolved"
          : "failed"
    );
    events.push(
      event(
        "usage",
        "Estimated model usage",
        `${usage.inputTokens} input / ${usage.outputTokens} output tokens · $${(usage.estimatedCostUsd ?? 0).toFixed(6)}`
      )
    );
    recordAuditHistory(state, events);
    await this.runtime.conversations.save(context, state);

    return {
      ...result,
      outcome: result.kind,
      state,
      events,
      sources,
      direction: directionFor(responseLocaleFor(state)),
      usage
    };
  }
}
