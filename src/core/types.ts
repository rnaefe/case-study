export type Locale = "en" | "ar" | "arabizi";
export type Intent =
  | "product_information"
  | "return_policy_information"
  | "order_tracking"
  | "return_request"
  | "conversation_acknowledgement"
  | "human_handoff"
  | "unsupported"
  | "needs_clarification";

export type ConversationPhase =
  | "idle"
  | "awaiting_intent_clarification"
  | "awaiting_product_clarification"
  | "awaiting_order_number"
  | "awaiting_verification"
  | "order_authenticated"
  | "awaiting_return_item"
  | "awaiting_return_condition"
  | "awaiting_return_reason"
  | "awaiting_return_confirmation"
  | "return_draft_created"
  | "resolved"
  | "escalated";

export interface RequestContext {
  tenantId: string;
  conversationId: string;
}

export interface TenantConfig {
  id: string;
  displayName: string;
  supportedLocales: Locale[];
  enabledIntents: Intent[];
  policyProfile: string;
  knowledgeNamespace: string;
  branding: {
    logoText: string;
    accent: string;
    accentSoft: string;
  };
  ai: {
    provider: string;
    model: string;
    estimatedInputCostPerMillion?: number;
    estimatedOutputCostPerMillion?: number;
  };
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  priceSar: number;
  variants: Array<{ id: string; label: string; stock: number }>;
  tags: string[];
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceSar: number;
  finalSale?: boolean;
  opened?: boolean;
  damaged?: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  maskedPhone: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  placedAt: string;
  deliveredAt?: string;
  shipmentId?: string;
  isVip?: boolean;
  items: OrderItem[];
}

export interface TrackingStatus {
  shipmentId: string;
  status: "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
  description: string;
  descriptionAr: string;
  eta?: string;
  lastUpdatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  locale: "en" | "ar";
  category: "shipping" | "cod" | "returns" | "faq";
  title: string;
  content: string;
  version: number;
  owner: string;
  status: "draft" | "approved" | "archived";
  effectiveFrom: string;
  effectiveUntil?: string;
  updatedAt: string;
  keywords: string[];
}

export interface ReturnPolicy {
  returnWindowDays: number;
  finalSaleExcluded: boolean;
  openedItemsRequireReview: boolean;
  damagedItemsRequireReview: boolean;
  conditions: string[];
  conditionsAr: string[];
}

export interface VerifiedOrderAccess {
  orderId: string;
  customerId: string;
  verifiedAt: string;
}

export interface PendingAction {
  type: "create_return_draft";
  orderId: string;
  itemIds: string[];
  reason: string;
  confirmationToken: string;
}

export type Readiness = "ready" | "needs_clarification" | "insufficient_evidence" | "must_escalate";

export type ResponseLocale = "en" | "ar";
export type HumanRequestTarget =
  "person" | "agent" | "representative" | "supervisor" | "manager" | "other_human";
export type SafetyRequestCategory =
  | "none"
  | "authorization_bypass"
  | "cross_tenant"
  | "private_data"
  | "prompt_disclosure"
  | "credential_extraction"
  | "raw_tool_output"
  | "duplicate_action";
export type ApplicationOutcome =
  | "answered"
  | "clarification_required"
  | "action_required"
  | "handoff_required"
  | "unavailable"
  | "provider_failure";

export interface UnderstandingEntities {
  orderId?: string | undefined;
  productReference?: string | undefined;
  requestedVariant?: string | undefined;
  returnCondition?: "unopened" | "opened" | "damaged" | "unknown" | undefined;
  returnConditionFacts?: ReturnConditionFacts | undefined;
  returnReason?: string | undefined;
  productQuestionType?:
    | "details"
    | "availability"
    | "price"
    | "restock"
    | "returnability"
    | "shipping"
    | "cod"
    | "warranty"
    | "discovery"
    | undefined;
  workflowSelection?: "product_information" | "order_tracking" | undefined;
  confirmationDecision?: "confirm" | "cancel" | undefined;
  selectedItemNumber?: number | undefined;
}

export interface EscalationSignals {
  explicitHumanRequest: boolean;
  authorizationBypassAttempt: boolean;
  refundRequest: boolean;
  cancellationRequest: boolean;
  addressChangeRequest: boolean;
  paymentDispute: boolean;
  complaintOrAnger: boolean;
  criticalSafety: boolean;
  unsafeActionRequest: boolean;
}

export interface UnderstandingResult {
  intent: Intent;
  intents: Intent[];
  detectedLocale: Locale;
  responseLocale: ResponseLocale;
  readiness: Readiness;
  humanRequestTarget?: HumanRequestTarget;
  safetyCategory?: SafetyRequestCategory;
  entities: UnderstandingEntities;
  escalation: EscalationSignals;
  conversation: {
    isFollowUp: boolean;
    refersToPreviousProduct: boolean;
  };
}

export interface PendingIntent {
  intent: "product_information" | "order_tracking";
  originalText: string;
  orderId?: string;
  understanding?: UnderstandingResult;
}

export interface PendingClarification {
  type: "intent_order" | "product_reference" | "order_reference";
  originalText: string;
  options: string[];
}

interface ReturnContext {
  condition?: "unopened" | "opened" | "damaged" | "unknown";
  conditionFacts?: ReturnConditionFacts;
  reason?: string;
}

export interface ReturnConditionFacts {
  packageOpened?: boolean;
  damaged?: boolean;
  unused?: boolean;
  missingParts?: boolean;
}

export interface ConversationState {
  phase: ConversationPhase;
  activeIntent?: Intent;
  lastResolvedIntent?: Intent;
  preferredResponseLocale?: ResponseLocale;
  explicitResponseLocale?: ResponseLocale;
  pendingClarification?: PendingClarification;
  pendingUnderstanding?: UnderstandingResult;
  pendingIntents?: PendingIntent[];
  productContext?: {
    productId: string;
    query: string;
    requestedVariant?: string;
  };
  returnContext?: ReturnContext;
  authenticatedAccess?: VerifiedOrderAccess;
  orderId?: string;
  selectedItemIds?: string[];
  pendingAction?: PendingAction;
  verificationFailureCount: number;
  selfServiceFailureCount: number;
  returnDraftId?: string;
  messages: RedactedMessage[];
  auditHistory?: AuditEvent[];
}

export interface RedactedMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  type:
    | "intent"
    | "state_transition"
    | "tool_call"
    | "knowledge"
    | "verification"
    | "policy"
    | "handoff"
    | "usage"
    | "safety";
  label: string;
  detail: string;
  createdAt: string;
}

export type HandoffReason =
  | "explicit_request"
  | "refund_request"
  | "cancellation_request"
  | "address_change_request"
  | "complaint"
  | "payment_dispute"
  | "critical_safety"
  | "vip_customer"
  | "out_of_policy"
  | "unsupported_action"
  | "insufficient_knowledge"
  | "failed_self_service"
  | "verification_failed_twice"
  | "provider_failure"
  | "delivery_exception";

export interface HandoffPayload {
  conversationId: string;
  tenantId: string;
  summary: string;
  transcript: RedactedMessage[];
  customerContext?: { customerId: string; maskedName: string };
  orderContext?: { orderId: string; status: string };
  attemptedResolutions: string[];
  toolCalls: Array<{ name: string; outcome: string }>;
  reason: HandoffReason;
  urgency: "low" | "medium" | "high";
  priority: number;
  recommendedTier: "agent" | "supervisor" | "cx_manager" | "admin";
}

export interface SupportTicket {
  id: string;
  payload: HandoffPayload;
  createdAt: string;
}

export interface ReturnDraft {
  id: string;
  orderId: string;
  itemIds: string[];
  status: "draft";
  createdAt: string;
}

export interface ReturnEligibility {
  eligible: boolean;
  requiresHumanReview: boolean;
  reason: string;
  reasonAr: string;
}

export interface UsageEvent {
  tenantId: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  intent: Intent;
  outcome: "resolved" | "handoff" | "failed";
  createdAt: string;
}

export interface EvidenceSource {
  id: string;
  label: string;
}

export type ChatInput =
  | { inputType: "message"; message: string }
  | { inputType: "submit_otp"; code: string }
  | {
      inputType: "select_intent";
      intent: "product_information" | "order_tracking";
    }
  | {
      inputType: "continue_intent";
      intent: "product_information" | "order_tracking";
    }
  | { inputType: "select_return_item"; itemId: string }
  | {
      inputType: "set_return_condition";
      condition: "unopened" | "opened" | "damaged";
    }
  | { inputType: "set_return_reason"; reason: string }
  | {
      inputType: "confirm_return";
      confirmationToken: string;
      confirmed: boolean;
    }
  | { inputType: "set_language"; locale: ResponseLocale };

export type ChatActionInput = Exclude<ChatInput, { inputType: "message" | "submit_otp" }>;

export interface ChatResponse {
  outcome: ApplicationOutcome;
  message: string;
  direction: "ltr" | "rtl";
  state: ConversationState;
  events: AuditEvent[];
  sources: EvidenceSource[];
  ticket?: SupportTicket;
  usage?: UsageEvent;
  suggestedReplies?: string[];
  demoOtpAvailable?: boolean;
  suggestedActions?: Array<{
    label: string;
    action: ChatActionInput;
  }>;
}
