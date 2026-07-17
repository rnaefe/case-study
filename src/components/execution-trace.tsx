import type { SupportTicket, TenantConfig, UsageEvent } from "@/core";
import type { SupportConversationController } from "./use-support-conversation";

export function ExecutionTrace({
  tenant,
  conversation
}: {
  tenant: TenantConfig;
  conversation: SupportConversationController;
}) {
  const { auditOpen, events, ticket, usage, workflowPhase, setAuditOpen } = conversation;
  return (
    <>
      {auditOpen ? (
        <button
          className="audit-backdrop"
          aria-label="Dismiss execution trace"
          onClick={() => setAuditOpen(false)}
        />
      ) : null}
      <aside
        className={`audit-panel ${auditOpen ? "open" : ""}`}
        aria-label="Safe execution trace"
        aria-hidden={!auditOpen}
      >
        <div className="panel-heading">
          <div className="trace-title">
            <strong>Safe execution trace</strong>
            <span>Server decisions and approved tool activity</span>
          </div>
          <div className="audit-heading-actions">
            <button
              className="close-audit"
              aria-label="Close execution trace"
              onClick={() => setAuditOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div className="trace-context">
          <span className="tenant-logo">{tenant.branding.logoText}</span>
          <div>
            <strong>{tenant.displayName}</strong>
            <span>{tenant.id} · isolated workspace</span>
          </div>
          <p>
            <span>Current phase</span>
            <strong>{workflowPhase.replaceAll("_", " ")}</strong>
          </p>
        </div>

        {ticket ? <TicketCard ticket={ticket} /> : null}
        {usage ? <UsageCard usage={usage} /> : null}

        <div className="trace-list">
          {!events.length ? (
            <div className="empty-trace">
              <span aria-hidden="true">↗</span>
              <strong>No activity yet</strong>
              <p>
                Send a message to inspect intent, approved sources, transitions, and tool calls.
              </p>
            </div>
          ) : (
            events.map((entry) => (
              <div className="trace-event" key={entry.id}>
                <span className={`trace-dot ${entry.type}`} />
                <div>
                  <strong>{entry.label}</strong>
                  <p>{entry.detail}</p>
                  <time>
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </time>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="audit-footer">
          Operational events only. Hidden reasoning is never displayed.
        </div>
      </aside>
    </>
  );
}

function UsageCard({ usage }: { usage: UsageEvent }) {
  return (
    <section className="metric-card">
      <div>
        <span>MODEL</span>
        <strong>{usage.model}</strong>
      </div>
      <div className="metric-grid">
        <p>
          <span>Input</span>
          <strong>{usage.inputTokens}</strong>
        </p>
        <p>
          <span>Output</span>
          <strong>{usage.outputTokens}</strong>
        </p>
        <p>
          <span>Est. cost</span>
          <strong>${(usage.estimatedCostUsd ?? 0).toFixed(6)}</strong>
        </p>
      </div>
    </section>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  return (
    <section className="ticket-card">
      <div className="ticket-title">
        <span>H</span>
        <strong>HubSpot-shaped ticket (mock)</strong>
        <b>{ticket.id}</b>
      </div>
      <dl>
        <div>
          <dt>Reason</dt>
          <dd>{ticket.payload.reason.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            P{ticket.payload.priority} · {ticket.payload.urgency}
          </dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{ticket.payload.recommendedTier.replaceAll("_", " ")}</dd>
        </div>
        {ticket.payload.orderContext ? (
          <div>
            <dt>Order</dt>
            <dd>{ticket.payload.orderContext.orderId}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
