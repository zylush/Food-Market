import { validateSearchInput } from "./search-validation";

describe("search validation", () => {
  it("accepts a useful query and normalizes whitespace", () => {
    expect(validateSearchInput("  cocoa   spread ")).toEqual({ valid: true, query: "cocoa spread" });
  });

  it("rejects empty and one-character queries without network work", () => {
    expect(validateSearchInput(" ")).toEqual({ valid: false, reason: "invalidQuery" });
    expect(validateSearchInput("x")).toEqual({ valid: false, reason: "invalidQuery" });
  });
});
