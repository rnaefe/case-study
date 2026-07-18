import type { ReturnPolicy, TenantConfig } from "@/core";
import type { TenantData } from "./tenants";

export type TenantWorkspaceProfile = {
  config: TenantConfig;
  returnPolicy: ReturnPolicy;
  products: Array<{
    id: string;
    name: string;
    priceSar: number;
    variants: Array<{ label: string; stock: number }>;
  }>;
  orders: Array<{
    id: string;
    status: string;
    items: string[];
  }>;
  knowledge: Array<{
    id: string;
    title: string;
    category: string;
    locale: string;
    version: number;
    content: string;
    owner: string;
    effectiveFrom: string;
    effectiveUntil?: string;
  }>;
};

export function toTenantWorkspaceProfile(tenant: TenantData): TenantWorkspaceProfile {
  return {
    config: tenant.config,
    returnPolicy: tenant.returnPolicy,
    products: tenant.products.map((product) => ({
      id: product.id,
      name: product.name,
      priceSar: product.priceSar,
      variants: product.variants.map(({ label, stock }) => ({ label, stock }))
    })),
    orders: tenant.orders.map((order) => ({
      id: order.id,
      status: order.status,
      items: order.items.map((item) => item.name)
    })),
    knowledge: tenant.knowledge
      .filter((doc) => doc.tenantId === tenant.config.id && doc.status === "approved")
      .map(
        ({
          id,
          title,
          category,
          locale,
          version,
          content,
          owner,
          effectiveFrom,
          effectiveUntil
        }) => ({
          id,
          title,
          category,
          locale,
          version,
          content,
          owner,
          effectiveFrom,
          ...(effectiveUntil ? { effectiveUntil } : {})
        })
      )
  };
}
