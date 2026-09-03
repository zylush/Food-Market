import {
  ErrorCode,
  NutritionDetailsSchema,
  ProductSummarySchema,
  type Locale,
  type NutritionDetails,
  type ProductSummary,
} from "@foodiesfeed/contracts";
import { AppError } from "../modules/errors.js";

export interface OpenFoodFactsGateway {
  search(input: { query: string; locale: Locale; limit: number }): Promise<ProductSummary[]>;
  getPublicProduct(barcode: string, locale: Locale): Promise<ProductSummary | null>;
  getNutrition(barcode: string): Promise<NutritionDetails | null>;
}

type UnknownRecord = Record<string, unknown>;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE_URL = "https://world.openfoodfacts.org";
const SOURCE_ORIGIN = "https://world.openfoodfacts.org";
const PUBLIC_FIELDS = [
  "code",
  "_id",
  "product_name",
  "product_name_en",
  "product_name_nl",
  "product_name_de",
  "product_name_fr",
  "brands",
  "languages_codes",
  "image_front_url",
  "image_front_url_en",
  "image_front_url_nl",
  "image_front_url_de",
  "image_front_url_fr",
].join(",");
const NUTRITION_FIELDS = [
  ...PUBLIC_FIELDS.split(","),
  "nutrition_data_per",
  "serving_size",
  "nutriments",
].join(",");

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.hostname !== "openfoodfacts.org" && !url.hostname.endsWith(".openfoodfacts.org")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function firstLanguage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const language = cleanText(item);
    if (language) return language;
  }
  return null;
}

function fieldName(base: string, locale: Locale): string {
  return `${base}_${locale}`;
}

interface LocalizedValue {
  value: string | null;
  displayLanguage: string | null;
  usedLanguageFallback: boolean;
}

export function pickLocalizedValue(raw: UnknownRecord, base: string, locale: Locale): LocalizedValue {
  const selected = cleanText(raw[fieldName(base, locale)]);
  if (selected) {
    return { value: selected, displayLanguage: locale, usedLanguageFallback: false };
  }

  const primary = cleanText(raw[base]);
  const sourceLanguage = firstLanguage(raw.languages_codes);
  if (primary) {
    return {
      value: primary,
      displayLanguage: sourceLanguage,
      usedLanguageFallback: true,
    };
  }

  const english = cleanText(raw[fieldName(base, "en")]);
  if (english) {
    return {
      value: english,
      displayLanguage: "en",
      usedLanguageFallback: true,
    };
  }

  return { value: null, displayLanguage: sourceLanguage, usedLanguageFallback: true };
}

function getBarcode(raw: UnknownRecord): string | null {
  const value = cleanText(raw.code) ?? cleanText(raw._id);
  return value && /^\d{8,14}$/u.test(value) ? value : null;
}

export function normalizeProduct(raw: UnknownRecord, locale: Locale): ProductSummary | null {
  const barcode = getBarcode(raw);
  if (!barcode) return null;

  const localizedName = pickLocalizedValue(raw, "product_name", locale);
  const localizedImage = pickLocalizedValue(raw, "image_front_url", locale);
  const imageUrl =
    safeHttpsUrl(localizedImage.value) ??
    safeHttpsUrl(raw.image_front_url) ??
    safeHttpsUrl(raw[fieldName("image_front_url", "en")]) ??
    safeHttpsUrl(raw.image_url);

  const product: ProductSummary = {
    barcode,
    name: localizedName.value,
    brand: cleanText(raw.brands),
    imageUrl,
    displayLanguage: localizedName.displayLanguage,
    usedLanguageFallback: localizedName.usedLanguageFallback,
    sourceUrl: `${SOURCE_ORIGIN}/product/${encodeURIComponent(barcode)}`,
  };

  return ProductSummarySchema.parse(product);
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type Basis = NutritionDetails["basis"];

function nutritionKey(base: string, basis: Basis): string | null {
  if (!basis) return null;
  return `${base}_${basis}`;
}

function nutritionNumber(nutriments: UnknownRecord, base: string, basis: Basis, alternates: string[] = []): number | null {
  const key = nutritionKey(base, basis);
  if (key) {
    const value = numericValue(nutriments[key]);
    if (value !== null) return value;
  }
  for (const alternate of alternates) {
    const alternateKey = nutritionKey(alternate, basis);
    if (alternateKey) {
      const value = numericValue(nutriments[alternateKey]);
      if (value !== null) return value;
    }
  }
  return null;
}

export function normalizeNutrition(raw: UnknownRecord): NutritionDetails {
  const rawBasis = cleanText(raw.nutrition_data_per);
  const basis: Basis = rawBasis === "100g" || rawBasis === "100ml" || rawBasis === "serving" ? rawBasis : null;
  const nutriments = asRecord(raw.nutriments) ?? {};

  return NutritionDetailsSchema.parse({
    basis,
    servingSize: cleanText(raw.serving_size),
    energyKj: nutritionNumber(nutriments, "energy-kj", basis),
    energyKcal: nutritionNumber(nutriments, "energy-kcal", basis),
    fatG: nutritionNumber(nutriments, "fat", basis),
    saturatedFatG: nutritionNumber(nutriments, "saturated-fat", basis),
    carbohydratesG: nutritionNumber(nutriments, "carbohydrates", basis),
    sugarsG: nutritionNumber(nutriments, "sugars", basis),
    fibreG: nutritionNumber(nutriments, "fiber", basis, ["fibre"]),
    proteinG: nutritionNumber(nutriments, "proteins", basis, ["protein"]),
    saltG: nutritionNumber(nutriments, "salt", basis),
    sodiumG: nutritionNumber(nutriments, "sodium", basis),
  });
}

export class OpenFoodFactsHttpGateway implements OpenFoodFactsGateway {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: {
    baseUrl?: string;
    userAgent: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  }) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/u, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 8_000;
    if (!options.userAgent.trim()) throw new Error("OPEN_FOOD_FACTS_USER_AGENT is required");
    this.userAgent = options.userAgent;
  }

  private readonly userAgent: string;

  async search(input: { query: string; locale: Locale; limit: number }): Promise<ProductSummary[]> {
    const params = new URLSearchParams({
      search_terms: input.query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: String(Math.min(input.limit, 20)),
      lc: input.locale,
      fields: PUBLIC_FIELDS,
    });
    const payload = await this.requestJson(`${this.baseUrl}/cgi/search.pl?${params.toString()}`);
    const products = Array.isArray(payload.products) ? payload.products : null;
    if (!products) throw new AppError(ErrorCode.UpstreamMalformed, 502);
    return products
      .map((product) => normalizeProduct(asRecord(product) ?? {}, input.locale))
      .filter((product): product is ProductSummary => product !== null)
      .slice(0, 20);
  }

  async getPublicProduct(barcode: string, locale: Locale): Promise<ProductSummary | null> {
    const payload = await this.requestJson(
      `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(PUBLIC_FIELDS)}`,
    );
    if (payload.status === 0) return null;
    return normalizeProduct(asRecord(payload.product) ?? {}, locale);
  }

  async getNutrition(barcode: string): Promise<NutritionDetails | null> {
    const payload = await this.requestJson(
      `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(NUTRITION_FIELDS)}`,
    );
    if (payload.status === 0) return null;
    return normalizeNutrition(asRecord(payload.product) ?? {});
  }

  private async requestJson(url: string): Promise<UnknownRecord> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { Accept: "application/json", "User-Agent": this.userAgent },
          signal: controller.signal,
        });
      } catch (error) {
        if (attempt === 0) continue;
        throw new AppError(ErrorCode.UpstreamUnavailable, 503);
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429) throw new AppError(ErrorCode.UpstreamRateLimited, 429);
      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) continue;
        throw new AppError(ErrorCode.UpstreamUnavailable, 503);
      }
      try {
        const json: unknown = await response.json();
        const record = asRecord(json);
        if (!record) throw new AppError(ErrorCode.UpstreamMalformed, 502);
        return record;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(ErrorCode.UpstreamMalformed, 502);
      }
    }
    throw new AppError(ErrorCode.UpstreamUnavailable, 503);
  }
}
