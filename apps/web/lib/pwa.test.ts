import { isNetworkOnlyPath } from "./pwa";

describe("service worker cache boundary", () => {
  it.each([
    "/api/v1/demo-session",
    "/api/v1/searches",
    "/api/v1/searches/recent",
    "/api/v1/entitlements",
    "/api/v1/billing/checkout",
    "/api/v1/webhooks/stripe",
    "/api/v1/health",
    "/api/future-endpoint",
    "/api/v1/products/1234567890123/nutrition",
  ])("keeps %s network-only", (path) => {
    expect(isNetworkOnlyPath(path)).toBe(true);
  });

  it("allows static shell assets to use the shell cache", () => {
    expect(isNetworkOnlyPath("/en")).toBe(false);
    expect(isNetworkOnlyPath("/_next/static/chunk.js")).toBe(false);
  });
});
