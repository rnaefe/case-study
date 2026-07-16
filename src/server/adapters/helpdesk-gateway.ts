import type { HandoffPayload, HelpdeskGateway, RequestContext, SupportTicket } from "@/core";
import type { TenantData } from "../tenants";
import { assertTenant } from "./tenant-boundary";

const tickets = new Map<string, SupportTicket>();

export class MockHelpdeskGateway implements HelpdeskGateway {
  constructor(private readonly tenant: TenantData) {}

  async createHandoff(context: RequestContext, payload: HandoffPayload) {
    assertTenant(context, this.tenant);
    const existing = Array.from(tickets.values()).find(
      (ticket) =>
        ticket.payload.tenantId === context.tenantId &&
        ticket.payload.conversationId === context.conversationId &&
        ticket.payload.reason === payload.reason
    );
    if (existing) return structuredClone(existing);

    const ticket: SupportTicket = {
      id: `HS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      payload,
      createdAt: new Date().toISOString()
    };
    tickets.set(`${context.tenantId}:${ticket.id}`, ticket);
    return structuredClone(ticket);
  }
}
