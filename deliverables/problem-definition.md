# Problem Definition

## Business problem

The client is a mid-sized KSA e-commerce retailer handling approximately 1,200–1,500 support tickets per day while customers wait 8–12 hours for a response. Reported CSAT/NPS declined about 15% in the previous quarter.

The approximate ticket mix is 40% order tracking, 25% returns and refunds, 20% product information, and 15% other requests. The selected POC categories therefore represent about 85% of volume, but that is not an 85% automation claim. Exceptions, disputes, policy review, authentication failures, and unsupported actions still need people.

The reported cart-abandonment change is an unverified hypothesis. The case does not establish that support response time caused it, so conversion impact must be tested in a production pilot rather than claimed by this POC.

## Why the problem is difficult

Customers write in English, Arabic script, Saudi/Gulf dialect, Arabizi, and mixed Arabic-English. Intent and response language must survive neutral inputs such as order identifiers, OTP submission, item selection, and structured confirmation.

The required facts are also fragmented across several authorities:

- catalog and inventory for product claims;
- approved, current tenant knowledge for policy claims;
- customer verification before private order or shipment data;
- deterministic tenant policy for return eligibility;
- explicit capability-based confirmation before a return draft;
- safe human continuation for refunds, cancellations, address changes, disputes, exceptions, and repeated failures.

A language model is valuable for multilingual understanding, entity extraction, follow-ups, and natural grounded replies. It must not become the authority for authentication, tenant selection, policy, or business-system mutation.

## Build-versus-buy rationale

The client trialled Zendesk AI and evaluated Gorgias. A focused custom POC is justified by the Saudi Arabic and Arabizi gap, tenant-specific policy and integration requirements, the self-hosted commerce context, and Lean Scale’s interest in reusable orchestration IP.

That does not justify building a general platform in advance. Vendor capabilities may improve, and a custom system creates engineering, compliance, reliability, and knowledge-governance obligations. The custom path should continue only if a limited pilot shows materially better Saudi-language task completion, safe integration behavior, and acceptable cost against a current vendor baseline on the same cases.

## Bounded POC success criteria

- Give grounded product and requested-variant answers without inventing stock or restock dates.
- List the active tenant’s catalog when a customer asks what is available.
- Keep private order and shipment data unavailable until tenant-scoped OTP verification succeeds.
- Answer general return-policy questions without authentication.
- Initiate delivered-order returns using independent condition facts, deterministic tenant policy, an explicit confirmation token, and idempotent draft creation.
- Never automatically refund, cancel an order, or change an address.
- Support English, Arabic, Saudi/Gulf Arabic, Arabizi, and mixed-language input with correct response direction.
- Use only approved, effective, relevant tenant evidence.
- Prevent overlapping identifiers from crossing tenant boundaries.
- Produce a redacted, actionable handoff when human work is required.
- Pass formatting, lint, typecheck, deterministic unit/integration evaluation, browser E2E, production build, and the tagged live-model acceptance suite.

## What comes next

This is a product-shaped POC, not production SaaS. The next evidence-generating step is a limited KSA pilot with real adapters, secure identity, durable tenant-scoped persistence, rate limits, approved knowledge operations, regional/privacy controls, native Saudi review, and historical outcome measurement. The pilot should compare task completion, policy correctness, handoff quality, response time, cost, CSAT, and agent workload with the existing process and a current vendor baseline.
