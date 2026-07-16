import type { RequestContext, VerificationService, VerifiedOrderAccess } from "@/core";
import type { TenantData } from "../tenants";
import { assertTenant } from "./tenant-boundary";

const challenges = new Map<string, { tenantId: string; orderId: string }>();

function challengeKey(context: RequestContext, orderId: string): string {
  return `${context.tenantId}:${context.conversationId}:${orderId}`;
}

export class MockVerificationService implements VerificationService {
  constructor(private readonly tenant: TenantData) {}

  async requestChallenge(context: RequestContext, orderId: string) {
    assertTenant(context, this.tenant);
    const order = this.tenant.orders.find((candidate) => candidate.id === orderId);
    if (!order) return { accepted: false };

    const challengeId = crypto.randomUUID();
    challenges.set(challengeKey(context, orderId), {
      tenantId: context.tenantId,
      orderId
    });
    return { accepted: true, challengeId };
  }

  async verifyChallenge(
    context: RequestContext,
    input: { orderId: string; code: string }
  ): Promise<VerifiedOrderAccess | null> {
    assertTenant(context, this.tenant);
    const key = challengeKey(context, input.orderId);
    const challenge = challenges.get(key);
    if (!challenge || input.code !== "2468") return null;

    const order = this.tenant.orders.find((candidate) => candidate.id === input.orderId);
    if (!order) return null;

    challenges.delete(key);
    return {
      orderId: order.id,
      customerId: order.customerId,
      verifiedAt: new Date().toISOString()
    };
  }
}
