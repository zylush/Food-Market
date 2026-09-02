export type SearchValidation =
  | { valid: true; query: string }
  | { valid: false; reason: "invalidQuery" };

export function validateSearchInput(input: string): SearchValidation {
  const query = input.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const visibleCharacters = [...query].filter((character) => !/\s/u.test(character)).length;
  return visibleCharacters >= 2 ? { valid: true, query } : { valid: false, reason: "invalidQuery" };
}
