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
| Function trace RED | `corepack pnpm exec vitest run apps/api/deployment-config.test.ts` | FAIL | The API manifest did not define Vercel's `vercel-build` hook; the live builder traced the function before `@foodiesfeed/contracts` existed. |
| Function trace GREEN | `corepack pnpm exec vitest run apps/api/deployment-config.test.ts` | PASS | Five deployment tests passed after the API added the documented `vercel-build` contract compilation step. |
| Compiled entry RED | Live Vercel build log | FAIL | Vercel's raw TypeScript function compilation emitted Express request/response diagnostics even though the function became healthy. |
| Compiled entry GREEN | `corepack pnpm --filter @foodiesfeed/api vercel-build` and wrapper import | PASS | The Vercel hook now runs the verified API build and a JavaScript function wrapper loads its compiled output with a valid default export. |
| Rewrite RED | `GET https://foodiesfeed-web.vercel.app/api/v1/health` | FAIL | The web rewrite prepended a second `/v1`, producing `/v1/v1/health` upstream and a 404. |
| Rewrite GREEN | `corepack pnpm exec vitest run apps/api/deployment-config.test.ts` | PASS | The rewrite preserves the client-supplied version segment exactly once; seven deployment tests passed. |

## Guarantees

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The API project builds shared contracts before compiling from `apps/api`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 2 | The web project builds shared contracts before compiling from `apps/web`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 3 | The complete workspace still produces production artifacts. | `corepack pnpm build` | Build integration | PASS |
| 4 | Vercel's Node ESM runtime can resolve every authored API module import. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 5 | Prisma emits `.js` specifiers for its generated ESM client. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 6 | Vercel builds the shared contracts before tracing the serverless function. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 7 | Vercel serves the same compiled API artifact validated by the project TypeScript build. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 8 | Same-origin `/api/v1/*` requests reach upstream `/v1/*` routes without duplicating the version prefix. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |

## Checkpoint evidence

- RED: `e15167f test: expose clean Vercel monorepo build gap`
- GREEN: `2edc9e6 fix: build shared contracts in Vercel app roots`

Live Vercel health checks remain a separate release verification and are not claimed by these local tests.
