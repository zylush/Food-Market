# FoodiesFeed MVP verification record

This record documents the RED -> GREEN checkpoints used while building the MVP. It is intentionally kept outside `.planning/`, which remains ignored as the assignment planning surface.

## RED checkpoints

- The first foundation checkpoint (`ecfbfc7`) committed the workspace, test runner, and contract tests before the contract/domain implementation existed. The suite failed because the shared schemas and domain modules were not yet present.
- The shared-contract checkpoint (`1c418bf`) then made those tests pass and established the validation, error, query-normalization, and entitlement primitives used by both applications.
- Later API, component, and browser tests were added at each boundary before their implementations were completed. The release-journey RED checkpoint (`c6b8429`) expanded Playwright coverage and proved two remaining failures: horizontal overflow at 320 px and an E2E harness that did not run the production service worker.
- The corresponding GREEN checkpoint (`57866be`) added the narrow mobile layout rules and changed Playwright to build and start the production web application before running. All six browser journeys then passed.
- The production-audit cycles preserved additional RED/GREEN pairs for TiDB TLS (`0e7bd64`/`665042a`), self-hosted fonts (`5be5ad9`/`bc086f4`), current Stripe invoice shapes (`cf0f4c1`/`899f63b`), complete test-mode production configuration (`8fc0bee`/`3048343`), Checkout cache exclusion (`b650f97`/`32b734c`), strict production origins (`65b11c7`/`66ea2a9`), malformed JSON mapping (`7a00314`/`aadf633`), the live-discovered Checkout session race (`ccab9ca`/`fd6d601`), raw-body preservation on Vercel (`e6a31ed`/`7bb8f05`), and safe webhook rejection diagnostics (`b367739`/`c86748c`).
- The local release rehearsal found that Prisma CLI loaded `apps/api/.env` but the standalone seed process did not. The deployment-boundary reproducer failed at `d2d7a80`; importing `dotenv/config` before Prisma construction made it GREEN at `73cdd1f` and allowed two consecutive seed runs to succeed.

## GREEN evidence

The final local verification commands and results are:

```text
corepack pnpm test:coverage  -> 102 tests passed; 95.73% statements, 89.72% branches, 93.60% functions, 95.73% lines
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

## Deployment and local-environment evidence

The committed `20260903000000_init` migration was applied to the Frankfurt TiDB Cloud Starter database and the idempotent demo seed was run. SQL inspection confirmed the four application tables, `_prisma_migrations`, one applied migration, and exactly one synthetic demo user.

The operator explicitly authorized the scoped external-resource work with the phrase “approved to generate exactly as scoped”. The `foodiesfeed-api` and `foodiesfeed-web` Vercel projects are live. Direct API health, same-origin rewritten health, the manifest, and all four locale shells return successfully. Vercel deployment inspection confirms the API function is in Frankfurt (`fra1`). Live browser QA covered real Open Food Facts search, public/private response separation, recent-search persistence, locale cookies and document languages, keyboard traversal, and responsive layouts.

The Stripe test product, recurring EUR price, and six-event webhook endpoint are configured. One explicitly approved sandbox Checkout completed successfully. After raw-body preservation was proven, the exposed/mismatched webhook signing secret was rotated, updated in Vercel Production and Preview, and loaded by a successful production redeploy. The three existing sandbox events were resent without creating another Checkout or subscription. Two concurrent deliveries initially returned retryable `500` responses, then succeeded as sequential Stripe retries; Vercel recorded `200` for both retries and Stripe reports zero pending relevant webhooks. The persisted entitlement is `active`, `/api/v1/products/3017620422003/nutrition` returns the exact twelve-field allowlist with `private, no-store`, and the real browser renders the nutrition table without the upgrade prompt.

After explicit approval, the sole test subscription was canceled immediately. Stripe reports one canceled subscription, no active subscriptions, and zero pending relevant webhook deliveries; the cancellation delivery also appears in Vercel production logs as `POST /v1/webhooks/stripe` with status `200`. A fresh demo session then returned persisted status `canceled` with `canViewNutrition: false`, and `/api/v1/products/3017620422003/nutrition` returned `403 SUBSCRIPTION_REQUIRED` with `private, no-store`.

The operator installed the production PWA. Windows application discovery confirmed that FoodiesFeed runs as its own installed Chrome app window, and an interactive standalone journey retried a transient Open Food Facts failure, opened Nutella barcode `3017620422003`, displayed the premium unlock prompt, and did not display a nutrition table. Functional PWA installation and access-state behavior therefore pass; visual-regression comparison remains inconclusive because this repository has no committed screenshot baseline.

Local MySQL 8 is running and all three ignored URLs for development, test, and shadow databases are configured. With explicit approval, a one-time MySQL startup initialization reset only `foodiesfeed@localhost` to the already-stored ignored password and changed it to `caching_sha2_password`; the original option file and Windows service path were restored, the one-time secret-bearing file was removed, and the application account reauthenticated after a normal service restart. `prisma migrate deploy` then applied `20260903000000_init`, two consecutive seed runs succeeded, and direct SQL verification proved the exact five-table set, one completed migration row, exactly one deterministic demo user, and grants limited to the three documented databases.
