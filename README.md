# Lean Scale Arabic-First Support POC

This hiring-case POC proves that a single Next.js application can combine natural English, Arabic, Saudi/Gulf Arabic, Arabizi, and mixed-language support with deterministic tenant, authorization, policy, and transaction controls.

The model interprets language and composes grounded replies. Application code owns tenant context, OTP, private-order access, return policy, confirmation tokens, idempotency, eligible citations, handoff routing, redaction, and tool execution. It never automatically refunds, cancels an order, or changes an address.

## Quick start

Requirements: Node.js 22+ and npm 10+.

```bash
npm ci
```

Create `.env.local` with environment variable names from `.env.example`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`. The runtime uses an OpenAI model via the structured Responses API; without `OPENAI_API_KEY`, chat requests return a controlled 503.

Then run:

```bash
npm run dev
```

Open:

- `http://localhost:3000/t/ksa-fashion`
- `http://localhost:3000/t/ksa-electronics`

All demo data is synthetic. The demo OTP is `2468`. Useful order IDs are `ORD-1001` for tracking and `ORD-2002` for a delivered fashion return.

## Docker

Build the production image:

```bash
docker build -t lean-scale-support-poc .
```

Pass OpenAI configuration only when the container starts:

```bash
docker run --rm -p 3000:3000 --env-file .env.local lean-scale-support-poc
```

The container runs as a non-root user and serves the standalone Next.js build at `http://localhost:3000`.

## Main commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run eval
npm run e2e
npm run build
npm run verify
npm run security:audit
```

Those commands do not call OpenAI. The live-model acceptance suite is explicit:

```bash
npm run eval:model
npm run eval:model -- --tag security
npm run eval:model -- --tag Arabic
npm run eval:model -- --tag Arabizi
npm run eval:model -- --tag regression
```

## Architecture map

```text
src/app + src/components
  -> src/core/orchestrator.ts
  -> src/core/orchestration/chat-router.ts
  -> server-validated action dispatcher or message selector
  -> src/core/workflows/*
  -> src/core domain rules + typed ports
  -> src/server adapters and runtime composition

tests/
  integration/  deterministic workflows plus real API-route smoke coverage
  e2e/          critical running-UI paths
  model/        tagged live OpenAI understanding + grounded composition suite
```

`src/core` imports no Next.js, React, OpenAI SDK, tenant fixtures, or concrete adapters. Every message goes to the semantic model before business workflow selection; deterministic code then enforces security, authorization, policy, evidence selection, and actions. Understanding is split into schema, prompt, and normalization so coherence checks can coerce false human signals, reinforce bypass/dispute/safety categories, and preserve compound policy+action intents. Client action requests are accepted only when the server's current conversation state permits them, and return confirmation additionally requires the current capability token. Conversation writes are centralized in `src/core/conversation/transitions.ts`; the main orchestrator only coordinates load, route, audit, persistence, and response construction.

See [architecture](docs/architecture.md) for ownership and trust boundaries.

## Repository documentation

- [Architecture](docs/architecture.md)
- [Evaluation report](docs/evaluation-report.md)
- [Limitations](docs/limitations.md)

Product deliverables (problem definition, solution design, demo script, and AI tooling decisions) are submitted separately and are not tracked in this repository.

## Limitations

State and integrations are in-memory mocks; production identity, database isolation, rate limiting, regional controls, durable observability, and compliance implementation are out of scope. Arabic quality still needs native Saudi review, and production deflection, CSAT, latency, conversion, and agent-productivity outcomes were not measured.
