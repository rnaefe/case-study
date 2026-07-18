# Evaluation Report

Last verified: 2026-07-18.

## Test strategy

The suite is deliberately small and assigns each concern to one level:

- `npm test` protects deterministic input, privacy, policy, routing, and OpenAI-adapter boundaries.
- `npm run eval` exercises critical workflows with explicit scripted model results, including an Arabizi tracking + OTP smoke test through the real `/api/chat` route handler.
- `npm run e2e` checks the running UI contract with browser-level HTTP stubs.
- `npm run eval:model` is the only command that calls OpenAI. It checks multilingual understanding, stateful follow-up interpretation, security signals, and grounded composition.

The local suite has no regex-based test NLU, duplicate JSON scenario runner, generated result snapshots, or campaign-specific scripts.

## Current local result

- Unit and boundary tests: 17/17.
- Critical workflow and route-smoke tests: 11/11.
- Browser UI tests: 4/4.
- Formatting, lint, typecheck, production build, and high/critical dependency audit are part of `npm run verify` or `npm run security:audit`.

These are controlled synthetic checks, not production reliability or deflection measurements.

## Live-model scope

The bounded live registry contains 16 cases rather than a broad campaign. It retains the model-dependent risks:

- missing product identity and catalog discovery;
- product restock follow-up and protected-fact composition;
- order tracking followed by `Thanks!`;
- return-condition facts;
- refund, OTP-bypass, cross-tenant, and retrieved-instruction signals;
- Arabic, Arabizi, mixed-language, and one holdout case.

The runner supports tags such as `security`, `Arabic`, `Arabizi`, and `holdout`, runs sequentially, reports provider usage, and commits no raw outputs.

The latest complete bounded run passed 16/16 using `gpt-4o-mini`: 17 requests, 30,223 input tokens, 2,819 output tokens, and an estimated cost of $0.006225.
After requiring an explicit Arabic product reference, the targeted `Arabic` rerun passed 1/1.

## Security and policy evidence

The retained local workflows verify:

- no private tracking data before OTP and no OTP value in serialized output;
- verified access reuse after a social acknowledgement, without a second challenge;
- tenant-scoped order, catalog, knowledge, conversation, and handoff boundaries;
- approved and currently effective evidence that also passes the deterministic instruction-content filter;
- server-issued actions and the current confirmation token before a return draft;
- one idempotent return draft and no automatic refund;
- tenant-specific return policy;
- OTP-bypass refusal, stale capability invalidation, provider/domain error classification, and safe provider failure.

Historical blind security testing recorded 28 PASS, 1 PARTIAL, and 1 FAIL across 30 cases, with zero unauthorized disclosure and zero unauthorized transaction. The holdout result was not rewritten after remediation; the failed state class was corrected and verified separately.

## Non-claims

No test establishes production security certification, compliance, reliability, native Saudi approval, latency distribution, CSAT/NPS improvement, conversion, deflection, or agent productivity. Those require real identity, adapters, durable storage, observability, native review, and a controlled production pilot.
