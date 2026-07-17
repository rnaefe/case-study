"use client";

import type { TenantConfig } from "@/core";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ConversationPanel } from "./conversation-panel";
import { ExecutionTrace } from "./execution-trace";
import { SupportHeader } from "./support-header";
import { useSupportConversation } from "./use-support-conversation";

export function SupportConsole({
  tenant,
  tenants,
  modelConfigured
}: {
  tenant: TenantConfig;
  tenants: TenantConfig[];
  modelConfigured: boolean;
}) {
  const router = useRouter();
  const conversation = useSupportConversation(tenant.id);
  const accentStyle = useMemo(
    () =>
      ({
        "--accent": tenant.branding.accent,
        "--accent-soft": tenant.branding.accentSoft
      }) as React.CSSProperties,
    [tenant]
  );

  return (
    <main className="app-shell" style={accentStyle}>
      <SupportHeader
        tenant={tenant}
        tenants={tenants}
        modelConfigured={modelConfigured}
        onTenantChange={(tenantId) => router.push(`/t/${tenantId}`)}
      />
      <div className="workspace">
        <ConversationPanel tenant={tenant} conversation={conversation} />
        <ExecutionTrace tenant={tenant} conversation={conversation} />
      </div>
    </main>
  );
}
