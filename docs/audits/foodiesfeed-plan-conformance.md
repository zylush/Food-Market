# FoodiesFeed MVP plan-conformance audit

Audit date: 2026-09-04

Audited branch: `main`

Release surface: `apps/web`, `apps/api`, `packages/contracts`, local MySQL 8, TiDB Cloud Starter, Stripe test mode, and both Vercel projects

## Verdict

The MVP conforms to the supplied FoodiesFeed build and deployment plan. No required MVP deliverable is missing. The production-readiness score is **84/100 — launchable with caveats**: the implemented and deployed scope passes, but the repository has no CI workflow, which caps the score under the production-audit rubric. Functional installed-PWA QA passes; screenshot regression is inconclusive because the plan did not establish a committed visual baseline.

## Requirement matrix

| Plan area | Result | Authoritative evidence |
| --- | --- | --- |
| pnpm TypeScript monorepo | PASS | Root `package.json`, `pnpm-workspace.yaml`, strict project TypeScript configs, and `pnpm-lock.yaml`; Node is constrained to `>=24 <25`. |
| Web stack and design | PASS | `apps/web` uses Next.js 16.3, React 19, Tailwind CSS 4, the porcelain/ink/leaf/tomato/corn palette, Archivo Black, IBM Plex Sans, IBM Plex Mono, shelf-label cards, and semantic ruled nutrition tables. |
| Locale-prefixed application | PASS | `/en`, `/nl`, `/de`, `/fr`, locale product routes, Checkout return routes, and offline routes build successfully. `/` reads `foodiesfeed_locale` and falls back to English; the selector stores the locale in a Lax cookie and local storage. |
| Responsive and accessible UI | PASS | Component tests cover loading, empty, error, missing-image, language, and premium states. Playwright proves keyboard-visible controls, explicit submit, and no horizontal overflow at 320 px. Product nutrition is rendered as a semantic table. |
| Express API architecture | PASS | `createApp` is injectable; `src/server.ts` is the local entry point; `api/index.ts` is the TypeScript Vercel entry; the thin `api/vercel.js` wrapper exports verified build output. Express body helpers are disabled by `vercel.json`. |
| Required endpoints | PASS | All nine planned routes exist and have integration coverage: demo session, search, recent searches, public product, protected nutrition, entitlements, Checkout, Stripe webhook, and shallow health. |
| Public response boundaries | PASS | Shared strict Zod schemas allowlist product, nutrition, entitlement, recent-search, and Checkout payloads. Tests prove search and public-product responses contain no nutrition fields. |
| Open Food Facts integration | PASS | Text search uses `/cgi/search.pl`; product reads use `/api/v2/product`; fields are explicit. Reads use an eight-second timeout, one retry for transient failures, runtime validation, and stable rate-limit/unavailable/malformed errors. Locale fallback is selected language, primary value, English, then localized unavailable state. |
| Session and request security | PASS | The demo cookie is signed, HttpOnly, SameSite=Lax, and Secure in production. State-changing browser requests require JSON and a strict production origin. Protected responses are `private, no-store`, and nutrition authorization occurs before the upstream request. |
| Recent-search persistence | PASS | Prisma upsert deduplicates by user, normalized term, and locale; a transaction keeps only the newest ten. Tests cover deduplication, ordering, and retention. |
| Prisma and MySQL persistence | PASS | The single committed `20260903000000_init` migration creates `User`, `Subscription`, `RecentSearch`, and `StripeWebhookEvent` with required keys, indexes, and foreign keys. Prisma uses `provider = "mysql"` with the maintained MariaDB adapter. |
| Deterministic seed | PASS | `demo-user-0001` / `demo@foodiesfeed.local` is upserted. The standalone seed now loads `apps/api/.env`; two consecutive local runs succeeded and direct SQL found exactly one synthetic user. |
| Local MySQL topology | PASS | `foodiesfeed_dev`, `foodiesfeed_test`, and `foodiesfeed_shadow` exist. The app account uses `caching_sha2_password` and has grants on only those three databases. The committed migration applied once against development; the service reauthenticated after a normal restart. |
| Stripe Checkout | PASS | Checkout uses the server-configured recurring Price ID, `mode=subscription`, test-mode credentials, and locale-preserving return URLs. The browser cannot supply a price. |
| Stripe webhook safety | PASS | Raw bytes are processed before JSON middleware, signatures are verified, six event types are supported, and event IDs plus subscription reconciliation are transactional. Tests cover invalid signatures, duplicates, out-of-order delivery, mismatched snapshots, and current nested invoice shapes. |
| Premium authorization | PASS | Only persisted status `active` grants access. Every non-active status is tested. A real test Checkout produced active entitlement and the twelve-field nutrition allowlist; after cancellation, the webhook returned `200`, entitlement became canceled, and nutrition returned `403 SUBSCRIPTION_REQUIRED`. |
| PWA | PASS | Manifest, 192/512 icons, standalone display, service worker, and four localized offline pages exist. Every `/api/*` request is network-only; only shell, icon, manifest, and static assets are cached. Eight production-build Playwright journeys pass, including real offline navigation and Checkout cache exclusion. |
| Installed-PWA smoke | PASS | Windows application discovery found the installed FoodiesFeed Chrome app running in its own standalone window. The live journey searched, retried a transient upstream error, opened Nutella `3017620422003`, and showed the premium prompt without nutrition after cancellation. |
| Documentation and secret handling | PASS | `.env.example` contains placeholders; `.env*` is ignored except the example; `apps/api/.env` exists locally and remains untracked; `.planning/` remains ignored and uncommitted. README covers setup, migration, tests, deployment, i18n, architecture, attribution, limitations, recovery, and rollback. |
| Required technical decisions | PASS | README includes the exact TiDB portability statement, local MySQL 8 topology, and €4.99/month Stripe test-mode rationale. It explicitly leaves the customer portal as a follow-up. |
| Managed deployment | PASS | `foodiesfeed-api` and `foodiesfeed-web` are live on their canonical `vercel.app` aliases. Vercel inspection places the API function in `fra1`. The committed migration and idempotent seed were applied to the Frankfurt TiDB Cloud Starter database. |
| Production smoke | PASS | Direct and same-origin rewritten health, all locale shells, all localized offline pages, and the manifest return successfully. Stripe reports no pending relevant sandbox webhook deliveries. |

## Endpoint audit

| Endpoint | Required behavior | Result |
| --- | --- | --- |
| `POST /v1/demo-session` | Establish signed demo-user cookie | PASS |
| `POST /v1/searches` | Validate/search and persist when session exists | PASS |
| `GET /v1/searches/recent` | Return newest ten | PASS |
| `GET /v1/products/:barcode` | Public allowlisted product only | PASS |
| `GET /v1/products/:barcode/nutrition` | Require active persisted subscription | PASS |
| `GET /v1/entitlements` | Return persisted premium state | PASS |
| `POST /v1/billing/checkout` | Create server-configured test subscription Checkout | PASS |
| `POST /v1/webhooks/stripe` | Verify and transactionally reconcile | PASS |
| `GET /v1/health` | Return shallow health response | PASS |

## Release-gate evidence

```text
corepack pnpm test:coverage      102/102 tests; 95.73% statements, 89.72% branches,
                                 93.60% functions, 95.73% lines
corepack pnpm typecheck          PASS
corepack pnpm lint               PASS
corepack pnpm build              PASS (API plus 20 Next.js pages)
corepack pnpm test:e2e           8/8 Playwright journeys PASS
corepack pnpm audit --prod       No known vulnerabilities
corepack pnpm db:migrate:deploy  Initial local migration applied successfully
corepack pnpm db:seed            PASS twice; deterministic count remains one
git diff --check                 PASS
tracked secret-pattern scan      PASS (no matches)
```

The local seed rehearsal discovered and fixed one release-only defect using RED/GREEN checkpoints: `d2d7a80` reproduced missing `.env` loading, and `73cdd1f` loaded `dotenv/config` before Prisma construction. The full verification suite passed after the fix.

## Deployment evidence

- Web: <https://foodiesfeed-web.vercel.app>
- API: <https://foodiesfeed-api.vercel.app>
- Database: TiDB Cloud Starter, Frankfurt, standard MySQL connector and portable relational schema
- Billing: Stripe test product **FoodiesFeed Premium**, recurring **€4.99/month** EUR Price
- Webhook: direct API URL, signature secret rotated after exposure, Production and Preview updated, API redeployed, supported event backlog cleared
- Lifecycle smoke: Checkout -> signed webhook -> persisted active entitlement -> protected nutrition -> cancellation -> signed webhook -> persisted canceled entitlement -> protected `403`

## Caveats, not plan blockers

1. There is no GitHub Actions or equivalent repository CI workflow. All release gates were run locally, and Vercel deployment checks are used for remote-main health. This is why the production-readiness score is capped at 84.
2. There is no committed screenshot baseline, so automated visual-regression comparison is inconclusive. Functional desktop, 320 px, locale, offline, and installed-standalone behavior is verified.
3. `GET /v1/health` is intentionally shallow, exactly as planned; dependency health is diagnosed through request logs and provider dashboards.
4. Open Food Facts completeness, availability, image licensing, and translation quality remain upstream limitations and are disclosed in the UI/README.
5. The shared demo identity is suitable only for this test assignment. Real authentication, isolated accounts, live-mode billing, and a customer portal require a separate production scope.
