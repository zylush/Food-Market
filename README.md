# FoodiesFeed

FoodiesFeed is a small full-stack assignment MVP for searching packaged-food products through Open Food Facts. Basic product information is public; detailed nutrition is returned only by Express after a persisted Stripe test-mode subscription has status `active`.

The interface uses a market-label visual language: porcelain paper, ink typography, leaf green, tomato red, corn yellow, ruled facts, and product cards that read like grocery shelf labels. The application supports English, Dutch, German, and French and can be installed as a static-shell PWA.

## Live deployment

- Web application: [https://foodiesfeed-web.vercel.app](https://foodiesfeed-web.vercel.app)
- API health endpoint: [https://foodiesfeed-api.vercel.app/v1/health](https://foodiesfeed-api.vercel.app/v1/health)

The two Vercel projects deploy from this repository's `main` branch. The API function runs in Vercel's Frankfurt region (`fra1`) and uses the migrated TiDB Cloud Starter database in Frankfurt. The web application reaches Express through its same-origin `/api/*` rewrite; browser code never receives the TiDB URL, Stripe secrets, or Open Food Facts adapter configuration.

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

This is the clone-and-run path for reviewers. A reviewer does not need your TiDB Cloud credentials: local development and automated tests use a local MySQL 8-compatible server. The hosted Vercel demo uses TiDB Cloud separately; see [Local versus Vercel](#local-versus-vercel) below.

Requirements: Node.js 24.x, Corepack, pnpm 10.x, and MySQL 8 (or another MySQL 8-compatible server). The commands below are written for PowerShell on Windows; MySQL Workbench can be used instead of the `mysql` command-line client.

### 1. Create isolated local databases

Start the local MySQL server, then connect as an administrative user:

```powershell
mysql -u root -p
```

The username `foodiesfeed`, password `LocalOnlyFoodiesFeed2026`, and database names below are examples chosen for consistency. They are not application requirements. A reviewer may use any valid local MySQL username, password, and database names; if they choose different values, they must use those same values in the `CREATE USER`, `GRANT`, and connection-URL statements.

Create separate development, test, and Prisma shadow databases. The same local username and password may be used for all three; only the database name changes.

```sql
CREATE DATABASE IF NOT EXISTS foodiesfeed_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS foodiesfeed_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS foodiesfeed_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'foodiesfeed'@'localhost'
  IDENTIFIED WITH caching_sha2_password BY 'LocalOnlyFoodiesFeed2026';

GRANT ALL PRIVILEGES ON foodiesfeed_dev.*
  TO 'foodiesfeed'@'localhost';
GRANT ALL PRIVILEGES ON foodiesfeed_test.*
  TO 'foodiesfeed'@'localhost';
GRANT ALL PRIVILEGES ON foodiesfeed_shadow.*
  TO 'foodiesfeed'@'localhost';

FLUSH PRIVILEGES;
```

If the `foodiesfeed` MySQL user already exists with another password or uses the legacy `sha256_password` plugin, run this once instead:

```sql
ALTER USER 'foodiesfeed'@'localhost'
  IDENTIFIED WITH caching_sha2_password BY 'LocalOnlyFoodiesFeed2026';
```

### 2. Create the ignored API environment file

From the repository root, copy the committed template to the API directory:

```powershell
Copy-Item .env.example apps/api/.env
```

Filtered pnpm scripts run with `apps/api` as their working directory, so Prisma and the API read `apps/api/.env`. The `.gitignore` excludes `.env` and other secret-bearing environment files; commit only `.env.example`.

Edit `apps/api/.env` and replace the database lines with your local credentials:

```env
DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_dev
TEST_DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_test
SHADOW_DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_shadow
```

If a database password contains URL characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode those characters in the connection URL. For example, `p@ssword` becomes `p%40ssword`.

### 3. Generate a session secret

Generate at least 32 random bytes with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copy the printed value into `apps/api/.env`:

```env
SESSION_SECRET=paste-the-generated-value-here
```

Use a different value for Vercel. Never commit it or expose it with a `NEXT_PUBLIC_` prefix. `SESSION_SECRET` signs the HttpOnly demo-session cookie.

The seeded demo identity is controlled by `DEMO_USER_EMAIL` and intentionally has no database password:

```env
DEMO_USER_EMAIL=demo@foodiesfeed.local
```

The application issues the demo session through its public demo-session endpoint; a reviewer never needs the MySQL password or `SESSION_SECRET`.

### 4. Configure Open Food Facts

Open Food Facts is a remote API, so live product searches require internet access. Read requests do not require an API key, but the application should identify itself with a real contact in its User-Agent:

```env
OPEN_FOOD_FACTS_BASE_URL=https://world.openfoodfacts.org
OPEN_FOOD_FACTS_USER_AGENT=FoodiesFeed/0.1 (your-real-email@example.com)
```

The backend makes the request, not the browser. Tests use deterministic mocked responses, so the automated suite does not depend on Open Food Facts availability or rate limits. See the [Open Food Facts API documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) for current usage guidance.

### 5. Configure Stripe only when testing billing

Real Stripe values are not required for the automated suite. To test the local Checkout flow, use Stripe **Test mode**:

1. Create a product named `FoodiesFeed Premium`.
2. Add a recurring monthly price, for example `€4.99/month`.
3. Copy the recurring Price ID beginning with `price_`.
4. Copy your test-mode secret key beginning with `sk_test_`.

Put the values in `apps/api/.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_PRICE_ID=price_your_monthly_price_id
```

For local webhook delivery, install the [Stripe CLI](https://docs.stripe.com/get-started/development-environment?lang=node), authenticate it, and keep this command running in a separate terminal:

```powershell
stripe login
stripe listen --forward-to http://localhost:4000/v1/webhooks/stripe
```

The CLI prints a local signing secret beginning with `whsec_`. Copy it into `apps/api/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_local_cli_signing_secret
```

The local CLI signing secret is different from the signing secret for the deployed Vercel webhook. Keep the `stripe listen` process running while completing a test Checkout. Stripe Checkout subscriptions use a recurring Price ID and `mode=subscription`; webhook signatures must be verified using the raw request body. See [Stripe subscriptions](https://docs.stripe.com/payments/subscriptions) and [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature).

### 6. Install, migrate, seed, and run

Corepack is used explicitly because this workspace is run in environments where a global pnpm shim may not be writable:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

The web app runs at `http://localhost:3000`; the local API runs at `http://localhost:4000`. If `DATABASE_URL` is empty in development, the API uses a memory-only fallback so the public walking skeleton can start. Full recent-search, webhook, and entitlement demonstrations require MySQL; production/Vercel configuration always requires `DATABASE_URL`.

### Local versus Vercel

The same Prisma schema and committed migration run in both environments, but the database URL is environment-specific:

```text
Local app/tests  → local MySQL 8
Vercel demo      → TiDB Cloud MySQL-compatible database
```

For Vercel, set `DATABASE_URL`, `SESSION_SECRET`, Stripe test values, `APP_ORIGIN`, and the Open Food Facts values in the Vercel project’s environment-variable settings. Do not commit the TiDB Cloud URL or any Stripe secret. Local `TEST_DATABASE_URL` and `SHADOW_DATABASE_URL` are not normally needed by `prisma migrate deploy` in Vercel.

## Commands

```bash
corepack pnpm test             # unit, component, and API tests
corepack pnpm test:coverage    # V8 coverage report with thresholds
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test:e2e         # builds/starts production web; API boundaries are deterministic browser mocks
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

This project uses TiDB Cloud as its managed MySQL-compatible database. Prisma uses the standard MySQL connector, and the application relies only on portable relational features. The same schema and migrations can run against a local MySQL instance for development and testing. At runtime, the MariaDB driver adapter explicitly maps TiDB's `sslaccept=strict` URL option to certificate-verified TLS; weakened `sslaccept` modes are rejected.

Local development uses the installed MySQL 8 server with separate development, test, and shadow databases. The initial migration creates `User`, `Subscription`, `RecentSearch`, and `StripeWebhookEvent`, including foreign keys, unique constraints, and indexes. The seed is idempotent and creates exactly `demo@foodiesfeed.local` (or the configured synthetic email).

€4.99/month was chosen as one simple EUR-denominated demonstration price for the European language set; Stripe remains strictly in test mode. The application reads the resulting recurring Price ID from `STRIPE_PRICE_ID`; it does not hardcode a price or trust a browser-supplied Price ID.

The single demo identity is intentionally shared by all evaluators. Its search history and subscription state can therefore be visible to concurrent evaluators. Registration, real accounts, customer portal management, multiple plans, and production live-mode billing are outside this MVP; a customer portal is a follow-up rather than a required release feature.

## Deployment rehearsal

The repository is prepared for two Vercel projects:

1. Create a Frankfurt TiDB Cloud Starter cluster/database and retain its `sslaccept=strict` MySQL URL outside source control. Apply the committed migration with `corepack pnpm db:migrate:deploy`, then run the idempotent seed.
2. In Stripe test mode, create the `FoodiesFeed Premium` product and a recurring EUR Price of €4.99/month. Register `https://foodiesfeed-api.vercel.app/v1/webhooks/stripe` for the supported subscription and invoice events and retain the resulting Price ID, test secret key, and signing secret outside source control.
3. Create/link `foodiesfeed-api` with root directory `apps/api`. Set the server-only variables from `.env.example`, including the TiDB URL, Stripe test values, a generated 32+ character session secret, and the final HTTPS web origin. Deploy the `api/index.ts` function in Frankfurt (`fra1`).
4. Create/link `foodiesfeed-web` with root directory `apps/web`. Set `API_ORIGIN` to `https://foodiesfeed-api.vercel.app` and deploy. The web project rewrites same-origin `/api/*` requests to that API origin. If either project receives a different stable domain, update the webhook URL, `APP_ORIGIN`, and `API_ORIGIN` before the smoke test.
5. Complete one test-mode Checkout with synthetic test data. Verify the signed webhook changes the persisted subscription to `active`, confirm `/api/v1/entitlements`, open protected nutrition, switch all four locales, and install the HTTPS PWA. Revoke/cancel the test subscription and verify the next nutrition request returns `403 SUBSCRIPTION_REQUIRED`.

Creating Vercel projects, TiDB resources, Stripe products/prices, webhook registrations, deploying, and running a remote migration are external actions and require the operator's interactive account access and approval. No live credentials are stored in this repository; only the canonical public deployment URLs are documented above.

## Attribution and limitations

Product data and product images are sourced from [Open Food Facts](https://world.openfoodfacts.org/). Open Food Facts data is available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), with database attribution/share-alike obligations; images may have separate licenses and are linked from the source product page. FoodiesFeed does not certify accuracy, completeness, translation quality, allergens, dietary suitability, or medical safety.

Open Food Facts keyword search uses its legacy full-text endpoint behind a replaceable adapter because the current product endpoint does not provide equivalent plain-text search behavior. Upstream rate limits, incomplete records, and language coverage remain visible limitations. The PWA is intentionally an offline shell only: product search, billing, entitlement, and nutrition require a live connection.
