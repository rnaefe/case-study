import type { ConversationState, ConversationStore, RequestContext } from "@/core";
import { conversationKey } from "./tenant-boundary";

const conversationState = new Map<string, ConversationState>();

export class InMemoryConversationStore implements ConversationStore {
  async get(context: RequestContext): Promise<ConversationState | null> {
    return conversationState.get(conversationKey(context)) ?? null;
  }

  async save(context: RequestContext, state: ConversationState): Promise<void> {
    conversationState.set(conversationKey(context), structuredClone(state));
  }

  async clear(context: RequestContext): Promise<void> {
    conversationState.delete(conversationKey(context));
  }
}
