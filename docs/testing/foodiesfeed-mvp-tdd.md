# FoodiesFeed MVP verification record

This record documents the RED -> GREEN checkpoints used while building the MVP. It is intentionally kept outside `.planning/`, which remains ignored as the assignment planning surface.

## RED checkpoints

- The first foundation checkpoint (`ecfbfc7`) committed the workspace, test runner, and contract tests before the contract/domain implementation existed. The suite failed because the shared schemas and domain modules were not yet present.
- The shared-contract checkpoint (`1c418bf`) then made those tests pass and established the validation, error, query-normalization, and entitlement primitives used by both applications.
- Later API, component, and browser tests were added at each boundary before their implementations were completed. The final suite contains 85 unit, component, and API tests plus two Playwright journeys.

## GREEN evidence

The final local verification commands and results are:

```text
corepack pnpm test:coverage  -> 85 tests passed; 96.13% statements, 89.68% branches, 94.95% functions, 96.13% lines
corepack pnpm test:e2e       -> 2 Playwright tests passed
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
- Locale persistence, missing images, loading/error/empty states, nutrition tables, premium prompts, static PWA shell behavior, and explicit-submit search are covered with component tests and browser journeys.

## Environment-limited checks

The workspace did not have a running local MySQL server, and Docker Desktop's Linux engine was unavailable. Therefore `prisma migrate dev/deploy` and the real seed were not run against a database in this session. `prisma generate` and the migration/configuration surface were validated successfully. Vercel, TiDB Cloud, Stripe account setup, remote migration, webhook registration, and production smoke testing remain operator-authenticated deployment gates.
