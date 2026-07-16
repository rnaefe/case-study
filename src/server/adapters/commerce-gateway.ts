import type { CommerceGateway, RequestContext, ReturnDraft, VerifiedOrderAccess } from "@/core";
import type { TenantData } from "../tenants";
import { assertTenant } from "./tenant-boundary";

const returnDrafts = new Map<string, ReturnDraft>();

export class MockCommerceGateway implements CommerceGateway {
  constructor(private readonly tenant: TenantData) {}

  async listProducts(context: RequestContext) {
    assertTenant(context, this.tenant);
    return structuredClone(this.tenant.products);
  }

  async searchProducts(context: RequestContext, query: string) {
    assertTenant(context, this.tenant);
    const normalized = query.toLowerCase();
    const genericTags = new Set(["size", "مقاس"]);
    const matched = this.tenant.products.filter((product) => {
      const identifyingTerms = [
        product.id,
        product.name,
        product.nameAr,
        ...product.tags.filter((tag) => !genericTags.has(tag.toLowerCase()))
      ];
      return identifyingTerms.some((term) => normalized.includes(term.toLowerCase()));
    });
    return structuredClone(matched);
  }

  async getAuthorizedOrder(context: RequestContext, access: VerifiedOrderAccess) {
    assertTenant(context, this.tenant);
    const order = this.tenant.orders.find(
      (candidate) => candidate.id === access.orderId && candidate.customerId === access.customerId
    );
    if (!order) throw new Error("Authorized order not found in active tenant");
    return structuredClone(order);
  }

  async createReturnDraft(
    context: RequestContext,
    input: {
      orderId: string;
      customerId: string;
      itemIds: string[];
      reason: string;
      confirmationToken: string;
      idempotencyKey: string;
    }
  ) {
    assertTenant(context, this.tenant);
    const existing = returnDrafts.get(input.idempotencyKey);
    if (existing) return structuredClone(existing);
    if (!input.confirmationToken) throw new Error("Explicit confirmation token required");

    const order = this.tenant.orders.find(
      (candidate) => candidate.id === input.orderId && candidate.customerId === input.customerId
    );
    if (!order || !input.itemIds.every((id) => order.items.some((item) => item.id === id))) {
      throw new Error("Return item does not belong to the tenant-scoped order");
    }

    const draft: ReturnDraft = {
      id: `RMA-${String(returnDrafts.size + 1).padStart(4, "0")}`,
      orderId: input.orderId,
      itemIds: input.itemIds,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    returnDrafts.set(input.idempotencyKey, draft);
    return structuredClone(draft);
  }
}
