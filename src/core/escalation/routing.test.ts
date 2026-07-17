import { describe, expect, it } from "vitest";
import type { HandoffReason, HandoffPayload } from "../types";
import { handoffReasonLabel, routingFor } from "./routing";
import { resolveGlobalInterrupt } from "../orchestration/signals";

type RoutingExpectation = Pick<HandoffPayload, "urgency" | "priority" | "recommendedTier">;

const cases: Array<[HandoffReason, RoutingExpectation]> = [
  ["payment_dispute", { urgency: "high", priority: 1, recommendedTier: "cx_manager" }],
  ["refund_request", { urgency: "high", priority: 1, recommendedTier: "cx_manager" }],
  ["vip_customer", { urgency: "high", priority: 1, recommendedTier: "cx_manager" }],
  ["out_of_policy", { urgency: "high", priority: 1, recommendedTier: "cx_manager" }],
  ["complaint", { urgency: "high", priority: 2, recommendedTier: "supervisor" }],
  ["critical_safety", { urgency: "high", priority: 2, recommendedTier: "supervisor" }],
  ["failed_self_service", { urgency: "high", priority: 2, recommendedTier: "supervisor" }],
  ["verification_failed_twice", { urgency: "high", priority: 2, recommendedTier: "supervisor" }],
  ["delivery_exception", { urgency: "high", priority: 2, recommendedTier: "supervisor" }],
  ["provider_failure", { urgency: "medium", priority: 2, recommendedTier: "admin" }],
  ["explicit_request", { urgency: "medium", priority: 3, recommendedTier: "agent" }],
  ["cancellation_request", { urgency: "medium", priority: 3, recommendedTier: "agent" }],
  ["address_change_request", { urgency: "medium", priority: 3, recommendedTier: "agent" }],
  ["unsupported_action", { urgency: "medium", priority: 3, recommendedTier: "agent" }],
  ["insufficient_knowledge", { urgency: "medium", priority: 3, recommendedTier: "agent" }]
];

describe("handoff routing", () => {
  it("maps every reason to a support tier and safe labels", () => {
    for (const [reason, expected] of cases) {
      expect(routingFor(reason)).toEqual(expected);
      expect(handoffReasonLabel(reason, "en")).not.toHaveLength(0);
      expect(handoffReasonLabel(reason, "ar")).not.toHaveLength(0);
    }
  });

  it("keeps specific financial risk ahead of a generic human request", () => {
    expect(
      resolveGlobalInterrupt({
        explicitHumanRequest: true,
        refundRequest: true,
        authorizationBypassAttempt: false,
        cancellationRequest: false,
        addressChangeRequest: false,
        paymentDispute: false,
        complaintOrAnger: false,
        criticalSafety: false,
        unsafeActionRequest: false
      })
    ).toBe("refund_request");
  });
});
