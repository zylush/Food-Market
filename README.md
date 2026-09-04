# FoodiesFeed

FoodiesFeed is a small full-stack assignment MVP for searching packaged-food products through Open Food Facts. Basic product information is public; detailed nutrition is returned only by Express after a persisted Stripe test-mode subscription has status `active`.

The interface uses a market-label visual language: porcelain paper, ink typography, leaf green, tomato red, corn yellow, ruled facts, and product cards that read like grocery shelf labels. The application supports English, Dutch, German, and French and can be installed as a static-shell PWA.

## Live deployment

- Web application: [https://foodiesfeed-web.vercel.app](https://foodiesfeed-web.vercel.app)
- API health endpoint: [https://foodiesfeed-api.vercel.app/v1/health](https://foodiesfeed-api.vercel.app/v1/health)

The two Vercel projects deploy from this repository's `main` branch. The API function runs in Vercel's Frankfurt region (`fra1`) and uses the migrated TiDB Cloud Starter database in Frankfurt. The web application reaches Express through its same-origin `/api/*` rewrite; browser code never receives the TiDB URL, Stripe secrets, or Open Food Facts adapter configuration.

## Stack and repository

This is a pnpm TypeScript workspace. The folders you are most likely to need are:

```text
FoodiesFeed/
├── .env.example              Copy this for your own local settings; never edit it with secrets.
├── README.md                 This guide.
├── apps/
│   ├── web/                  The FoodiesFeed website (Next.js, React, and styling).
│   │   └── components/       Reusable page pieces such as the header and product cards.
│   └── api/                  The server (Express, product search, billing, and data access).
│       ├── src/              Server code.
│       ├── prisma/           Database schema, migrations, and demo seed data.
│       └── .env              Your private local settings file; create it from .env.example.
├── packages/
│   └── contracts/            Shared validation rules, error codes, and API shapes.
├── tests/
│   └── e2e/                  Automated browser journeys (Playwright).
└── docs/
    └── testing/              Test plans and RED-to-GREEN evidence.
```

Automated unit, component, and API tests sit beside the code they check as `*.test.ts` or `*.test.tsx`; full browser journeys live in `tests/e2e`. You do not need to open these folders to run the basic local preview.

The browser talks only to same-origin `/api/v1` paths. Next.js rewrites those paths to Express. Express is the only Open Food Facts and secret-key Stripe client, and MySQL is the authority for demo sessions, recent searches, and entitlement state.

## Local setup

### Start here: preview FoodiesFeed on your computer

This is the recommended path if you want to look around, search for products, or review the landing page. You do **not** need MySQL, Stripe, a Vercel account, or any production credentials for this first preview.

#### 1. Install Node.js once

Install [Node.js 24.x](https://nodejs.org/en/download) and accept the default installer options. You do not need to install pnpm separately; the commands below use Node's included Corepack to fetch the right version automatically.

#### 2. Open a terminal in this project folder

On Windows, open the project folder in File Explorer, click the address bar, type `powershell`, and press Enter. On macOS or Linux, open Terminal and change into the project folder.

#### 3. Make your private local settings file

Copy the safe template. Use one command that matches your computer:

```powershell
# Windows PowerShell
Copy-Item .env.example apps/api/.env
```

```bash
# macOS or Linux Terminal
cp .env.example apps/api/.env
```

The new `apps/api/.env` file belongs only on your computer. Do not share or commit it. For a first preview, leave its MySQL and Stripe values blank. If you plan to make live product searches, replace `your-email@example.com` in `OPEN_FOOD_FACTS_USER_AGENT` with an email address you control; it identifies the app to Open Food Facts and is not a login or password.

#### 4. Install and start the app

Run these commands in the same terminal. The first command is needed only the first time.

```powershell
corepack pnpm install
corepack pnpm dev
```

Keep that terminal window open while you use FoodiesFeed.

#### 5. Open FoodiesFeed and stop it when you are done

Open [http://localhost:3000](http://localhost:3000) in your browser. You can search for products normally. To stop the local app later, return to the terminal and press `Ctrl+C`.

This preview uses temporary memory-only data, so recent searches disappear when you stop the app. Billing, subscription testing, database-backed recent searches, and database tests are intentionally unavailable until you complete the optional setup below.

If `corepack` is not recognized, install Node.js 24.x, close the terminal, open it again, and repeat step 4. If the browser cannot open the page, wait until the terminal shows that the app has started, then refresh the page.

### Full local setup (optional)

Continue only if you need saved recent searches, MySQL-backed tests, or Stripe test-mode billing. This advanced path requires MySQL 8 (or another MySQL 8-compatible server). The hosted Vercel demo uses TiDB Cloud separately; see [Local versus Vercel](#local-versus-vercel) below.

#### 1. Create isolated local databases

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

#### 2. Add your local database settings

Start with the quick-preview steps above so `apps/api/.env` already exists. Open that private file and replace its three blank database lines with your local credentials:

```env
DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_dev
TEST_DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_test
SHADOW_DATABASE_URL=mysql://foodiesfeed:LocalOnlyFoodiesFeed2026@localhost:3306/foodiesfeed_shadow
```

If a database password contains URL characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode those characters in the connection URL. For example, `p@ssword` becomes `p%40ssword`.

#### 3. Choose a local session secret

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

#### 4. Configure Open Food Facts

Open Food Facts is a remote API, so live product searches require internet access. Read requests do not require an API key, but the application should identify itself with a real contact in its User-Agent:

```env
OPEN_FOOD_FACTS_BASE_URL=https://world.openfoodfacts.org
OPEN_FOOD_FACTS_USER_AGENT=FoodiesFeed/0.1 (your-real-email@example.com)
```

The backend makes the request, not the browser. Tests use deterministic mocked responses, so the automated suite does not depend on Open Food Facts availability or rate limits. See the [Open Food Facts API documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) for current usage guidance.

#### 5. Configure Stripe only when testing billing

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

##### Complete a successful test Checkout

Use Stripe **Test mode only**. After opening Checkout from FoodiesFeed, enter these values to simulate a successful card payment:

| Checkout field | Test value |
| --- | --- |
| Card number | `4242 4242 4242 4242` |
| Expiry date | Any future date, for example `12/34` |
| CVC | Any three digits |
| Name, email, and other fields | Any test value |

These details never charge a real card when the app uses `sk_test_` keys. Never enter a real card number in local testing. For cards that simulate authentication or declined payments, see [Stripe's testing guide](https://docs.stripe.com/testing).

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

#### 6. Finish the full setup

If you have not already run the quick-preview install command, run it first. Then generate the database client, create the local tables, add the demo data, and start the app:

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

For Vercel, set `DATABASE_URL`, `SESSION_SECRET`, Stripe test values, `APP_ORIGIN`, and the Open Food Facts values in the Vercel project’s environment-variable settings. Set the non-secret platform flag `NODEJS_HELPERS=0` for the API project so Express receives Stripe webhook bodies as unmodified bytes for signature verification. Do not commit the TiDB Cloud URL or any Stripe secret. Local `TEST_DATABASE_URL` and `SHADOW_DATABASE_URL` are not normally needed by `prisma migrate deploy` in Vercel.

## Commands

```bash
corepack pnpm test             # unit, component, and API tests
corepack pnpm test:db          # resets only configured local foodiesfeed_test and runs real-MySQL integration tests
corepack pnpm test:coverage    # V8 coverage report with thresholds
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test:e2e         # builds/starts production web; API boundaries are deterministic browser mocks
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
```

The RED -> GREEN verification record, acceptance-boundary coverage, and environment-limited checks are in [`docs/testing/foodiesfeed-mvp-tdd.md`](docs/testing/foodiesfeed-mvp-tdd.md). The bounded Open Food Facts retry/error work has its own evidence in [`docs/testing/search-source-resilience.tdd.md`](docs/testing/search-source-resilience.tdd.md).

The committed Prisma migration is applied with `prisma migrate dev` locally and `prisma migrate deploy` in controlled environments. Migrations never run from an HTTP request.

`corepack pnpm test:db` requires `TEST_DATABASE_URL` to point exactly to a local database named `foodiesfeed_test`. It refuses remote hosts and other database names, then runs `prisma migrate reset --force`, so it irreversibly clears only that dedicated test database before applying the committed migration. Never point `TEST_DATABASE_URL` at development, TiDB Cloud, or any production database. `SHADOW_DATABASE_URL` remains the separate shadow database used by `prisma migrate dev`.

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

## Database technical decisions

### Database choice and connection safety

TiDB Cloud is the managed, MySQL-compatible database for the deployed demo. Prisma uses the standard MySQL connector and only portable relational features, so the same schema and migrations work with a local MySQL 8-compatible server during development and testing. The MariaDB driver adapter maps TiDB's `sslaccept=strict` option to certificate-verified TLS; weaker `sslaccept` modes are rejected rather than silently accepted.

### Local isolation, migrations, and seed data

Local development uses separate development, test, and Prisma shadow databases. The initial migration creates `User`, `Subscription`, `RecentSearch`, and `StripeWebhookEvent`, with the needed foreign keys, unique constraints, and indexes. The seed is idempotent and creates only `demo@foodiesfeed.local` (or the configured synthetic email). Migrations are committed, never run from an HTTP request, and production uses `prisma migrate deploy` rather than local development commands.

## Current technical decisions

These are choices already implemented in the MVP. They are separate from the database choices above and from the deferred decisions below.

### Keep external services on the server

The browser uses only same-origin `/api/v1` routes. Next.js rewrites those routes to Express, which is the only client for Open Food Facts and secret-key Stripe calls. This keeps database URLs, Stripe secrets, and raw upstream responses out of browser code, while public responses remain explicit allowlists.

### Search only after an explicit submit

FoodiesFeed does not search while someone types. A submitted search is easier to understand, prevents an upstream request for every keystroke, and makes rate limiting and error recovery predictable.

### Bound product-source failures instead of letting a search hang

The legacy Open Food Facts text-search endpoint stays behind a replaceable adapter because it is the current endpoint that supports the required plain-text product search. Each request has a 5-second abortable timeout and at most one retry after a 250–499 ms jittered pause for a network failure, timeout, or upstream `5xx`. It deliberately does not retry `429`, other `4xx`, or malformed data.

The API maps a timeout to `UPSTREAM_TIMEOUT` (`504`), an exhausted provider failure to `UPSTREAM_UNAVAILABLE` (`503`), and a valid upstream `Retry-After` value to `UPSTREAM_RATE_LIMITED` (`429`). The web app disables retry during the rate-limit countdown. A browser connection failure is its own `NETWORK_UNAVAILABLE` state, so it is not incorrectly described as an Open Food Facts outage. Every state is translated in English, Dutch, German, and French.

For each final product-source failure, Vercel writes one safe `upstream_request_failed` JSON log line with the provider, failure kind, upstream status when available, attempt count, elapsed milliseconds, and optional retry-after seconds. It intentionally excludes search text, URLs, payloads, cookies, headers, and raw exceptions.

### Make the first local preview low-friction

When `DATABASE_URL` is blank in local development, the API uses temporary in-memory data. This lets someone preview and search FoodiesFeed without installing MySQL or Stripe first. Production requires a database, and the optional full local setup is required for saved search history, billing, and real-MySQL tests.

### Trust the server for premium access

Stripe remains in test mode. The server chooses the recurring Price ID, verifies signed webhook events, and grants premium nutrition only when the stored subscription status is `active`. A browser redirect or client-side state can never grant premium access. The €4.99/month example is a single demonstration price for the supported European language set, not a hard-coded browser value.

### Keep the PWA shell safe offline

The PWA caches only static shell assets, locale pages, icons, and offline HTML. Sessions, searches, entitlements, billing, webhooks, and premium nutrition are always network-only, so protected or personal data never enters the service-worker cache.

### Keep the landing page useful and calm

The top header is sticky. On larger screens it keeps the brand, language picker, and page navigation reachable while someone scrolls; on smaller screens it keeps the brand and language picker in a compact layout. The visual system stays market-label-like—flat colour tokens, ruled surfaces, and simple CSS-built label details—without gradients or decorative generated imagery. Motion is brief and is disabled for people who prefer reduced motion; keyboard users also have a skip link and a clearly visible focus indicator.

## Future technical decisions

These items are intentionally deferred; they are not partially implemented in the MVP.

### Durable public-search cache or another provider

There is no persistent stale-result cache, provider replacement, or new third-party infrastructure today. Revisit a durable public-data cache and provider-adapter decision when upstream outages or rate-limit incidents recur. Any cache must work in Vercel's serverless environment and must keep session, history, entitlement, billing, and nutrition data out of scope.

### Real accounts and production billing

The single demo identity is intentionally shared, so its search history and subscription state can be visible to concurrent evaluators. Registration, individual accounts, a customer portal, multiple plans, and Stripe live mode need a separate identity, security, support, and billing decision before they are added.

## Deployment rehearsal

The repository is prepared for two Vercel projects:

1. Create a Frankfurt TiDB Cloud Starter cluster/database and retain its `sslaccept=strict` MySQL URL outside source control. Apply the committed migration with `corepack pnpm db:migrate:deploy`, then run the idempotent seed.
2. In Stripe test mode, create the `FoodiesFeed Premium` product and a recurring EUR Price of €4.99/month. Register `https://foodiesfeed-api.vercel.app/v1/webhooks/stripe` for the supported subscription and invoice events and retain the resulting Price ID, test secret key, and signing secret outside source control.
3. Create/link `foodiesfeed-api` with root directory `apps/api`. Set the server-only variables from `.env.example`, including the TiDB URL, Stripe test values, a generated 32+ character session secret, the final HTTPS web origin, and `NODEJS_HELPERS=0`. Deploy the `api/index.ts` function in Frankfurt (`fra1`).
4. Create/link `foodiesfeed-web` with root directory `apps/web`. Set `API_ORIGIN` to `https://foodiesfeed-api.vercel.app` and deploy. The web project rewrites same-origin `/api/*` requests to that API origin. If either project receives a different stable domain, update the webhook URL, `APP_ORIGIN`, and `API_ORIGIN` before the smoke test.
5. Complete one test-mode Checkout with synthetic test data. Verify the signed webhook changes the persisted subscription to `active`, confirm `/api/v1/entitlements`, open protected nutrition, switch all four locales, and install the HTTPS PWA. Revoke/cancel the test subscription and verify the next nutrition request returns `403 SUBSCRIPTION_REQUIRED`.

Creating Vercel projects, TiDB resources, Stripe products/prices, webhook registrations, deploying, and running a remote migration are external actions and require the operator's interactive account access and approval. No live credentials are stored in this repository; only the canonical public deployment URLs are documented above.

## Operations, recovery, and rollback

`GET /v1/health` is intentionally shallow: it proves that the Express function can start and answer, but it does not probe TiDB, Stripe, or Open Food Facts. Use Vercel request logs together with the Stripe event-delivery view when diagnosing billing. Expected webhook failures use stable error codes and logs never include request bodies, cookies, upstream payloads, or secrets.

For an application regression, select the last known-good `Ready` deployment in the appropriate Vercel project's **Deployments** view and promote it back to Production. Roll back the API before the web application when both changed. Re-run direct `/v1/health` and same-origin `/api/v1/health`, then exercise the affected browser path. A code rollback does not roll back data.

Prisma migrations are forward-only in production. The committed initial migration only creates the MVP tables; do not drop them as part of an application rollback. Future schema changes should ship with a tested forward repair migration and a TiDB recovery plan before deployment. If webhook delivery is interrupted, correct the endpoint or signing-secret configuration, redeploy the API, and resend the existing test event from Stripe. Event IDs are transactionally idempotent, so a successful replay is safe. Rotate any credential that appears in output or a screen capture, update every affected Vercel environment, redeploy, and verify that Stripe has no pending supported events.

The repository owner is the incident owner for this assignment deployment. Keep Vercel, TiDB, and Stripe in test/demo scope; do not switch the application to Stripe live mode without a separate security, identity, support, and billing review.

## Attribution and limitations

Product data and product images are sourced from [Open Food Facts](https://world.openfoodfacts.org/). Open Food Facts data is available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), with database attribution/share-alike obligations; images may have separate licenses and are linked from the source product page. FoodiesFeed does not certify accuracy, completeness, translation quality, allergens, dietary suitability, or medical safety.

Open Food Facts keyword search uses its legacy full-text endpoint behind a replaceable adapter because the current product endpoint does not provide equivalent plain-text search behavior. Upstream rate limits, incomplete records, and language coverage remain visible limitations. The PWA is intentionally an offline shell only: product search, billing, entitlement, and nutrition require a live connection.
