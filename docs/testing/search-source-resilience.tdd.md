# Search-source resilience TDD evidence

## Source plan

This record covers the user-approved Search-source resilience patch. It keeps the current Open Food Facts adapter and adds bounded retry behavior, safe diagnostics, accurate failure states, and a deferred cache/provider decision.

## User journeys

- As a searcher, I can tell a source timeout, source outage, rate limit, and my own browser-network problem apart so I know what to retry.
- As a rate-limited searcher, I see the source-provided wait window and cannot submit a retry before it expires.
- As an operator, I can diagnose a final provider failure from one safe structured log line without exposing a query, URL, payload, cookie, header, or raw exception.
- As a local evaluator, I can use the environment template for a basic localhost preview without setting up MySQL or Stripe first.

## RED and GREEN

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED — contract, gateway, API client, and API boundary | `corepack pnpm exec vitest run packages/contracts/src/index.test.ts apps/api/src/integrations/open-food-facts.test.ts apps/api/src/app.test.ts apps/web/features/api.test.ts apps/web/components/foodiesfeed-home.test.tsx` | FAIL | The new timeout code was absent; the gateway did not wait between attempts or attach safe context; the client classified browser failures as source failures; and the API did not forward `Retry-After`. |
| RED — component states | `corepack pnpm exec vitest run apps/web/components/foodiesfeed-home.test.tsx --reporter=verbose` | FAIL | 3 new tests failed: timeout used the generic error, browser network was shown as a source outage, and the rate-limit retry remained enabled. |
| GREEN — focused behavior | `corepack pnpm exec vitest run packages/contracts/src/index.test.ts apps/api/src/integrations/open-food-facts.test.ts apps/api/src/app.test.ts apps/web/features/api.test.ts apps/web/components/foodiesfeed-home.test.tsx` | PASS | 46 tests passed across five targeted files. |
| GREEN — gateway/API follow-up | `corepack pnpm exec vitest run apps/api/src/integrations/open-food-facts.test.ts apps/api/src/app.test.ts` | PASS | 28 tests passed after resolving strict optional-property typing for safe log metadata. |

## Test specification

| # | What is guaranteed | Test file or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | A product-source timeout is a public `UPSTREAM_TIMEOUT` outcome with HTTP `504`. | `packages/contracts/src/index.test.ts`, `apps/api/src/integrations/open-food-facts.test.ts` | contract/unit | PASS |
| 2 | Only network, timeout, and `5xx` failures receive one 250–499 ms jittered retry; `429` and other `4xx` do not. | `apps/api/src/integrations/open-food-facts.test.ts` | unit | PASS |
| 3 | A valid source `Retry-After` is retained for a rate-limit response and the final source error carries only safe context. | `apps/api/src/integrations/open-food-facts.test.ts` | unit | PASS |
| 4 | Express forwards `Retry-After`, keeps the public error envelope small, and emits exactly one structured log without the submitted query. | `apps/api/src/app.test.ts` | integration | PASS |
| 5 | Browser fetch failure becomes client-only `NETWORK_UNAVAILABLE`; source timeouts and outages get distinct localized states. | `apps/web/features/api.test.ts`, `apps/web/components/foodiesfeed-home.test.tsx` | client/component | PASS |
| 6 | The source-unavailable state is rendered in English, Dutch, German, and French, and rate-limit retry is disabled until its countdown expires. | `apps/web/components/foodiesfeed-home.test.tsx` | component | PASS |
| 7 | Production-browser flows cover source outage, source timeout, browser-network failure, and the rate-limit countdown without live API dependencies. | `tests/e2e/search.spec.ts`, `corepack pnpm test:e2e` | E2E | PASS |

## Full verification

| Command | Result |
| --- | --- |
| `corepack pnpm test:coverage` | PASS — 26 files / 118 tests; 96.75% statements, 90.01% branches, 94.85% functions, and 96.75% lines. |
| `corepack pnpm lint` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm build` | PASS — contracts, API, and Next.js production build completed. |
| `corepack pnpm test:e2e` | PASS — 15 Chromium journeys. |
| `corepack pnpm audit` | PASS — no known vulnerabilities. |

## Checkpoint evidence

- RED: `b1a645d test: cover search source resilience`
- GREEN: `29b83e1 fix: harden product source failures`
- Refinement: `3774f99 refactor: tighten source failure metadata`

## Known gaps and deferred work

The suite intentionally uses injected/mock Open Food Facts boundaries and does not depend on provider availability. Persistent stale-result caching, provider replacement, database migration, and deployment changes remain deferred. The README defines the trigger for revisiting them: recurring provider outages or rate-limit incidents.
