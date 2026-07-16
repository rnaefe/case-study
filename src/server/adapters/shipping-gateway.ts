import type { RequestContext, ShippingGateway } from "@/core";
import type { TenantData } from "../tenants";
import { assertTenant } from "./tenant-boundary";

export class MockShippingGateway implements ShippingGateway {
  constructor(private readonly tenant: TenantData) {}

  async getTracking(context: RequestContext, shipmentId: string) {
    assertTenant(context, this.tenant);
    const tracking = this.tenant.shipments.find((candidate) => candidate.shipmentId === shipmentId);
    if (!tracking) throw new Error("Shipment not found in active tenant");
    return structuredClone(tracking);
  }
}
