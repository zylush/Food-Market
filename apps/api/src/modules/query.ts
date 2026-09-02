import { ErrorCode } from "@foodiesfeed/contracts";

export class InvalidQueryError extends Error {
  readonly code = ErrorCode.InvalidRequest;

  constructor(message = "Search query must contain at least two visible characters") {
    super(message);
    this.name = "InvalidQueryError";
  }
}

export function normalizeSearchQuery(input: string): string {
  const normalized = input.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const visibleCharacters = [...normalized].filter((character) => !/\s/u.test(character)).length;

  if (visibleCharacters < 2) {
    throw new InvalidQueryError();
  }

  return normalized;
}

export function normalizeBarcode(input: string): string {
  const barcode = input.trim();
  if (!/^\d{8,14}$/u.test(barcode)) {
    throw new InvalidQueryError("Barcode must contain 8 to 14 digits");
  }
  return barcode;
}
