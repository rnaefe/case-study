import type { TenantConfig } from "@/core";

export function SupportHeader({
  tenant,
  tenants,
  modelConfigured,
  onTenantChange
}: {
  tenant: TenantConfig;
  tenants: TenantConfig[];
  modelConfigured: boolean;
  onTenantChange: (tenantId: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand" aria-label="Lean Scale Support Assistant">
          <span className="brand-mark" aria-hidden="true">
            LS
          </span>
          <div>
            <strong>Support Assistant</strong>
            <span>Lean Scale commerce operations</span>
          </div>
        </div>
        <div className="top-actions">
          <span className={`model-status ${modelConfigured ? "" : "offline"}`}>
            <i />
            {modelConfigured ? "AI ready" : "AI not configured"}
          </span>
          <label className="tenant-control">
            <span>Workspace</span>
            <select
              aria-label="Select tenant"
              value={tenant.id}
              onChange={(event) => onTenantChange(event.target.value)}
            >
              {tenants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
