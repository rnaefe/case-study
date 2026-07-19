# Limitations and Production Next Steps

## Current limitations

- Conversation state, verification challenges, tickets, and return drafts are in memory and disappear on restart.
- Commerce, shipping, verification, knowledge, helpdesk, and return integrations use synthetic data and mocks.
- There is no production customer authentication, session security, rate limiting, abuse prevention, or secret-management implementation.
- The synthetic OTP flow does not implement production-grade expiry, resend cooldowns, distributed replay prevention, device/session binding, or abuse-rate controls.
- There is no production role-based support access model or durable, tamper-resistant audit trail.
- Tenant isolation is enforced by application context and adapter assertions, not durable storage, database row-level security, infrastructure accounts, or network boundaries.
- Regional hosting, PDPL review, retention/deletion workflows, DPA/no-training terms, encryption operations, and auditable access controls are not implemented.
- Saudi Arabic and Arabizi behavior has controlled test coverage but still needs native Saudi reviewer sign-off.
- Model wording can still vary on edge phrasings; deterministic guards and grounded-draft fallbacks reduce risk but do not eliminate every compositional overstatement.
- Controlled scenarios do not measure production reliability, latency distribution, CSAT/NPS recovery, conversion, deflection, or agent productivity.
- Usage cost shown in the UI is an estimate; production observability should use provider-reported usage.

## Dependency note

`npm run security:audit` uses `--audit-level=high`, so it currently exits cleanly while still reporting moderate transitive PostCSS advisories under Next.js. As of the latest verification, npm reports two moderate findings; that count can change with the dependency tree. npm’s offered force fix is a breaking Next.js downgrade, so it was not applied.

## Production next steps

1. Add real commerce, shipping, helpdesk, OTP, and return adapters with contract and replay tests.
2. Implement secure identity, short-lived authorization, rate limits, abuse controls, and managed secrets.
3. Add durable tenant-scoped storage with encryption, row-level access controls, retention, deletion, and audit logs.
4. Deploy in an approved region after privacy, security, and compliance review.
5. Build governed knowledge approval, publishing, rollback, freshness ownership, and malicious-content testing.
6. Capture end-to-end latency, provider usage/cost, outcomes, handoffs, and failure reasons.
7. Run native Saudi review and a same-case model/vendor bake-off.
8. Pilot behind a percentage rollout with human override, incident handling, and measured business outcomes.
