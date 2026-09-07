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

## Verification

- `corepack pnpm test:coverage` — 26 files and 119 tests passed; 96.96% statement coverage overall.
- `corepack pnpm lint` — passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test:e2e` — production build passed and 17 Chromium journeys passed, including the decorative local-asset assertion.
- Browser QA at default desktop, 768 × 1024, and 390 × 844: headline and label specimen remained readable; the background was non-focusable, `aria-hidden`, pointer-inert, and produced no horizontal overflow or console warnings.
