# FoodiesFeed

FoodiesFeed is a small full-stack assignment MVP for searching packaged-food products through Open Food Facts. Basic product information is public; detailed nutrition is returned only by Express after a persisted Stripe test-mode subscription has status `active`.

The interface uses a market-label visual language: porcelain paper, ink typography, leaf green, tomato red, corn yellow, ruled facts, and product cards that read like grocery shelf labels. The application supports English, Dutch, German, and French and can be installed as a static-shell PWA.

## Stack and repository

This is a pnpm TypeScript workspace:

```text
apps/web              Next.js 16, React, Tailwind CSS, localized App Router pages
apps/api              Express 5, Prisma 7.10, Open Food Facts, Stripe test mode
packages/contracts    Zod schemas and framework-neutral transport contracts
tests/e2e             Playwright representative browser journeys
```

The browser talks only to same-origin `/api/v1` paths. Next.js rewrites those paths to Express. Express is the only Open Food Facts and secret-key Stripe client, and MySQL is the authority for demo sessions, recent searches, and entitlement state.

## Local setup

Requirements: Node.js 24.x, Corepack, pnpm 10.x, and a local MySQL 8-compatible server. Create three empty databases named `foodiesfeed_dev`, `foodiesfeed_test`, and `foodiesfeed_shadow`, then copy `.env.example` to `.env` and replace the local database credentials and session secret. Real Stripe values are not needed for the automated suite.

Corepack is used explicitly because this workspace is run in environments where a global pnpm shim may not be writable:

```bash
corepack pnpm install
copy .env.example .env
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

The web app runs at `http://localhost:3000`; the local API runs at `http://localhost:4000`. If `DATABASE_URL` is empty in development, the API uses a memory-only fallback so the public walking skeleton can start. Full recent-search, webhook, and entitlement demonstrations require MySQL; production/Vercel configuration always requires `DATABASE_URL`.

## Commands

```bash
corepack pnpm test             # unit, component, and API tests
corepack pnpm test:coverage    # V8 coverage report with thresholds
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test:e2e         # starts both local apps through Playwright
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
```

The RED -> GREEN verification record, acceptance-boundary coverage, and environment-limited checks are in [`docs/testing/foodiesfeed-mvp-tdd.md`](docs/testing/foodiesfeed-mvp-tdd.md).

The committed Prisma migration is applied with `prisma migrate dev` locally and `prisma migrate deploy` in controlled environments. Migrations never run from an HTTP request.

For a test-database rehearsal, temporarily set `DATABASE_URL` to the `TEST_DATABASE_URL` value before running the migration command; `SHADOW_DATABASE_URL` remains the separate shadow database used by `prisma migrate dev`.

## API boundary

Express exposes these internal paths; the deployed web origin adds `/api` through the rewrite:

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/v1/demo-session` | public | Issue a signed HttpOnly demo cookie |
| POST | `/v1/searches` | public; optional session | Submit one search and optionally save its term |
| GET | `/v1/searches/recent` | demo session | Return the newest ten distinct term-locale pairs |
| GET | `/v1/products/:barcode` | public | Return name, brand, image, barcode, fallback metadata, attribution |
| GET | `/v1/products/:barcode/nutrition` | active demo subscription | Return approved normalized nutrition fields |
| GET | `/v1/entitlements` | demo session | Return persisted entitlement projection |
| POST | `/v1/billing/checkout` | demo session | Create a server-configured subscription Checkout Session |
| POST | `/v1/webhooks/stripe` | valid Stripe signature | Reconcile the current subscription snapshot |
| GET | `/v1/health` | public | Shallow process health |

Public DTOs are explicit Zod-validated allowlists. Nutrition never appears in public search/product responses. The nutrition route checks the signed session and stored subscription before requesting Open Food Facts. Missing numeric values remain `null`; they are never converted to zero. Protected responses are `private, no-store`.

Stripe webhooks are received as raw bytes before `express.json()`, signature-verified, and recorded by event ID in the same transaction as the subscription snapshot. The current subscription is re-read from Stripe for supported events so an older delivery cannot replace a newer remote state. Only persisted `active` grants nutrition; `incomplete`, `incomplete_expired`, `past_due`, `unpaid`, `paused`, and `canceled` do not.

## Internationalization and PWA

UI strings live in four version-controlled dictionaries. The manual selector persists `foodiesfeed_locale` across navigation and reload. Product fields use selected language → primary value → English → localized unavailable, with a visible original-language indicator when a fallback is used.

The manifest uses standalone display mode, and the service worker caches only shell/static assets, locale pages, icons, and offline HTML. `/api/v1/demo-session`, `/api/v1/searches*`, `/api/v1/entitlements`, `/api/v1/billing/*`, `/api/v1/webhooks/*`, and `/api/v1/products/*/nutrition` are network-only and never service-worker cached. Offline HTML is localized for all four supported locales.

## Database and technical decisions

This project uses TiDB Cloud as its managed MySQL-compatible database. Prisma uses the standard MySQL connector, and the application relies only on portable relational features. The same schema and migrations can run against a local MySQL instance for development and testing.

Local development uses the installed MySQL 8 server with separate development, test, and shadow databases. The initial migration creates `User`, `Subscription`, `RecentSearch`, and `StripeWebhookEvent`, including foreign keys, unique constraints, and indexes. The seed is idempotent and creates exactly `demo@foodiesfeed.local` (or the configured synthetic email).

€4.99/month was chosen as one simple EUR-denominated demonstration price for the European language set; Stripe remains strictly in test mode. The application reads the resulting recurring Price ID from `STRIPE_PRICE_ID`; it does not hardcode a price or trust a browser-supplied Price ID.

The single demo identity is intentionally shared by all evaluators. Its search history and subscription state can therefore be visible to concurrent evaluators. Registration, real accounts, customer portal management, multiple plans, and production live-mode billing are outside this MVP; a customer portal is a follow-up rather than a required release feature.

## Deployment rehearsal

The repository is prepared for two Vercel projects:

1. Create/link `foodiesfeed-api` with root directory `apps/api`, deploy the `api/index.ts` Vercel function in Frankfurt (`fra1`), and set the server-only variables from `.env.example`. Use TiDB's TLS connection string for `DATABASE_URL`. Apply the committed migration with `corepack pnpm db:migrate:deploy`, then run the idempotent seed.
2. Create/link `foodiesfeed-web` with root directory `apps/web`. Set `API_ORIGIN` to the stable API deployment URL and deploy. The web project rewrites same-origin `/api/*` requests to that API origin.
3. In Stripe test mode, create the `FoodiesFeed Premium` product and a recurring EUR Price of €4.99/month. Register the stable API webhook URL for the supported subscription and invoice events, then store the resulting Price ID, secret key, and webhook signing secret only in Vercel environment settings.
4. Complete one test-mode Checkout with synthetic test data. Verify the signed webhook changes the persisted subscription to `active`, confirm `/api/v1/entitlements`, open protected nutrition, switch all four locales, and install the HTTPS PWA. Revoke/cancel the test subscription and verify the next nutrition request returns `403 SUBSCRIPTION_REQUIRED`.

Creating Vercel projects, TiDB resources, Stripe products/prices, webhook registrations, deploying, and running a remote migration are external actions and require the operator’s interactive account access and approval. No live credentials or public deployment URL are stored in this repository.

## Attribution and limitations

Product data and product images are sourced from [Open Food Facts](https://world.openfoodfacts.org/). Open Food Facts data is available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), with database attribution/share-alike obligations; images may have separate licenses and are linked from the source product page. FoodiesFeed does not certify accuracy, completeness, translation quality, allergens, dietary suitability, or medical safety.

Open Food Facts keyword search uses its legacy full-text endpoint behind a replaceable adapter because the current product endpoint does not provide equivalent plain-text search behavior. Upstream rate limits, incomplete records, and language coverage remain visible limitations. The PWA is intentionally an offline shell only: product search, billing, entitlement, and nutrition require a live connection.
