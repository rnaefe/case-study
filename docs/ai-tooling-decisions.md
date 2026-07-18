# AI Tooling Decisions

Each requested activity considers exactly three alternatives. Selection reflects this POC’s short timebox, TypeScript stack, repository-local workflow, multilingual risk, and requirement for human review.

These choices are not a universal or fully objective ranking of tools. For a hiring-case POC the goal was a fast, reviewable prototype, so familiarity and execution speed were deliberate selection factors alongside cost, synergy, and fit. Another engineer with different constraints could reasonably pick differently; the tables below explain _this_ decision path, not a definitive market verdict.

## Requirements gathering

| Option  | Decision and trade-off                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| ChatGPT | Selected for interactive discovery and structured synthesis; assumptions still require human challenge.    |
| Claude  | Rejected for this timebox; strong long-document critique but no material advantage for the supplied brief. |
| Gemini  | Rejected; multimodal and Workspace strengths were not needed for text-only local inputs.                   |

Human boundary: the candidate chooses business priorities, validates assumptions, and sends the final questions.

## User-story identification

| Option  | Decision and trade-off                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------- |
| ChatGPT | Selected to turn discovery context into actors, jobs, acceptance criteria, and edge cases.                |
| Claude  | Rejected as primary; coherent narratives can over-invest in prose instead of executable acceptance rules. |
| Gemini  | Rejected; no connected Google Workspace source material was required.                                     |

Human boundary: the candidate prioritizes tracking, returns, and product information and removes non-goals.

## Test-case development

| Option  | Decision and trade-off                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Codex   | Selected because it can inspect implementation and requirements, write executable tests, and run them. |
| ChatGPT | Rejected as primary; useful for scenario brainstorming but weaker without repository execution.        |
| Claude  | Rejected as primary; useful for critique, but implementation feedback speed mattered more.             |

Human boundary: expected business and security outcomes are reviewed; a generated passing test is not proof by itself.

## Code-development environment

| Option                      | Decision and trade-off                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Codex                       | Selected as the primary environment for repository-wide implementation, terminal verification, and long-running task context.             |
| Cursor                      | Selected for lighter use: sanity checks, manual review passes, and small targeted edits. Not the main implementation driver for this POC. |
| VS Code with GitHub Copilot | Rejected as primary; excellent local completion, but the task required end-to-end refactor ownership beyond inline assistance.            |

Human boundary: the candidate owns architecture, reviews diffs, and remains accountable for product claims. Cursor did not replace that ownership; it supported spot checks and narrow fixes.

## Code review

| Option                     | Decision and trade-off                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Codex (in-repo inspection) | Selected for requirement-aware repository inspection and targeted executable checks, without opening a PR. |
| CodeRabbit                 | Rejected; strongest in hosted PR workflows and can add noise for a local behavioral case.                  |
| GitHub Copilot code review | Rejected; convenient but requires more context to focus on tenant, state, and policy invariants.           |

Human boundary: privacy, security, Arabic claims, and evidence-to-claim alignment receive manual final review.

## Manual testing support

| Option                             | Decision and trade-off                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Human checklist with AI assistance | Selected to keep accountability with the candidate while expanding workflow and visual edge cases.   |
| Model-as-judge                     | Rejected as release authority because calibration and multilingual bias can create false confidence. |
| AI-generated exploratory testing   | Rejected as the only method; rapid adversarial ideas still miss domain-specific customer behavior.   |

Human boundary: only a native Saudi reviewer can approve native dialect quality.

## Automated and E2E testing

| Option     | Decision and trade-off                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Playwright | Selected for deterministic, code-owned browser workflows and CI-friendly traces.                        |
| Mabl       | Rejected because an external low-code platform adds cost and dependency for a compact POC.              |
| Testim     | Rejected because SaaS test management and locator intelligence do not justify reduced portability here. |

Human boundary: responsive layout and visible Arabic behavior still require visual inspection.

## Unit and integration testing

| Option           | Decision and trade-off                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Vitest           | Selected for fast TypeScript/ESM execution and straightforward mocking.                        |
| Jest             | Rejected because it would add configuration without improving this repository’s coverage.      |
| Node test runner | Rejected because fewer dependencies did not outweigh reduced testing ergonomics for reviewers. |

Human boundary: tests are mapped to acceptance and regression classes, not line-count targets.

## Runtime assistant model

| Option                          | Decision and trade-off                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI structured Responses API | Selected for the implemented TypeScript adapter, schema-constrained output, multilingual evaluation, and `store: false`.                             |
| Anthropic Claude                | Rejected for implementation scope; remains a credible production benchmark requiring an equivalent adapter and same-case evaluation.                 |
| Google Gemini                   | Rejected for implementation scope; remains a credible production benchmark but adds another provider contract with no current integration advantage. |

Human boundary: the model never owns tenant context, authentication, policy, confirmation, or tool execution. Provider choice remains provisional until a same-case Saudi Arabic, Arabizi, latency, cost, and safety bake-off.
