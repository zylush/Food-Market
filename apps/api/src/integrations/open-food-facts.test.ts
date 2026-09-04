import { ErrorCode } from "@foodiesfeed/contracts";
import {
  normalizeNutrition,
  normalizeProduct,
  OpenFoodFactsHttpGateway,
  pickLocalizedValue,
} from "./open-food-facts";

describe("Open Food Facts normalization", () => {
  it.each(["en", "nl", "de", "fr"] as const)(
    "uses the selected %s product field before primary and English values",
    (locale) => {
      const selectedField = `product_name_${locale}`;
      const product = normalizeProduct(
        {
          code: "1234567890123",
          [selectedField]: `${locale} spread`,
          product_name: "Primary spread",
          ...(locale === "en" ? {} : { product_name_en: "English spread" }),
          brands: "Acme",
          languages_codes: [locale],
          image_front_url: "https://images.openfoodfacts.org/front.jpg",
          [`image_front_url_${locale}`]: `https://images.openfoodfacts.org/${locale}.jpg`,
        },
        locale,
      );

      expect(product).toMatchObject({
        barcode: "1234567890123",
        name: `${locale} spread`,
        displayLanguage: locale,
        usedLanguageFallback: false,
        imageUrl: `https://images.openfoodfacts.org/${locale}.jpg`,
      });
      expect(product).not.toHaveProperty("nutriments");
    },
  );

  it("marks a primary or English value as a fallback and tolerates incomplete fields", () => {
    const product = normalizeProduct(
      {
        code: "1234567890123",
        product_name: "Original spread",
        product_name_en: "English spread",
        languages_codes: ["it"],
      },
      "de",
    );

    expect(product).toMatchObject({
      name: "Original spread",
      brand: null,
      imageUrl: null,
      displayLanguage: "it",
      usedLanguageFallback: true,
    });
  });

  it("falls back through English, rejects invalid barcodes, and sanitizes image URLs", () => {
    expect(pickLocalizedValue({ product_name_de: "", product_name_en: "English spread" }, "product_name", "de"))
      .toEqual({ value: "English spread", displayLanguage: "en", usedLanguageFallback: true });
    expect(pickLocalizedValue({ languages_codes: [42, " nl "] }, "product_name", "fr"))
      .toEqual({ value: null, displayLanguage: "nl", usedLanguageFallback: true });
    expect(normalizeProduct({ code: "not-a-barcode" }, "en")).toBeNull();

    const product = normalizeProduct({
      _id: "1234567890123",
      product_name_en: "English spread",
      languages_codes: "not-an-array",
      image_front_url_de: "https://evil.example/front.jpg",
      image_front_url: "http://images.openfoodfacts.org/insecure.jpg",
      image_url: "https://images.openfoodfacts.org/fallback.jpg",
    }, "de");
    expect(product).toMatchObject({
      barcode: "1234567890123",
      name: "English spread",
      displayLanguage: "en",
      imageUrl: "https://images.openfoodfacts.org/fallback.jpg",
    });
  });

  it("keeps absent nutrition values null and never turns them into zero", () => {
    const nutrition = normalizeNutrition({
      nutrition_data_per: "100g",
      serving_size: "30 g",
      nutriments: {
        "energy-kj_100g": 1800,
        "energy-kcal_100g": 430,
        fat_100g: 12,
        salt_100g: "not-a-number",
      },
    });

    expect(nutrition).toEqual({
      basis: "100g",
      servingSize: "30 g",
      energyKj: 1800,
      energyKcal: 430,
      fatG: 12,
      saturatedFatG: null,
      carbohydratesG: null,
      sugarsG: null,
      fibreG: null,
      proteinG: null,
      saltG: null,
      sodiumG: null,
    });
  });

  it("supports serving values and alternate fibre/protein spellings", () => {
    expect(normalizeNutrition({
      nutrition_data_per: "serving",
      nutriments: {
        "energy-kj_serving": 0,
        "energy-kcal_serving": "not-a-number",
        "fat_serving": Number.POSITIVE_INFINITY,
        "fibre_serving": "1.5",
        "protein_serving": "2.5",
        "sodium_serving": " ",
      },
    })).toMatchObject({
      basis: "serving",
      energyKj: 0,
      energyKcal: null,
      fatG: null,
      fibreG: 1.5,
      proteinG: 2.5,
      sodiumG: null,
    });
    expect(normalizeNutrition({ nutrition_data_per: "unsupported", nutriments: [] })).toEqual({
      basis: null,
      servingSize: null,
      energyKj: null,
      energyKcal: null,
      fatG: null,
      saturatedFatG: null,
      carbohydratesG: null,
      sugarsG: null,
      fibreG: null,
      proteinG: null,
      saltG: null,
      sodiumG: null,
    });
  });

  it("uses the legacy keyword endpoint with a small field allowlist and retries one transient failure", async () => {
    const calls: Array<{ url: string; userAgent: string | null }> = [];
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), userAgent: new Headers(init?.headers).get("User-Agent") });
      if (calls.length === 1) return new Response("temporary", { status: 503 });
      return new Response(JSON.stringify({ products: [{ code: "1234567890123", product_name: "Cocoa" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const gateway = new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl,
      timeoutMs: 100,
      sleep,
      random: () => 0.5,
    });

    const products = await gateway.search({ query: "cocoa", locale: "en", limit: 20 });
    expect(products[0]?.name).toBe("Cocoa");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(375);
    expect(calls[0]?.userAgent).toBe("FoodiesFeed/test");
    expect(calls[0]?.url).toContain("fields=code%2C_id");
  });

  it("maps rate limits to a stable error without retrying", async () => {
    const fetchImpl = vi.fn(async () => new Response("limited", { status: 429, headers: { "Retry-After": "7" } }));
    const gateway = new OpenFoodFactsHttpGateway({ userAgent: "FoodiesFeed/test", fetchImpl });
    await expect(gateway.search({ query: "cocoa", locale: "en", limit: 20 })).rejects.toMatchObject({
      code: "UPSTREAM_RATE_LIMITED",
      status: 429,
      retryAfter: "7",
      logContext: {
        provider: "open_food_facts",
        failureKind: "http",
        upstreamStatus: 429,
        attempts: 1,
        retryAfterSeconds: 7,
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-rate-limited client error", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad request", { status: 400 }));
    const gateway = new OpenFoodFactsHttpGateway({ userAgent: "FoodiesFeed/test", fetchImpl });
    await expect(gateway.search({ query: "cocoa", locale: "en", limit: 20 })).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      logContext: { provider: "open_food_facts", failureKind: "http", upstreamStatus: 400, attempts: 1 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries abortable timeouts with jitter and returns a distinct timeout outcome", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn((_: string | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")), { once: true });
    }));
    const gateway = new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl,
      timeoutMs: 1,
      sleep,
      random: () => 0,
    });

    await expect(gateway.search({ query: "cocoa", locale: "en", limit: 20 })).rejects.toMatchObject({
      code: ErrorCode.UpstreamTimeout,
      status: 504,
      logContext: { provider: "open_food_facts", failureKind: "timeout", attempts: 2 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("reads public and nutrition product routes with explicit status handling", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("nutriments")) {
        return new Response(JSON.stringify({
          status: 1,
          product: {
            nutrition_data_per: "100g",
            nutriments: { "energy-kj_100g": 1500 },
          },
        }));
      }
      return new Response(JSON.stringify({
        status: 1,
        product: { code: "1234567890123", product_name_en: "Cocoa" },
      }));
    });
    const gateway = new OpenFoodFactsHttpGateway({ userAgent: "FoodiesFeed/test", fetchImpl });

    await expect(gateway.getPublicProduct("1234567890123", "en")).resolves.toMatchObject({ name: "Cocoa" });
    await expect(gateway.getNutrition("1234567890123")).resolves.toMatchObject({ energyKj: 1500 });
    expect(calls[0]).toContain("fields=code%2C_id");
    expect(calls[1]).toContain("nutriments");

    const missing = new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ status: 0 }))),
    });
    await expect(missing.getPublicProduct("1234567890123", "en")).resolves.toBeNull();
    await expect(missing.getNutrition("1234567890123")).resolves.toBeNull();
  });

  it("maps malformed, exhausted transient, and network failures consistently", async () => {
    const malformed = new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ products: {} }))),
    });
    await expect(malformed.search({ query: "cocoa", locale: "en", limit: 30 }))
      .rejects.toMatchObject({ code: ErrorCode.UpstreamMalformed, status: 502 });

    const badJson = new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl: vi.fn(async () => new Response("[1, 2]", { status: 200 })),
    });
    await expect(badJson.search({ query: "cocoa", locale: "en", limit: 2 }))
      .rejects.toMatchObject({ code: ErrorCode.UpstreamMalformed });

    const serverErrors = vi.fn(async () => new Response("down", { status: 503 }));
    const serverSleep = vi.fn(async () => undefined);
    await expect(new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl: serverErrors,
      sleep: serverSleep,
      random: () => 0,
    }).search({ query: "cocoa", locale: "en", limit: 2 })).rejects.toMatchObject({
      code: ErrorCode.UpstreamUnavailable,
      logContext: { provider: "open_food_facts", failureKind: "http", upstreamStatus: 503, attempts: 2 },
    });
    expect(serverErrors).toHaveBeenCalledTimes(2);
    expect(serverSleep).toHaveBeenCalledWith(250);

    const networkErrors = vi.fn(async () => { throw new Error("offline"); });
    const networkSleep = vi.fn(async () => undefined);
    await expect(new OpenFoodFactsHttpGateway({
      userAgent: "FoodiesFeed/test",
      fetchImpl: networkErrors,
      sleep: networkSleep,
      random: () => 0,
    }).search({ query: "cocoa", locale: "en", limit: 2 })).rejects.toMatchObject({
      code: ErrorCode.UpstreamUnavailable,
      logContext: { provider: "open_food_facts", failureKind: "network", attempts: 2 },
    });
    expect(networkErrors).toHaveBeenCalledTimes(2);
    expect(networkSleep).toHaveBeenCalledWith(250);
    expect(() => new OpenFoodFactsHttpGateway({ userAgent: "  " })).toThrow("USER_AGENT");
  });
});
