# Evaluation Report

Last verified: 2026-07-19.

## Test strategy

The suite is deliberately small and assigns each concern to one level:

- `npm test` protects deterministic input, privacy, policy, routing, and OpenAI-adapter boundaries.
- `npm run eval` exercises critical workflows with explicit scripted model results, including an Arabizi tracking + OTP smoke test through the real `/api/chat` route handler.
- `npm run e2e` checks the running UI contract with browser-level HTTP stubs.
- `npm run eval:model` is the only command that calls OpenAI. It checks multilingual understanding, stateful follow-up interpretation, security signals, and grounded composition.

The local suite has no regex-based test NLU, duplicate JSON scenario runner, generated result snapshots, or campaign-specific scripts.

## Current local result

- Unit and boundary tests: 20/20.
- Critical workflow and route-smoke tests: 20/20.
- Browser UI tests: 5/5 PASS.
- Formatting, lint, typecheck, production build, browser E2E, and the configured high/critical dependency audit passed.

These are controlled synthetic checks, not production reliability or deflection measurements.

## Live-model scope

The bounded live registry contains 25 cases. It retains the model-dependent risks:

- missing product identity and catalog discovery;
- product restock follow-up and protected-fact composition;
- unsupported attribute and warranty abstention composition;
- order tracking followed by `Thanks!`;
- return-condition facts;
- refund, payment-dispute priority, OTP-bypass, cross-conversation verification, prompt/tool refusal, cross-tenant, and retrieved-instruction signals;
- compound policy + refund intent preservation;
- explicit-human semantic target versus imperative non-human demands;
- Arabic, Arabizi, mixed-language, and one reserved adversarial regression case.

The runner supports tags such as `security`, `Arabic`, `Arabizi`, and `regression`, runs sequentially, reports provider usage, and commits no raw outputs.

The latest complete bounded run passed 25/25 using `gpt-4o-mini`: 28 requests, 53,411 input tokens, 4,885 output tokens, and an estimated cost of $0.010943.
The targeted `regression` rerun passed 16/16 after the latest safety/coherence hardening.

## Security and policy evidence

The retained local workflows verify:

- no private tracking data before OTP and no OTP value in serialized output;
- verified access reuse after a social acknowledgement, without a second challenge;
- fresh verification for a different order after a previous order was authorized;
- tenant-scoped order, catalog, knowledge, conversation, and handoff boundaries;
- approved and currently effective evidence that also passes the deterministic instruction-content filter;
- claim-aligned evidence after a product → return-policy topic switch;
- server-issued actions and the current confirmation token before a return draft;
- one idempotent return draft and no automatic refund;
- tenant-specific return policy;
- warranty abstention without catalog discovery substitution;
- unsupported care attributes stated as unknown rather than invented facts;
- public policy answer + citation before a refund handoff on compound asks;
- OTP-bypass recovery without first-attempt handoff, even when the model emits a false human signal;
- safe refusal without tickets for prompt/key/raw-tool protected asks;
- payment-dispute reason/urgency/priority/tier ahead of overlapping refund/cancellation/human signals;
- stale capability invalidation, provider/domain error classification, and safe provider failure.

## Non-claims

No test establishes production security certification, compliance, reliability, native Saudi approval, latency distribution, CSAT/NPS improvement, conversion, deflection, or agent productivity. Those require real identity, adapters, durable storage, observability, native review, and a controlled production pilot.
