import type { EscalationSignals, HandoffReason, Readiness } from "../types";

export function extractOrderId(text: string): string | undefined {
  return text.toUpperCase().match(/\b(ORD-\d{4})\b/)?.[1];
}

export function resolveGlobalInterrupt(signals: EscalationSignals): HandoffReason | undefined {
  if (signals.criticalSafety) return "critical_safety";
  if (signals.paymentDispute) return "payment_dispute";
  if (signals.refundRequest) return "refund_request";
  if (signals.cancellationRequest) return "cancellation_request";
  if (signals.addressChangeRequest) return "address_change_request";
  if (signals.complaintOrAnger) return "complaint";
  if (signals.explicitHumanRequest) return "explicit_request";
  if (signals.unsafeActionRequest) return "unsupported_action";
  return undefined;
}

export function resolveReadinessHandoff(readiness: Readiness): HandoffReason | undefined {
  if (readiness === "insufficient_evidence") return "insufficient_knowledge";
  if (readiness === "must_escalate") return "unsupported_action";
  return undefined;
}
