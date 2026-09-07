# Subscription management and product-page search TDD record

## Acceptance criteria

- An active entitlement on the homepage must not render the upgrade action.
- An active subscriber must have a clear, confirmed cancel-at-period-end action.
- Cancelling must preserve nutrition access through the paid period and show the scheduled state.
- If entitlement lookup fails, the homepage must not guess that the visitor is free.
- The product page must expose a responsive search form that submits to the localized home search route.
- Technical decisions and the new API boundary must be documented separately from database decisions.

## RED

Added failing coverage for the Stripe cancellation adapter and API route, the active/free/unknown homepage states, the confirmation interaction, the product-page search form, and the browser journey.

## GREEN

- `apps/api/src/integrations/stripe.ts` calls Stripe `subscriptions.update` with `cancel_at_period_end: true`.
- `POST /v1/billing/cancel` authenticates the signed demo session, uses the stored subscription ID, validates the returned customer/subscription identifiers, and returns the verified entitlement.
- `PremiumAccess` waits for entitlement confirmation, hides the upgrade prompt for active access, and exposes an accessible inline confirmation before cancellation.
- `ProductSearchBar` uses a native GET form with `q`; the home route accepts `q` and preserves the existing `recent` parameter.

## Verification

- `corepack pnpm test` — 129 tests passed.
- `corepack pnpm test:coverage` — 96.64% statements, 88.57% branches.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed.
- `corepack pnpm build` — passed.
- `corepack pnpm test:e2e` — 19 Playwright tests passed, including desktop/mobile layout, active premium cancellation, and product-page search.
