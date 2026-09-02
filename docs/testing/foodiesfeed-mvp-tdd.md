# FoodiesFeed MVP verification record

This record documents the RED -> GREEN checkpoints used while building the MVP. It is intentionally kept outside `.planning/`, which remains ignored as the assignment planning surface.

## RED checkpoints

- The first foundation checkpoint (`ecfbfc7`) committed the workspace, test runner, and contract tests before the contract/domain implementation existed. The suite failed because the shared schemas and domain modules were not yet present.
- The shared-contract checkpoint (`1c418bf`) then made those tests pass and established the validation, error, query-normalization, and entitlement primitives used by both applications.
- Later API, component, and browser tests were added at each boundary before their implementations were completed. The release-journey RED checkpoint (`c6b8429`) expanded Playwright coverage and proved two remaining failures: horizontal overflow at 320 px and an E2E harness that did not run the production service worker.
- The corresponding GREEN checkpoint (`57866be`) added the narrow mobile layout rules and changed Playwright to build and start the production web application before running. All six browser journeys then passed.

## GREEN evidence

The final local verification commands and results are:

```text
corepack pnpm test:coverage  -> 85 tests passed; 96.13% statements, 89.68% branches, 94.95% functions, 96.13% lines
corepack pnpm test:e2e       -> 6 Playwright tests passed against a production build
corepack pnpm typecheck      -> contracts, API, and web passed
corepack pnpm lint           -> contracts, API, and web passed
corepack pnpm build          -> contracts, Prisma client/API, and Next production build passed
corepack pnpm audit          -> No known vulnerabilities found
```

Coverage excludes only generated Prisma output and thin runtime/framework bootstrap wrappers (`server.ts`, `db/prisma.ts`, and the service-worker registration component). The handwritten API and UI behavior remains included in the global 80% thresholds.

## Boundary coverage

- Search input is validated before the upstream gateway or recent-history write.
- Public search and product DTOs are allowlisted and contain no nutrition fields.
- Open Food Facts calls use explicit fields, locale fallback, numeric-null normalization, timeout/retry, and stable upstream errors.
- Signed demo sessions, origin/content-type checks, recent-search deduplication, retention, and private cache headers are covered.
- Nutrition authorization is tested for every non-active status and active access; authorization runs before the upstream nutrition call.
- Checkout uses only the server Price ID; raw Stripe signature failures, duplicate event delivery, nested event identifiers, mismatched snapshots, and persisted entitlement mapping are covered.
- Locale persistence, missing images, loading/error/empty states, nutrition tables, premium prompts, explicit-submit search, an active-subscriber nutrition journey, 320 px layout, and a real service-worker offline navigation are covered with component tests and browser journeys.

## Environment-limited checks

The workspace has a running MySQL 8.0.42 service, but no project `.env` or usable database credentials have been supplied. Therefore `prisma migrate dev/deploy` and the real seed have not yet been run against it. `prisma generate` and the migration/configuration surface were validated successfully. TiDB Cloud and Stripe are awaiting interactive sign-in; remote migration, webhook registration, deployment, and production smoke testing remain open release gates.
