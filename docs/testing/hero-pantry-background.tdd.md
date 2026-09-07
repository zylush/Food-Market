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
| The landing header has an opaque, image-backed surface and the local hero asset remains decorative. | `search.spec.ts` | PASS |
| Existing discovery, sticky-nav, localization, and error-state browser journeys remain intact. | `corepack pnpm test:e2e` | 17 passed |

## Full-width header margin

- Source: derived from the request to fill the horizontal space around the sticky navigation with the pantry artwork, without making the navigation transparent over scrolled content.
- User journey: as a visitor, I see the pantry image from edge to edge across the header while the wordmark, navigation, and language control remain on the established reading grid.
- RED: `corepack pnpm exec vitest run apps/web/components/site-header.test.tsx` failed because `site-header-content` did not exist.
- Browser RED: `corepack pnpm test:e2e` failed because the full-width header-content surface was absent.
- RED commit: `2d710cd test: cover full-width header image surface`.
- GREEN: the header owns an opaque porcelain base and a pointer-inert, low-opacity local-image layer; `site-header__inner` retains the centered reading width and carries the interactive controls.
- Browser QA: fresh, service-worker-blocked screenshots at 1440 x 900, 768 x 1024, and 375 x 812 confirmed the image-filled header margins, readable controls, and the mobile navigation collapse. Screenshot artifacts were removed after review; no committed pixel baseline exists.

| Guarantee | Test | Result |
| --- | --- | --- |
| The header fills a 1440px viewport while its interactive content remains centered. | `search.spec.ts` | PASS |
| The header's decorative layer is the locally served pantry image, not transparent page content. | `search.spec.ts` | PASS |
| Header markup retains the primary navigation and locale selector in the centered inner surface. | `site-header.test.tsx` | PASS |

## Verification

- `corepack pnpm test:coverage` — 26 files and 119 tests passed; 96.96% statement coverage overall.
- `corepack pnpm lint` — passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test:e2e` — production build passed and 17 Chromium journeys passed, including the decorative local-asset assertion.
- Browser QA at default desktop, 768 × 1024, and 390 × 844: headline and label specimen remained readable; the background was non-focusable, `aria-hidden`, pointer-inert, and produced no horizontal overflow or console warnings.
