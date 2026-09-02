import { normalizeSearchQuery } from "./query";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  hazelnut   spread  ")).toBe("hazelnut spread");
  });

  it("rejects a query with fewer than two visible characters", () => {
    expect(() => normalizeSearchQuery("  x ")).toThrow("at least two");
  });

  it("rejects whitespace-only input", () => {
    expect(() => normalizeSearchQuery(" \t ")).toThrow("at least two");
  });
});
