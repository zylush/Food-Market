import {
  API_ERROR_MESSAGE_KEYS,
  ErrorCode,
  LocaleSchema,
  ProductSummarySchema,
  SearchRequestSchema,
} from "./index";

describe("shared transport contracts", () => {
  it("accepts only the four supported locales", () => {
    expect(LocaleSchema.safeParse("nl").success).toBe(true);
    expect(LocaleSchema.safeParse("es").success).toBe(false);
  });

  it("rejects public product payloads that contain nutrition", () => {
    const result = ProductSummarySchema.safeParse({
      barcode: "1234567890123",
      name: "Spread",
      brand: null,
      imageUrl: null,
      displayLanguage: "en",
      usedLanguageFallback: false,
      sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
      nutriments: {},
    });
    expect(result.success).toBe(false);
  });

  it("normalizes the shape of an accepted search request", () => {
    expect(SearchRequestSchema.parse({ query: "  cocoa  ", locale: "en" })).toEqual({
      query: "  cocoa  ",
      locale: "en",
    });
  });

  it("publishes a distinct timeout error for the product source", () => {
    expect(ErrorCode.UpstreamTimeout).toBe("UPSTREAM_TIMEOUT");
    expect(API_ERROR_MESSAGE_KEYS[ErrorCode.UpstreamTimeout]).toBe("errors.upstreamTimeout");
  });
});
