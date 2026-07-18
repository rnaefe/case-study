import type { AuditEvent, SupportTicket, UsageEvent } from "@/core";
import { formatLabel } from "./format-label";
import type { DecisionSnapshot } from "./use-support-conversation";

export function DecisionInspector({
  decision,
  events,
  ticket,
  usage
}: {
  decision?: DecisionSnapshot | undefined;
  events: AuditEvent[];
  ticket?: SupportTicket | undefined;
  usage?: UsageEvent | undefined;
}) {
  return (
    <div className="inspector-body">
      <section className="inspector-card decision-summary">
        <h3>Latest turn</h3>
        {decision ? <DecisionSummary decision={decision} /> : <EmptyDecision />}
      </section>

      {ticket ? <TicketCard ticket={ticket} /> : null}
      {usage ? <UsageCard usage={usage} /> : null}
      <EventList events={events} />

      <div className="audit-footer">
        Operational events only. Hidden model reasoning is never displayed.
      </div>
    </div>
  );
}

function DecisionSummary({ decision }: { decision: DecisionSnapshot }) {
  const intent = decision.activeIntent ?? decision.lastIntent ?? "none";

  return (
    <dl className="inspector-facts">
      <Fact label="Outcome" value={formatLabel(decision.outcome)} />
      <Fact label="Phase" value={formatLabel(decision.phase)} />
      <Fact label="Active intent" value={formatLabel(intent)} />
      {decision.verifiedOrderId ? (
        <Fact label="Verified order" value={decision.verifiedOrderId} />
      ) : null}
      {decision.productId ? <Fact label="Product context" value={decision.productId} /> : null}
      {decision.sources.length ? (
        <Fact label="Sources" value={decision.sources.map((source) => source.label).join(" · ")} />
      ) : null}
    </dl>
  );
}

function EmptyDecision() {
  return (
    <p className="inspector-note">
      Send a message to inspect the model and policy decisions for that turn.
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EventList({ events }: { events: AuditEvent[] }) {
  if (!events.length) {
    return (
      <div className="trace-list">
        <div className="empty-trace">
          <span aria-hidden="true">↗</span>
          <strong>No decisions yet</strong>
          <p>
            Intent, transitions, verification, policy, and tool calls appear here after each turn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trace-list">
      {events.map((entry) => (
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
      ))}
    </div>
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
        <Metric label="Input" value={usage.inputTokens} />
        <Metric label="Output" value={usage.outputTokens} />
        <Metric label="Est. cost" value={`$${(usage.estimatedCostUsd ?? 0).toFixed(6)}`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <p>
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const { payload } = ticket;

  return (
    <section className="ticket-card">
      <div className="ticket-title">
        <span>H</span>
        <strong>HubSpot-shaped ticket (mock)</strong>
        <b>{ticket.id}</b>
      </div>
      <dl>
        <Fact label="Reason" value={formatLabel(payload.reason)} />
        <Fact label="Priority" value={`P${payload.priority} · ${payload.urgency}`} />
        <Fact label="Route" value={formatLabel(payload.recommendedTier)} />
        {payload.orderContext ? <Fact label="Order" value={payload.orderContext.orderId} /> : null}
      </dl>
    </section>
  );
}
