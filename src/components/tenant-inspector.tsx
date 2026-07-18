import type { ReactNode } from "react";
import type { TenantWorkspaceProfile } from "@/server/tenant-workspace";
import { formatLabel } from "./format-label";

export function TenantInspector({
  config,
  returnPolicy,
  products,
  orders,
  knowledge
}: TenantWorkspaceProfile) {
  return (
    <div className="inspector-body">
      <section className="inspector-card">
        <div className="inspector-card-head">
          <span className="tenant-logo">{config.branding.logoText}</span>
          <div>
            <strong>{config.displayName}</strong>
            <span>{config.id}</span>
          </div>
        </div>
        <dl className="inspector-facts">
          <Fact label="Policy profile" value={config.policyProfile} />
          <Fact label="Knowledge" value={config.knowledgeNamespace} />
          <Fact label="AI" value={`${config.ai.provider} · ${config.ai.model}`} />
        </dl>
      </section>

      <section className="inspector-card">
        <h3>Enabled capabilities</h3>
        <ChipList values={config.enabledIntents.map(formatLabel)} />
        <h3>Locales</h3>
        <ChipList values={config.supportedLocales} />
      </section>

      <section className="inspector-card">
        <h3>Return policy</h3>
        <dl className="inspector-facts">
          <Fact label="Window" value={`${returnPolicy.returnWindowDays} days`} />
          <Fact
            label="Final sale"
            value={returnPolicy.finalSaleExcluded ? "Excluded" : "Allowed"}
          />
          <Fact
            label="Opened items"
            value={returnPolicy.openedItemsRequireReview ? "CX review" : "Self-serve"}
          />
          <Fact
            label="Damaged items"
            value={returnPolicy.damagedItemsRequireReview ? "CX review" : "Self-serve"}
          />
        </dl>
        <ul className="policy-conditions">
          {returnPolicy.conditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </section>

      <section className="inspector-card">
        <h3>Registered data</h3>
        <div className="metric-grid inspector-metrics">
          <Metric label="Products" value={products.length} />
          <Metric label="Orders" value={orders.length} />
          <Metric label="Approved docs" value={knowledge.length} />
        </div>
        <p className="inspector-note">
          Responses are grounded against these tenant-scoped records.
        </p>
      </section>

      <RecordSection title="Catalog and stock">
        {products.map((product) => (
          <article key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>
                {product.id} · SAR {product.priceSar}
              </span>
            </div>
            <p>
              {product.variants
                .map(({ label, stock }) => `${label}: ${stock} in stock`)
                .join(" · ")}
            </p>
          </article>
        ))}
      </RecordSection>

      <RecordSection title="Demo orders">
        {orders.map((order) => (
          <article key={order.id}>
            <div>
              <strong>{order.id}</strong>
              <span>{order.status}</span>
            </div>
            <p>{order.items.join(" · ")}</p>
          </article>
        ))}
      </RecordSection>

      <RecordSection title="Approved knowledge">
        {knowledge.map((document) => (
          <article className="knowledge-record" key={document.id}>
            <details>
              <summary>
                <span className="knowledge-record-heading">
                  <strong>{document.title}</strong>
                  <span>
                    {document.category} · {document.locale} · v{document.version}
                  </span>
                </span>
                <span className="knowledge-record-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="knowledge-record-detail">
                <p dir={document.locale === "ar" ? "rtl" : "ltr"}>{document.content}</p>
                <dl>
                  <div>
                    <dt>Owner</dt>
                    <dd>{document.owner}</dd>
                  </div>
                  <div>
                    <dt>Effective from</dt>
                    <dd>
                      <time dateTime={document.effectiveFrom}>
                        {document.effectiveFrom.slice(0, 10)}
                      </time>
                    </dd>
                  </div>
                  {document.effectiveUntil ? (
                    <div>
                      <dt>Effective until</dt>
                      <dd>
                        <time dateTime={document.effectiveUntil}>
                          {document.effectiveUntil.slice(0, 10)}
                        </time>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </details>
          </article>
        ))}
      </RecordSection>
    </div>
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

function ChipList({ values }: { values: readonly string[] }) {
  return (
    <div className="capability-chips">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function RecordSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-card">
      <h3>{title}</h3>
      <div className="record-list">{children}</div>
    </section>
  );
}
