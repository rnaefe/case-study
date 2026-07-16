import type { AuditEvent, ConversationState, Locale, TenantConfig, UsageEvent } from "./types";

export { evaluateReturn } from "./returns/return-policy";

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function redactPii(text: string): string {
  return text
    .replace(/\b(?:\+?966|0)?5\d{8}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/(?<![\w/-])\d{4}(?![\w/:-])/g, "[CODE_REDACTED]");
}

export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => (part.length ? `${part[0]}***` : ""))
    .join(" ");
}

export function newState(): ConversationState {
  return {
    phase: "idle",
    verificationFailureCount: 0,
    selfServiceFailureCount: 0,
    messages: []
  };
}

export function event(type: AuditEvent["type"], label: string, detail: string): AuditEvent {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    detail,
    createdAt: new Date().toISOString()
  };
}
export function estimateUsage(
  tenant: TenantConfig,
  conversationId: string,
  text: string,
  response: string,
  intent: UsageEvent["intent"],
  outcome: UsageEvent["outcome"]
): UsageEvent {
  const inputTokens = Math.max(1, Math.ceil(text.length / 4));
  const outputTokens = Math.max(1, Math.ceil(response.length / 4));
  const inputCost = ((tenant.ai.estimatedInputCostPerMillion ?? 0) * inputTokens) / 1_000_000;
  const outputCost = ((tenant.ai.estimatedOutputCostPerMillion ?? 0) * outputTokens) / 1_000_000;
  return {
    tenantId: tenant.id,
    conversationId,
    model: tenant.ai.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: inputCost + outputCost,
    intent,
    outcome,
    createdAt: new Date().toISOString()
  };
}
