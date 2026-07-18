import { z } from "zod";

const IntentSchema = z.enum([
  "product_information",
  "return_policy_information",
  "order_tracking",
  "return_request",
  "conversation_acknowledgement",
  "human_handoff",
  "unsupported",
  "needs_clarification"
]);

export const UnderstandingSchema = z.object({
  intent: IntentSchema,
  intents: z.array(IntentSchema).min(1).max(3),
  inputWritingStyle: z.union([
    z.literal("english").describe("Ordinary English input"),
    z.literal("arabic_script").describe("Input visibly contains Arabic-script words"),
    z.literal("arabizi").describe("Arabic language transliterated in Latin characters")
  ]),
  responseLocale: z.enum(["en", "ar"]),
  readiness: z.enum(["ready", "needs_clarification", "insufficient_evidence", "must_escalate"]),
  humanRequestTarget: z
    .enum(["person", "agent", "representative", "supervisor", "manager", "other_human"])
    .nullable(),
  safetyCategory: z.enum([
    "none",
    "authorization_bypass",
    "cross_tenant",
    "private_data",
    "prompt_disclosure",
    "credential_extraction",
    "raw_tool_output",
    "duplicate_action"
  ]),
  entities: z.object({
    orderId: z.string().nullable(),
    productReference: z
      .string()
      .nullable()
      .describe(
        "Concrete product name or named item phrase from the user; null only if none exists"
      ),
    requestedVariant: z.string().nullable(),
    returnCondition: z.enum(["unopened", "opened", "damaged", "unknown"]).nullable(),
    returnConditionFacts: z
      .object({
        packageOpened: z.boolean().nullable(),
        damaged: z.boolean().nullable(),
        unused: z.boolean().nullable(),
        missingParts: z.boolean().nullable()
      })
      .nullable(),
    returnReason: z.string().nullable(),
    productQuestionType: z
      .enum([
        "details",
        "availability",
        "price",
        "restock",
        "returnability",
        "shipping",
        "cod",
        "warranty",
        "discovery"
      ])
      .nullable(),
    workflowSelection: z.enum(["product_information", "order_tracking"]).nullable(),
    confirmationDecision: z.enum(["confirm", "cancel"]).nullable(),
    selectedItemNumber: z.number().int().positive().nullable()
  }),
  escalation: z.object({
    explicitHumanRequest: z.boolean(),
    authorizationBypassAttempt: z.boolean(),
    refundRequest: z.boolean(),
    cancellationRequest: z.boolean(),
    addressChangeRequest: z.boolean(),
    paymentDispute: z.boolean(),
    complaintOrAnger: z.boolean(),
    criticalSafety: z.boolean(),
    unsafeActionRequest: z.boolean()
  }),
  conversation: z.object({
    isFollowUp: z.boolean(),
    refersToPreviousProduct: z.boolean()
  })
});

export type ParsedUnderstanding = z.infer<typeof UnderstandingSchema>;
