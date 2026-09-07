import { expect, test } from "@playwright/test";

const product = {
  barcode: "1234567890123",
  name: "Cocoa spread",
  brand: "Acme",
  imageUrl: null,
  displayLanguage: "en",
  usedLanguageFallback: false,
  sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
};

test.describe("free product discovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));
    await page.route("**/api/v1/searches", async (route) => route.fulfill({ json: { data: [product], meta: { query: "cocoa", locale: "en" } } }));
  });

  test("searches only after explicit submit and keeps public results nutrition-free", async ({ page }) => {
    const searchRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/searches") && request.method() === "POST") searchRequests.push(request.url());
    });
    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await expect.poll(() => searchRequests.length).toBe(0);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Cocoa spread" })).toBeVisible();
    expect(searchRequests).toHaveLength(1);
    await expect(page.getByText("Brand Acme")).toBeVisible();
  });

  test("explains the free and premium paths before turning into a results workspace", async ({ page }) => {
    const searchRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/searches") && request.method() === "POST") searchRequests.push(request.url());
    });

    await page.goto("/en");
    await expect(page.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/en#search");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await expect(page.getByTestId("landing-story")).toBeVisible();
    await expect(page.getByTestId("editorial-callout")).toBeVisible();
    await expect(page.getByRole("img", { name: "Everyday pantry food arranged for a closer look at the label." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent searches" })).toHaveCount(0);
    await expect(page.getByTestId("premium-preview")).toBeVisible();
    await page.getByRole("button", { name: "cocoa spread" }).click();
    await expect(page.getByTestId("search-input")).toHaveValue("cocoa spread");
    expect(searchRequests).toHaveLength(0);

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Cocoa spread" })).toBeVisible();
    await expect(page.getByTestId("landing-story")).toHaveCount(0);
  });

  test("keeps the pantry hero backdrop decorative and locally served", async ({ page }) => {
    await page.goto("/en");
    const hero = page.getByTestId("hero");
    const heroBackground = page.getByTestId("hero-background");

    await expect(hero).toBeVisible();
    await expect(heroBackground).toBeVisible();
    await expect(heroBackground).toHaveAttribute("aria-hidden", "true");
    await expect(heroBackground).toHaveCSS("pointer-events", "none");
    const header = page.locator("header.site-header");
    await expect(header).toHaveCSS("background-color", "rgb(246, 244, 238)");
    await expect(page.getByTestId("site-header-content")).toBeVisible();

    const dimensions = await hero.evaluate((element) => ({
      heroWidth: Math.round(element.getBoundingClientRect().width),
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.heroWidth).toBe(dimensions.viewportWidth);

    const headerSurface = await header.evaluate((element) => ({
      headerWidth: Math.round(element.getBoundingClientRect().width),
      viewportWidth: document.documentElement.clientWidth,
      backgroundImage: getComputedStyle(element, "::before").backgroundImage,
    }));
    expect(headerSurface.headerWidth).toBe(headerSurface.viewportWidth);
    expect(headerSurface.backgroundImage).toContain("/hero-pantry-background.png");

    const backgroundImage = await heroBackground.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain("/hero-pantry-background.png");
  });

  test("keeps the top navigation available while browsing the landing page", async ({ page }) => {
    await page.goto("/en");
    const header = page.locator("header.site-header");

    await expect(header).toHaveCSS("position", "sticky");
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });

  test("switches the application locale through the visible selector", async ({ page }) => {
    await page.goto("/en");
    await page.getByLabel("Language").selectOption("nl");
    await expect(page).toHaveURL(/\/nl$/);
    await expect(page.getByRole("button", { name: "Zoeken" })).toBeVisible();
  });

  test("persists the selected locale when returning through the root route", async ({ page }) => {
    await page.goto("/en");
    await page.getByLabel("Language").selectOption("nl");
    await expect(page).toHaveURL(/\/nl$/);

    await page.goto("/");

    await expect(page).toHaveURL(/\/nl$/);
    await expect(page.getByLabel("Taal")).toHaveValue("nl");
  });

  test("shows protected nutrition for a deterministically subscribed session", async ({ page }) => {
    await page.route(/\/api\/v1\/products\/1234567890123\?locale=en$/, async (route) => {
      await route.fulfill({ json: { data: product, meta: { locale: "en" } } });
    });
    await page.route("**/api/v1/products/1234567890123/nutrition", async (route) => {
      await route.fulfill({
        json: {
          data: {
            basis: "100g",
            servingSize: "20 g",
            energyKj: 2100,
            energyKcal: 500,
            fatG: 28,
            saturatedFatG: 6,
            carbohydratesG: 54,
            sugarsG: 44,
            fibreG: 3,
            proteinG: 5.5,
            saltG: 0.2,
            sodiumG: 0.08,
          },
          meta: {},
        },
      });
    });

    await page.goto("/en/products/1234567890123");

    await expect(page.getByRole("heading", { name: "Nutrition facts" })).toBeVisible();
    await expect(page.getByRole("row", { name: "Protein (g) 5.5" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "See the numbers when they matter." })).toHaveCount(0);
  });

  test("remains usable without horizontal overflow at 320 pixels", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/de");

    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Suchen" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });

  test("paginates returned matches without another product-source request", async ({ page }) => {
    let searchRequests = 0;
    const pagedProducts = Array.from({ length: 7 }, (_, index) => ({
      ...product,
      barcode: `1234567890${index + 10}`,
      name: `Product ${index + 1}`,
    }));
    await page.route("**/api/v1/searches", async (route) => {
      searchRequests += 1;
      await route.fulfill({ json: { data: pagedProducts, meta: { query: "cocoa", locale: "en" } } });
    });

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByRole("heading", { name: "Product 1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product 7" })).toHaveCount(0);
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product 7" })).toBeVisible();
    expect(searchRequests).toBe(1);
  });

  test("self-hosts the three market-label font families", async ({ page }) => {
    await page.goto("/en");

    const fontFamilies = await page.evaluate(() => ({
      display: getComputedStyle(document.querySelector("h1")!).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
      mono: getComputedStyle(document.querySelector(".eyebrow")!).fontFamily,
      bundled: Array.from(document.fonts, (font) => font.family),
    }));

    expect(fontFamilies.display).toMatch(/^"Archivo Black"/);
    expect(fontFamilies.body).toMatch(/^"IBM Plex Sans"/);
    expect(fontFamilies.mono).toMatch(/^"IBM Plex Mono"/);
    expect(fontFamilies.bundled).toEqual(expect.arrayContaining(["Archivo Black", "IBM Plex Sans", "IBM Plex Mono"]));
  });

  test("serves the localized offline shell for an uncached navigation", async ({ page, context }) => {
    await page.goto("/fr");
    await expect
      .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())), { timeout: 5_000 })
      .toBe(true);
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    try {
      await page.goto("/fr/products/1234567890123", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /hors connexion/i })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("never stores checkout return URLs in the service-worker cache", async ({ page }) => {
    await page.route("**/api/v1/entitlements", async (route) => {
      await route.fulfill({
        json: {
          data: {
            canViewNutrition: false,
            subscriptionStatus: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          meta: {},
        },
      });
    });
    await page.goto("/en");
    await expect
      .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
      .toBe(true);
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.goto("/en/checkout/success?session_id=cs_test_must_not_be_cached");
    await page.waitForTimeout(500);

    const cached = await page.evaluate(async () => Boolean(await caches.match(window.location.href)));
    expect(cached).toBe(false);
  });
});

test.describe("search workspace states", () => {
  test("keeps six reserved cards visible while a submitted search is loading", async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));

    let releaseSearch!: () => void;
    await page.route("**/api/v1/searches", async (route) => {
      await new Promise<void>((resolve) => {
        releaseSearch = resolve;
      });
      await route.fulfill({ json: { data: [], meta: { query: "cocoa", locale: "en" } } });
    });

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("result-skeleton").first()).toBeVisible();
    await expect(page.getByTestId("result-skeleton")).toHaveCount(6);

    releaseSearch();
    await expect(page.getByTestId("no-results")).toBeVisible();
  });

  test("shows a localized retry state when the product source is unavailable", async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));
    await page.route("**/api/v1/searches", async (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UPSTREAM_UNAVAILABLE" } }),
    }));

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".state-panel--error")).toContainText("product source is taking a break");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("shows a distinct timeout message when the product source takes too long", async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));
    await page.route("**/api/v1/searches", async (route) => route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UPSTREAM_TIMEOUT" } }),
    }));

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".state-panel--error")).toContainText("The product source took too long to respond");
  });

  test("shows a browser-network message when the same-origin API request cannot be made", async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));
    await page.route("**/api/v1/searches", async (route) => route.abort("failed"));

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".state-panel--error")).toContainText("We could not reach FoodiesFeed. Check your connection and try again.");
  });

  test("holds the retry action until a forwarded rate-limit window expires", async ({ page }) => {
    await page.route("**/api/v1/demo-session", async (route) => route.fulfill({ json: { data: { established: true }, meta: {} } }));
    await page.route("**/api/v1/searches/recent", async (route) => route.fulfill({ json: { data: [], meta: {} } }));
    await page.route("**/api/v1/searches", async (route) => route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "1" },
      body: JSON.stringify({ error: { code: "UPSTREAM_RATE_LIMITED" } }),
    }));

    await page.goto("/en");
    await page.getByTestId("search-input").fill("cocoa");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("button", { name: "Try again in 1s" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled({ timeout: 3_000 });
  });
});
