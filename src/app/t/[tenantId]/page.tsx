import { notFound } from "next/navigation";
import { SupportConsole } from "@/components/support-console";
import { isModelConfigured } from "@/server/openai-config";
import { getTenantData, listTenants } from "@/server/tenants";
import { toTenantWorkspaceProfile } from "@/server/tenant-workspace";

export default async function TenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = getTenantData(tenantId);
  if (!tenant) notFound();
  return (
    <SupportConsole
      key={tenant.config.id}
      profile={toTenantWorkspaceProfile(tenant)}
      tenants={listTenants()}
      modelConfigured={isModelConfigured()}
    />
  );
}
