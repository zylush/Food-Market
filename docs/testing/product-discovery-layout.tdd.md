# Product discovery layout TDD evidence

## Source plan

This record covers the approved product-discovery layout update. It removes the visible Shelf Memory sidebar, makes the search control a compact full-width bar, adds client-side pagination to the returned product set, and adds a local editorial pantry image as the landing-page divider.

The product source remains unchanged: one submitted query returns the current result set, and pages slice that result set locally. Page changes do not make additional source requests.

## User journeys

- As a shopper, I can scan products across the full content width instead of losing space to Shelf Memory.
- As a shopper, I can submit a named product query from a direct search bar without the previous standalone search section.
- As a shopper, I can move through a long result set using visible, keyboard-operable page controls.
- As a visitor, I see an editorial pantry still-life that separates search from the explanatory landing content without adding visual noise.

## RED and GREEN

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `corepack pnpm exec vitest run apps/web/components/foodiesfeed-home.test.tsx apps/web/components/site-header.test.tsx` | FAIL | The editorial divider and `#search` anchor were absent, and all seven test products appeared on one page. |
| GREEN | `corepack pnpm exec vitest run apps/web/components/foodiesfeed-home.test.tsx apps/web/components/site-header.test.tsx apps/web/i18n/i18n.test.ts` | PASS | 17 targeted tests passed. |
| GREEN - full suite | `corepack pnpm test:coverage` | PASS | 26 files / 118 tests; 96.96% statements, 90.22% branches, 93.38% functions, and 96.96% lines. |

## Test specification

| # | What is guaranteed | Test file or check | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The landing view exposes a compact search bar, the editorial divider and its descriptive alternative text, and no visible recent-search region. | `apps/web/components/foodiesfeed-home.test.tsx` | component | PASS |
| 2 | Seven returned products show six cards on page one; page two exposes the seventh and does not submit another product-source request. | `apps/web/components/foodiesfeed-home.test.tsx` | component | PASS |
| 3 | Loading reserves six product-card spaces, matching the page size. | `apps/web/components/foodiesfeed-home.test.tsx` | component | PASS |
| 4 | The primary navigation Search link points to the compact `#search` bar. | `apps/web/components/site-header.test.tsx` | component | PASS |
| 5 | All supported locale dictionaries supply pagination and editorial-image vocabulary. | `apps/web/i18n/i18n.test.ts` | unit | PASS |
| 6 | A real local preview returned 20 cocoa matches; page two changed the first visible product and page three was selected with Enter. | Local browser QA at 390 px, 768 px, and desktop | manual/browser | PASS |

## Full verification

| Command | Result |
| --- | --- |
| `corepack pnpm test:coverage` | PASS - 118 tests and all global coverage thresholds passed. |
| `corepack pnpm lint` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm build` | PASS - contracts, API, and Next.js production build completed. |
| `corepack pnpm exec playwright test` | PASS - 16 Chromium journeys, including the updated loading and pagination journeys. |
| `git diff --check` | PASS |
| `corepack pnpm audit` | PASS - no known vulnerabilities found. |

## Browser QA notes

- Desktop: the compact search control, three-column product grid, no Shelf Memory sidebar, editorial callout, and numbered pagination rendered correctly.
- Tablet (768 px): the grid rendered two columns, with a 713 px content width inside the viewport and no horizontal overflow.
- Phone (390 px): the search and product grid both measured 347 px inside a 375 px document width; the grid rendered one column with no horizontal overflow.
- The first live `cocoa` attempt encountered an Open Food Facts `503`, then a later local preview returned 20 matches. This reflects the already-handled upstream availability state rather than a pagination or layout failure.

## Checkpoint evidence

- RED: `43adff0 test: cover full-width product pagination`
- GREEN: final implementation commit for this change

## Known gaps and deferred work

- Pagination intentionally applies to the current source response (up to the existing API limit), not an unbounded server-side catalog. Server-driven pagination would require a product-source/API contract change.
- Recent-search data and its API remain intact for backward compatibility, but the Shelf Memory UI and its mount-time fetch are removed.
- No visual-regression baseline existed, so browser QA confirms layout and interaction behavior rather than pixel-for-pixel comparison against a prior build.
