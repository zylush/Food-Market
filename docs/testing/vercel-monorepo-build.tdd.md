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

## Guarantees

| # | What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The API project builds shared contracts before compiling from `apps/api`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 2 | The web project builds shared contracts before compiling from `apps/web`. | `apps/api/deployment-config.test.ts` | Deployment configuration | PASS |
| 3 | The complete workspace still produces production artifacts. | `corepack pnpm build` | Build integration | PASS |

## Checkpoint evidence

- RED: `e15167f test: expose clean Vercel monorepo build gap`
- GREEN: `2edc9e6 fix: build shared contracts in Vercel app roots`

Live Vercel deployment remains a separate release verification and is not claimed by these local tests.
