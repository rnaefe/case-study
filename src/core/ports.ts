import type {
  HandoffPayload,
  KnowledgeDocument,
  Order,
  Product,
  RequestContext,
  ReturnDraft,
  SupportTicket,
  TrackingStatus,
  UnderstandingResult,
  VerifiedOrderAccess
} from "./types";

export interface CommerceGateway {
  searchProducts(context: RequestContext, query: string): Promise<Product[]>;
  listProducts(context: RequestContext): Promise<Product[]>;
  getAuthorizedOrder(context: RequestContext, access: VerifiedOrderAccess): Promise<Order>;
  createReturnDraft(
    context: RequestContext,
    input: {
      orderId: string;
      customerId: string;
      itemIds: string[];
      reason: string;
      confirmationToken: string;
      idempotencyKey: string;
    }
  ): Promise<ReturnDraft>;
}

export interface ShippingGateway {
  getTracking(context: RequestContext, shipmentId: string): Promise<TrackingStatus>;
}

export interface HelpdeskGateway {
  createHandoff(context: RequestContext, payload: HandoffPayload): Promise<SupportTicket>;
}

export interface VerificationService {
  requestChallenge(
    context: RequestContext,
    orderId: string
  ): Promise<{ accepted: boolean; challengeId?: string }>;
  verifyChallenge(
    context: RequestContext,
    input: { orderId: string; code: string }
  ): Promise<VerifiedOrderAccess | null>;
}

export interface KnowledgeRepository {
  searchApproved(context: RequestContext, query: string): Promise<KnowledgeDocument[]>;
  findApprovedByCategory(
    context: RequestContext,
    category: KnowledgeDocument["category"],
    locale: "en" | "ar"
  ): Promise<KnowledgeDocument[]>;
}

export interface ConversationStore {
  get(context: RequestContext): Promise<import("./types").ConversationState | null>;
  save(context: RequestContext, state: import("./types").ConversationState): Promise<void>;
  clear(context: RequestContext): Promise<void>;
}

export interface AssistantModel {
  understand(input: {
    text: string;
    locale: import("./types").Locale;
    recentMessages: import("./types").RedactedMessage[];
  }): Promise<UnderstandingResult>;
  composeResponse(input: {
    locale: import("./types").Locale;
    intent: import("./types").Intent;
    userText: string;
    evidence: string[];
    groundedDraft: string;
  }): Promise<string>;
  summarizeHandoff(input: {
    locale: import("./types").Locale;
    reason: import("./types").HandoffReason;
    transcript: import("./types").RedactedMessage[];
    attemptedResolutions: string[];
  }): Promise<string>;
}
