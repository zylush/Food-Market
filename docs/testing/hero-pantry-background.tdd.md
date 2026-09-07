# Hero pantry background TDD evidence

## User journey

As a visitor, I see a quiet pantry backdrop in the landing-page hero that reinforces FoodiesFeed's editorial, shelf-label theme without competing with the headline or entering the accessibility tree.

## RED

- Added the component expectation that the hero exposes a dedicated decorative background layer and keeps it `aria-hidden`.
- `corepack pnpm exec vitest run apps/web/components/foodiesfeed-home.test.tsx` failed as expected because the original hero had neither `data-testid="hero"` nor `data-testid="hero-background"`.
- RED commit: `d8221e9 test: cover decorative hero backdrop`.

## GREEN implementation

- Added the original local image asset at `apps/web/public/hero-pantry-background.png`.
- Positioned it as a low-opacity CSS background behind the hero copy and specimen card, with isolated stacking order and no pointer interaction.
- Added component coverage for the semantic decorative-layer contract and Playwright coverage that verifies the locally served background image.

## Full-bleed extension

- Source: derived from the request to extend the pantry backdrop through the viewport margins and landing header.
- User journey: as a visitor, I see one continuous pantry backdrop around the landing hero while the navigation, headline, and specimen card stay aligned to the normal reading width.
- RED: `corepack pnpm exec vitest run apps/web/components/foodiesfeed-home.test.tsx` failed because the old hero still carried `page-width` and did not have a distinct `hero-content` inner grid.
- RED commit: `fc560b9 test: cover full-bleed hero content`.
- Header-surface RED: `corepack pnpm test:e2e -- --grep "pantry hero backdrop"` failed while the header was transparent, proving that the sticky bar did not have the requested plain background.
- Header-surface RED commit: `5c33585 test: cover sticky header surface`.
- GREEN: the outer hero owns the full-width decorative surface, `hero__inner` retains the page-width grid, and the sticky header uses its existing opaque porcelain surface so it remains readable above any scrolled content.
- Browser QA: at 1440 × 900, 768 × 1024, and 375 × 812, the header stayed opaque at the top and after scrolling, the hero remained full width, and no horizontal overflow or console warnings appeared. No committed screenshot baseline exists, so a pixel-level regression comparison is intentionally inconclusive.

| Guarantee | Test | Result |
| --- | --- | --- |
| The hero surface fills the viewport while its content remains on the page-width grid. | `foodiesfeed-home.test.tsx` | PASS |
| The landing header has a plain opaque surface and the local hero asset remains decorative. | `search.spec.ts` | PASS |
| Existing discovery, sticky-nav, localization, and error-state browser journeys remain intact. | `corepack pnpm test:e2e` | 17 passed |

## Verification

- `corepack pnpm test:coverage` — 26 files and 119 tests passed; 96.96% statement coverage overall.
- `corepack pnpm lint` — passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test:e2e` — production build passed and 17 Chromium journeys passed, including the decorative local-asset assertion.
- Browser QA at default desktop, 768 × 1024, and 390 × 844: headline and label specimen remained readable; the background was non-focusable, `aria-hidden`, pointer-inert, and produced no horizontal overflow or console warnings.
