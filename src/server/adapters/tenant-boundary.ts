import type { RequestContext } from "@/core";
import type { TenantData } from "../tenants";

export function assertTenant(context: RequestContext, tenant: TenantData): void {
  if (context.tenantId !== tenant.config.id) {
    throw new Error("Tenant context mismatch");
  }
}

export function conversationKey(context: RequestContext): string {
  return `${context.tenantId}:${context.conversationId}`;
}
