"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TenantWorkspaceProfile } from "@/server/tenant-workspace";
import { ConversationPanel } from "./conversation-panel";
import { SupportHeader } from "./support-header";
import { useSupportConversation } from "./use-support-conversation";
import { WorkspaceInspector } from "./workspace-inspector";

export function SupportConsole({
  profile,
  tenants,
  modelConfigured
}: {
  profile: TenantWorkspaceProfile;
  tenants: TenantWorkspaceProfile["config"][];
  modelConfigured: boolean;
}) {
  const router = useRouter();
  const tenant = profile.config;
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
        <WorkspaceInspector profile={profile} conversation={conversation} />
      </div>
    </main>
  );
}
