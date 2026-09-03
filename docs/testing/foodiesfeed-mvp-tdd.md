# FoodiesFeed MVP verification record

This record documents the RED -> GREEN checkpoints used while building the MVP. It is intentionally kept outside `.planning/`, which remains ignored as the assignment planning surface.

## RED checkpoints

- The first foundation checkpoint (`ecfbfc7`) committed the workspace, test runner, and contract tests before the contract/domain implementation existed. The suite failed because the shared schemas and domain modules were not yet present.
- The shared-contract checkpoint (`1c418bf`) then made those tests pass and established the validation, error, query-normalization, and entitlement primitives used by both applications.
- Later API, component, and browser tests were added at each boundary before their implementations were completed. The release-journey RED checkpoint (`c6b8429`) expanded Playwright coverage and proved two remaining failures: horizontal overflow at 320 px and an E2E harness that did not run the production service worker.
- The corresponding GREEN checkpoint (`57866be`) added the narrow mobile layout rules and changed Playwright to build and start the production web application before running. All six browser journeys then passed.
- The production-audit cycles preserved additional RED/GREEN pairs for TiDB TLS (`0e7bd64`/`665042a`), self-hosted fonts (`5be5ad9`/`bc086f4`), current Stripe invoice shapes (`cf0f4c1`/`899f63b`), complete test-mode production configuration (`8fc0bee`/`3048343`), Checkout cache exclusion (`b650f97`/`32b734c`), strict production origins (`65b11c7`/`66ea2a9`), malformed JSON mapping (`7a00314`/`aadf633`), and the live-discovered Checkout session race (`ccab9ca`/`fd6d601`).

## GREEN evidence

The final local verification commands and results are:

```text
corepack pnpm test:coverage  -> 100 tests passed; 95.72% statements, 89.70% branches, 93.60% functions, 95.72% lines
corepack pnpm test:e2e       -> 8 Playwright tests passed against a production build
corepack pnpm typecheck      -> contracts, API, and web passed
corepack pnpm lint           -> contracts, API, and web passed
corepack pnpm build          -> contracts, Prisma client/API, and Next production build passed
corepack pnpm audit          -> No known vulnerabilities found
```

Coverage excludes only generated Prisma output and thin runtime/framework bootstrap wrappers (`server.ts` and the service-worker registration component). Shared contracts and the handwritten TiDB URL/TLS adapter are included in the global 80% thresholds.

## Boundary coverage

- Search input is validated before the upstream gateway or recent-history write.
- Public search and product DTOs are allowlisted and contain no nutrition fields.
- Open Food Facts calls use explicit fields, locale fallback, numeric-null normalization, timeout/retry, and stable upstream errors.
- Signed demo sessions, strict production origin/content-type checks, malformed JSON, recent-search deduplication, retention, and private cache headers are covered.
- Nutrition authorization is tested for every non-active status and active access; authorization runs before the upstream nutrition call.
- Checkout bootstraps its own session before requesting billing and uses only the server Price ID; raw Stripe signature failures, duplicate and out-of-order event delivery, current nested invoice identifiers, mismatched snapshots, and persisted entitlement mapping are covered.
- Locale persistence, missing images, loading/error/empty states, nutrition tables, premium prompts, explicit-submit search, an active-subscriber nutrition journey, actual self-hosted fonts, 320 px layout, a real service-worker offline navigation, and Checkout cache exclusion are covered with component tests and browser journeys.

## Deployment evidence and remaining interactive check

The committed `20260903000000_init` migration was applied to the Frankfurt TiDB Cloud Starter database and the idempotent demo seed was run. SQL inspection confirmed the four application tables, `_prisma_migrations`, one applied migration, and exactly one synthetic demo user. Local MySQL 8 development/test/shadow setup remains documented and intentionally deferred until the operator requests the local walkthrough.

The `foodiesfeed-api` and `foodiesfeed-web` Vercel projects are live. Direct API health, same-origin rewritten health, the manifest, and all four locale shells return successfully; the API response identifies the Frankfurt `fra1` region. Live browser QA covered real Open Food Facts search, public/private response separation, recent-search persistence, locale cookies and document languages, keyboard traversal, and responsive layouts. The Stripe test product, recurring EUR price, and six-event webhook endpoint are configured. The final test-mode Checkout, active-entitlement/nutrition verification, and subsequent test-subscription cancellation remain intentionally unclaimed until the operator explicitly approves the payment step.
