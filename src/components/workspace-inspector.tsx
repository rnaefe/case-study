"use client";

import { DecisionInspector } from "./decision-inspector";
import { TenantInspector } from "./tenant-inspector";
import type { TenantWorkspaceProfile } from "@/server/tenant-workspace";
import type { SupportConversationController } from "./use-support-conversation";

export function WorkspaceInspector({
  profile,
  conversation
}: {
  profile: TenantWorkspaceProfile;
  conversation: SupportConversationController;
}) {
  const {
    inspectorOpen,
    decision,
    events,
    inspectorTab,
    ticket,
    usage,
    closeInspector,
    selectInspectorTab
  } = conversation;

  return (
    <>
      {inspectorOpen ? (
        <button
          className="audit-backdrop"
          aria-label="Dismiss workspace inspector"
          onClick={closeInspector}
        />
      ) : null}
      <aside
        className={`audit-panel ${inspectorOpen ? "open" : ""}`}
        aria-label="Workspace inspector"
        {...(!inspectorOpen ? { inert: true } : {})}
      >
        <div className="panel-heading">
          <div className="trace-title">
            <strong>Workspace inspector</strong>
            <span>Tenant capabilities and AI or server decisions</span>
          </div>
          <div className="audit-heading-actions">
            <button
              className="close-audit"
              aria-label="Close workspace inspector"
              onClick={closeInspector}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
          <button
            type="button"
            role="tab"
            aria-selected={inspectorTab === "tenant"}
            className={inspectorTab === "tenant" ? "active" : ""}
            onClick={() => selectInspectorTab("tenant")}
          >
            Tenant
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inspectorTab === "decisions"}
            className={inspectorTab === "decisions" ? "active" : ""}
            onClick={() => selectInspectorTab("decisions")}
          >
            Decisions
            {events.length ? <b>{Math.min(events.length, 99)}</b> : null}
          </button>
        </div>

        {inspectorTab === "tenant" ? (
          <TenantInspector {...profile} />
        ) : (
          <DecisionInspector
            {...(decision ? { decision } : {})}
            events={events}
            {...(ticket ? { ticket } : {})}
            {...(usage ? { usage } : {})}
          />
        )}
      </aside>
    </>
  );
}
