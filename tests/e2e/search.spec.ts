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
    await expect(page.getByText("Cocoa spread")).toBeVisible();
    expect(searchRequests).toHaveLength(1);
    await expect(page.getByText("Brand Acme")).toBeVisible();
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
});
