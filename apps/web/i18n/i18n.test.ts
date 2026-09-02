import { dictionaries, getDictionary, isSupportedLocale } from "./dictionaries";

describe("FoodiesFeed dictionaries", () => {
  it("contains the same complete application vocabulary in every locale", () => {
    const keys = Object.keys(dictionaries.en).sort();
    for (const locale of ["en", "nl", "de", "fr"] as const) {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(keys);
    }
    expect(keys.length).toBeGreaterThan(20);
  });

  it("falls back invalid locale values to English", () => {
    expect(isSupportedLocale("fr")).toBe(true);
    expect(isSupportedLocale("es")).toBe(false);
    expect(getDictionary("es").searchButton).toBe(dictionaries.en.searchButton);
  });

  it("does not treat inherited object properties as locales", () => {
    expect(isSupportedLocale("toString")).toBe(false);
    expect(getDictionary("toString").brandName).toBe("FoodiesFeed");
  });
});
