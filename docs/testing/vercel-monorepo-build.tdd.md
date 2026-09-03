# Vercel monorepo build TDD evidence

## Source plan

The user-provided FoodiesFeed MVP plan requires two Vercel projects rooted at `apps/api` and `apps/web`, while both applications consume the shared `@foodiesfeed/contracts` workspace package.

## User journey

As the deployment operator, I want either application to build from its configured Vercel root directory so a clean checkout cannot rely on an ignored local `packages/contracts/dist` directory.

## RED and GREEN

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `corepack pnpm vitest run apps/api/deployment-config.test.ts` | FAIL | Both app manifests returned `undefined` for the required `prebuild` script. |
| GREEN | `corepack pnpm vitest run apps/api/deployment-config.test.ts` | PASS | Two tests passed after each app added `corepack pnpm --filter @foodiesfeed/contracts build` as `prebuild`. |
| Build | `corepack pnpm build` | PASS | Contracts, API, and Next.js production builds completed successfully with both new prebuild hooks active. |
| Coverage | `corepack pnpm exec vitest run --coverage --reporter=dot` | PASS | 92 tests passed; statements 95.72%, branches 89.36%, functions 93.60%, and lines 95.72%. |
| Runtime RED | `corepack pnpm exec vitest run apps/api/deployment-config.test.ts` | FAIL | The deployed API modules had 25 extensionless relative imports and the Prisma client lacked Node ESM import settings. The corresponding Vercel function failed with `ERR_MODULE_NOT_FOUND`. |
| Runtime GREEN | `corepack pnpm exec vitest run apps/api/deployment-config.test.ts` | PASS | Four deployment tests passed after authored imports and generated Prisma imports became Node ESM-safe. |
| Runtime load | `node -e "Promise.all([import('./dist/src/app.js'), import('./dist/src/db/prisma.js')])..."` | PASS | Compiled application and database modules loaded successfully under Node 24. |

## Guarantees

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The API project builds shared contracts before compiling from `apps/api`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 2 | The web project builds shared contracts before compiling from `apps/web`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 3 | The complete workspace still produces production artifacts. | `corepack pnpm build` | Build integration | PASS |
| 4 | Vercel's Node ESM runtime can resolve every authored API module import. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 5 | Prisma emits `.js` specifiers for its generated ESM client. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |

## Checkpoint evidence

- RED: `e15167f test: expose clean Vercel monorepo build gap`
- GREEN: `2edc9e6 fix: build shared contracts in Vercel app roots`

Live Vercel health checks remain a separate release verification and are not claimed by these local tests.
