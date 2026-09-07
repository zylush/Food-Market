# Stripe webhook hardening TDD

This evidence report records the payment reliability work completed during the
Stripe audit. The user journeys were derived during the audit; no separate plan
file was supplied.

## User journeys

- As Stripe, I want repeated deliveries to receive a successful response after
  the winning transaction commits, so retries do not create avoidable failures.
- As a subscriber, I want a delayed event from an older subscription to leave my
  newer subscription state unchanged.
- As the application, I want invalid signatures and non-active states to remain
  rejected at the entitlement boundary.

## RED evidence

The new regression tests were run before changing production code:

```text
corepack pnpm exec vitest run apps/api/src/billing.test.ts apps/api/src/db/repository.test.ts
2 failed, 9 passed
```

The failures were the intended reproductions: the older subscription replaced
the newer one, and a simulated Prisma `P2002` conflict escaped as an error.

## GREEN evidence

The fix was verified with the same targets plus the Prisma recovery case:

```text
corepack pnpm exec vitest run apps/api/src/billing.test.ts apps/api/src/db/repository.test.ts
2 test files passed, 13 tests passed
```

| Guarantee | Test | Result |
| --- | --- | --- |
| Older cross-subscription events do not replace newer state | `apps/api/src/billing.test.ts` | PASS |
| Same-event Prisma unique conflicts are acknowledged as duplicates | `apps/api/src/db/repository.test.ts` | PASS |
| Concurrent events racing on the subscription row are recovered | `apps/api/src/db/repository.test.ts` | PASS |
| Stale Prisma events are recorded without an upsert | `apps/api/src/db/repository.test.ts` | PASS |
| Invalid signatures, non-active access, checkout server pricing, and browser payment boundaries remain covered | `apps/api/src/billing.test.ts`, `apps/api/src/app-edge.test.ts`, `apps/web/components/*checkout*.test.tsx`, `apps/web/lib/pwa.test.ts` | PASS |

## Broader verification

- `corepack pnpm test:coverage`: 26 files and 122 tests passed; 96.93%
  statement coverage.
- `corepack pnpm test:e2e`: 17 browser tests passed.
- `corepack pnpm lint`: passed.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm audit`: no known vulnerabilities.
- Deployed API health and same-origin health rewrite returned `200`.
- Deployed unauthenticated checkout returned `401`; a malformed webhook with a
  bogus signature returned `400`.
- A read-only Stripe API check confirmed the configured Price is active,
  recurring monthly, and `livemode: false`; a locally generated signed event was
  accepted by the configured webhook secret.
- `prisma migrate status` reports the schema up to date for both
  `foodiesfeed_dev` and `foodiesfeed_test`.

## Known verification gaps

The real-MySQL suite was not run because its harness invokes
`prisma migrate reset --force`; the repository safety guard requires explicit
user consent before that destructive test-database reset. No guard bypass was
used. A fresh live Stripe Checkout and Dashboard delivery check also remains a
separate operator-controlled test-mode action.

The sandbox lifecycle is documented separately in
`docs/testing/foodiesfeed-mvp-tdd.md`.
