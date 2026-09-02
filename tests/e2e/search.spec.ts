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
});
