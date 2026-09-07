# Header cache safety — TDD evidence

## Scope

No plan file was provided. The work was derived from the reported broken top header.

User journey: as a returning FoodiesFeed visitor, I should receive the current header stylesheet that matches the current header markup, rather than a stale cached stylesheet that breaks its layout.

## RED → GREEN

| # | Guarantee | Test | RED evidence | GREEN evidence |
|---|---|---|---|---|
| 1 | Replaceable Next build assets are not served from the offline cache. | `apps/web/lib/service-worker.test.ts` | `corepack pnpm test -- apps/web/public/sw.test.ts` failed: the worker called `respondWith` for `/_next/static/chunks/app.css`. | `corepack pnpm test -- apps/web/lib/service-worker.test.ts` passed: 131 tests. |
| 2 | Icons and the manifest remain available through the offline cache. | `apps/web/lib/service-worker.test.ts` | Covered alongside the reproducer. | The stable-asset case passed. |
| 3 | A controlled production browser does not persist a Next stylesheet in Cache Storage. | `tests/e2e/search.spec.ts` | The first browser attempt stopped during the pre-test font build, before Playwright started; the unit test above supplied the valid runtime RED gate. | `corepack pnpm exec playwright test --reporter=list` exited successfully with `20 passed (8.7s)`. |

The minimal production change bumps the shell cache from `foodiesfeed-shell-v2` to `foodiesfeed-shell-v3` and removes `/_next/static/` from its cache-first route. Static Next files are now handled by Next and the browser cache, preventing an old stylesheet from being paired with new markup. The offline HTML shell, icons, and manifest remain cached.

The unit test was initially created in `public/` to establish the RED state, then moved to `apps/web/lib/` before handoff so it is not exposed as a public application file.

## Additional verification

- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed.
- `corepack pnpm test:coverage` — 131 tests passed; 96.64% statements, 88.57% branches, 92.61% functions, and 96.64% lines (all above the 80% threshold).
- `corepack pnpm audit --prod` — no known vulnerabilities.
- A fresh Chromium check at 1440px and 320px confirmed a full-width sticky header, no horizontal overflow, visible wordmark and locale control, keyboard-reachable skip link, decorative non-interactive background, and no page errors.

## Browser verification

`corepack pnpm exec playwright test --reporter=list` completed successfully and printed its final cleanup summary: `20 passed (8.7s)`.
