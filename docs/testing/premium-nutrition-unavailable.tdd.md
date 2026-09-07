# Premium nutrition unavailable state — TDD evidence

## Source plan

No separate plan file was provided. The journey was derived from the reported
production behavior: an active Premium entitlement must not be presented with a
new-subscription prompt when the nutrition provider is temporarily unavailable.

## User journey

As an active Premium user, I want a clear provider-unavailable message instead
of an upgrade prompt, so I understand that my access is valid and can retry
later.

## RED evidence

Added `ProductView` coverage for an upstream timeout and ran:

```text
corepack pnpm exec vitest run apps/web/components/product-view.test.tsx
```

Result: 2 passed, 1 failed. The existing UI showed the product-source error
alongside the misleading `Unlock nutrition` prompt and did not show the active
Premium message.

## GREEN evidence

The minimal implementation renders a dedicated, accessible notice when the
protected nutrition request fails after session bootstrap. The notice keeps the
product facts visible, removes the checkout CTA, and is localized in all four
supported languages.

| Guarantee | Test | Result |
|---|---|---|
| Upstream nutrition failure does not render the upgrade prompt | `apps/web/components/product-view.test.tsx` | PASS |
| Active Premium/unavailable state is visible in a browser journey | `tests/e2e/search.spec.ts` | PASS |
| Existing product, billing, search, and repository behavior remains green | `corepack pnpm test` | 124 tests passed |
| Full browser suite remains green | `corepack pnpm test:e2e` | 18 tests passed |
| TypeScript and build checks pass | `corepack pnpm typecheck`, `corepack pnpm lint` | PASS |
| Coverage remains above the project threshold | `corepack pnpm test:coverage` | 96.84% statements, 89.38% branches |

## Files changed

- `apps/web/components/ProductView.tsx` — render the active-Premium unavailable state.
- `apps/web/components/product-view.test.tsx` — unit regression coverage.
- `apps/web/i18n/dictionaries.ts` — localized notice copy.
- `apps/web/app/globals.css` — flat themed notice styling.
- `tests/e2e/search.spec.ts` — browser regression coverage.

## Known gap

The change is implemented and verified locally but has not been pushed or
deployed in this task. Stripe Test mode was separately verified with zero active
subscriptions for the demo account after the authorized test transaction was
canceled.
