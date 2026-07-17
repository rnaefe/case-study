import type {
  AssistantModel,
  CommerceGateway,
  ConversationStore,
  HelpdeskGateway,
  KnowledgeRepository,
  ShippingGateway,
  VerificationService
} from "../ports";
import type { ReturnPolicy, TenantConfig } from "../types";

export interface SupportRuntime {
  tenant: TenantConfig;
  returnPolicy: ReturnPolicy;
  commerce: CommerceGateway;
  shipping: ShippingGateway;
  helpdesk: HelpdeskGateway;
  verification: VerificationService;
  knowledge: KnowledgeRepository;
  conversations: ConversationStore;
  model: AssistantModel;
}
