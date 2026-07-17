import { type AssistantModel, type RequestContext, SupportOrchestrator } from "@/core";
import { InMemoryConversationStore } from "./adapters/conversation-store";
import { MockCommerceGateway } from "./adapters/commerce-gateway";
import { MockHelpdeskGateway } from "./adapters/helpdesk-gateway";
import { TenantKnowledgeRepository } from "./adapters/knowledge-repository";
import { MockShippingGateway } from "./adapters/shipping-gateway";
import { MockVerificationService } from "./adapters/verification-service";
import { OpenAIAssistantModel } from "./openai-assistant-model";
import { getTenantData } from "./tenants";

const conversations = new InMemoryConversationStore();

export function createRuntime(
  tenantId: string,
  dependencies: { model?: AssistantModel } = {}
): SupportOrchestrator | null {
  const tenant = getTenantData(tenantId);
  if (!tenant) return null;
  return new SupportOrchestrator({
    tenant: tenant.config,
    returnPolicy: tenant.returnPolicy,
    commerce: new MockCommerceGateway(tenant),
    shipping: new MockShippingGateway(tenant),
    helpdesk: new MockHelpdeskGateway(tenant),
    verification: new MockVerificationService(tenant),
    knowledge: new TenantKnowledgeRepository(tenant),
    conversations,
    model: dependencies.model ?? new OpenAIAssistantModel()
  });
}

// Clearing a conversation is a store-only operation and must not depend on the
// OpenAI model being configured, so "New chat" works even without an API key.
export async function resetConversation(context: RequestContext): Promise<boolean> {
  if (!getTenantData(context.tenantId)) return false;
  await conversations.clear(context);
  return true;
}
