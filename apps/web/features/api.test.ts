import {
  ApiClientError,
  bootstrapSession,
  createCheckout,
  fetchEntitlement,
  fetchNutrition,
  fetchPublicProduct,
  fetchRecentSearches,
  searchProducts,
} from "./api";

const product = {
  barcode: "1234567890123",
  name: "Cocoa spread",
  brand: "Acme",
  imageUrl: null,
  displayLanguage: "en",
  usedLanguageFallback: false,
  sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
};

function response(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("same-origin API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends same-origin requests and validates each successful transport", async () => {
    const recent = {
      id: "recent-1",
      displayTerm: "Cocoa",
      normalizedTerm: "cocoa",
      locale: "en",
      searchedAt: "2026-09-03T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/demo-session")) return response({ established: true });
      if (input.endsWith("/searches") && init?.method === "POST") return response([product]);
      if (input.endsWith("/searches/recent")) return response([recent]);
      if (input.includes("/nutrition")) return response({
        basis: "100g",
        servingSize: null,
        energyKj: 1800,
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
      if (input.endsWith("/entitlements")) return response({
        canViewNutrition: true,
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      if (input.endsWith("/billing/checkout")) return response({ url: "https://checkout.test/session" });
      return response(product);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bootstrapSession()).resolves.toEqual({ established: true });
    await expect(searchProducts("cocoa", "en")).resolves.toEqual([product]);
    await expect(fetchRecentSearches()).resolves.toEqual([recent]);
    await expect(fetchPublicProduct(product.barcode, "en")).resolves.toEqual(product);
    await expect(fetchNutrition(product.barcode)).resolves.toMatchObject({ energyKj: 1800 });
    await expect(fetchEntitlement()).resolves.toMatchObject({ canViewNutrition: true });
    await expect(createCheckout("nl")).resolves.toEqual({ url: "https://checkout.test/session" });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/demo-session", expect.objectContaining({
      method: "POST",
      body: "{}",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    }));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/searches", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ query: "cocoa", locale: "en" }),
    }));
  });

  it("maps network and malformed server responses to stable client errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(bootstrapSession()).rejects.toMatchObject({ code: "NETWORK_UNAVAILABLE", status: 0 });

    vi.stubGlobal("fetch", vi.fn(async () => response({ code: "SUBSCRIPTION_REQUIRED" }, 403)));
    await expect(fetchNutrition("1234567890123")).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED", status: 403 });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify("not-an-envelope"), { status: 502 })));
    await expect(fetchEntitlement()).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 502 });

    vi.stubGlobal("fetch", vi.fn(async () => response("not-a-list")));
    await expect(searchProducts("cocoa", "en")).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 502 });

    vi.stubGlobal("fetch", vi.fn(async () => response({ code: "UPSTREAM_RATE_LIMITED" }, 429, { "Retry-After": "8" })));
    await expect(searchProducts("cocoa", "en")).rejects.toMatchObject({
      code: "UPSTREAM_RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 8,
    });

    vi.stubGlobal("fetch", vi.fn(async () => response([{ ...product, locale: "xx" }])));
    await expect(fetchRecentSearches()).rejects.toThrow();
    expect(new ApiClientError("TEST", 400)).toBeInstanceOf(Error);
  });
});
