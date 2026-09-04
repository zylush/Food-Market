import {
  ErrorCode,
  NutritionDetailsSchema,
  ProductSummarySchema,
  type Locale,
  type NutritionDetails,
  type ProductSummary,
} from "@foodiesfeed/contracts";
import { AppError, type UpstreamFailureKind } from "../modules/errors.js";

export interface OpenFoodFactsGateway {
  search(input: { query: string; locale: Locale; limit: number }): Promise<ProductSummary[]>;
  getPublicProduct(barcode: string, locale: Locale): Promise<ProductSummary | null>;
  getNutrition(barcode: string): Promise<NutritionDetails | null>;
}

type UnknownRecord = Record<string, unknown>;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Sleep = (milliseconds: number) => Promise<void>;
type Random = () => number;
type Clock = () => number;

interface JsonResponse {
  payload: UnknownRecord;
  attempts: number;
  elapsedMs: number;
}

interface RetryAfterWindow {
  header: string;
  seconds: number;
}

const DEFAULT_BASE_URL = "https://world.openfoodfacts.org";
const SOURCE_ORIGIN = "https://world.openfoodfacts.org";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MIN_MS = 250;
const RETRY_DELAY_RANGE_MS = 250;
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

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryAfter(value: string | null, nowMs: number): RetryAfterWindow | undefined {
  if (!value) return undefined;
  const header = value.trim();
  if (/^\d+$/u.test(header)) {
    const seconds = Number(header);
    return Number.isSafeInteger(seconds) ? { header, seconds } : undefined;
  }
  const retryAt = Date.parse(header);
  if (Number.isNaN(retryAt)) return undefined;
  return { header, seconds: Math.max(0, Math.ceil((retryAt - nowMs) / 1_000)) };
}

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
  private readonly sleep: Sleep;
  private readonly random: Random;
  private readonly clock: Clock;

  constructor(options: {
    baseUrl?: string;
    userAgent: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    sleep?: Sleep;
    random?: Random;
    clock?: Clock;
  }) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/u, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.clock = options.clock ?? Date.now;
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
    const response = await this.requestJson(`${this.baseUrl}/cgi/search.pl?${params.toString()}`);
    const { payload } = response;
    const products = Array.isArray(payload.products) ? payload.products : null;
    if (!products) {
      throw this.upstreamError({
        code: ErrorCode.UpstreamMalformed,
        status: 502,
        failureKind: "malformed",
        attempts: response.attempts,
        elapsedMs: response.elapsedMs,
      });
    }
    return products
      .map((product) => normalizeProduct(asRecord(product) ?? {}, input.locale))
      .filter((product): product is ProductSummary => product !== null)
      .slice(0, 20);
  }

  async getPublicProduct(barcode: string, locale: Locale): Promise<ProductSummary | null> {
    const { payload } = await this.requestJson(
      `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(PUBLIC_FIELDS)}`,
    );
    if (payload.status === 0) return null;
    return normalizeProduct(asRecord(payload.product) ?? {}, locale);
  }

  async getNutrition(barcode: string): Promise<NutritionDetails | null> {
    const { payload } = await this.requestJson(
      `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(NUTRITION_FIELDS)}`,
    );
    if (payload.status === 0) return null;
    return normalizeNutrition(asRecord(payload.product) ?? {});
  }

  private retryDelayMs(): number {
    const random = this.random();
    const fraction = Number.isFinite(random) ? Math.min(Math.max(random, 0), 0.999_999) : 0;
    return RETRY_DELAY_MIN_MS + Math.floor(fraction * RETRY_DELAY_RANGE_MS);
  }

  private upstreamError(input: {
    code: typeof ErrorCode.UpstreamRateLimited | typeof ErrorCode.UpstreamTimeout | typeof ErrorCode.UpstreamUnavailable | typeof ErrorCode.UpstreamMalformed;
    status: number;
    failureKind: UpstreamFailureKind;
    upstreamStatus?: number;
    attempts: number;
    elapsedMs: number;
    retryAfter?: RetryAfterWindow;
  }): AppError {
    return new AppError(input.code, input.status, undefined, true, {
      retryAfter: input.retryAfter?.header,
      logContext: {
        provider: "open_food_facts",
        failureKind: input.failureKind,
        ...(input.upstreamStatus === undefined ? {} : { upstreamStatus: input.upstreamStatus }),
        attempts: input.attempts,
        elapsedMs: input.elapsedMs,
        ...(input.retryAfter ? { retryAfterSeconds: input.retryAfter.seconds } : {}),
      },
    });
  }

  private elapsedMs(startedAt: number): number {
    return Math.max(0, this.clock() - startedAt);
  }

  private async requestJson(url: string): Promise<JsonResponse> {
    const startedAt = this.clock();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response | undefined;
      let failureKind: "timeout" | "network" | undefined;
      try {
        response = await this.fetchImpl(url, {
          headers: { Accept: "application/json", "User-Agent": this.userAgent },
          signal: controller.signal,
        });
      } catch {
        failureKind = controller.signal.aborted ? "timeout" : "network";
      } finally {
        clearTimeout(timer);
      }

      if (failureKind) {
        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(this.retryDelayMs());
          continue;
        }
        throw this.upstreamError({
          code: failureKind === "timeout" ? ErrorCode.UpstreamTimeout : ErrorCode.UpstreamUnavailable,
          status: failureKind === "timeout" ? 504 : 503,
          failureKind,
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
        });
      }

      if (!response) {
        throw this.upstreamError({
          code: ErrorCode.UpstreamUnavailable,
          status: 503,
          failureKind: "network",
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
        });
      }

      if (response.status === 429) {
        throw this.upstreamError({
          code: ErrorCode.UpstreamRateLimited,
          status: 429,
          failureKind: "http",
          upstreamStatus: response.status,
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
          retryAfter: parseRetryAfter(response.headers.get("Retry-After"), this.clock()),
        });
      }
      if (!response.ok) {
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          await this.sleep(this.retryDelayMs());
          continue;
        }
        throw this.upstreamError({
          code: ErrorCode.UpstreamUnavailable,
          status: 503,
          failureKind: "http",
          upstreamStatus: response.status,
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
        });
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw this.upstreamError({
          code: ErrorCode.UpstreamMalformed,
          status: 502,
          failureKind: "malformed",
          upstreamStatus: response.status,
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
        });
      }
      const payload = asRecord(json);
      if (!payload) {
        throw this.upstreamError({
          code: ErrorCode.UpstreamMalformed,
          status: 502,
          failureKind: "malformed",
          upstreamStatus: response.status,
          attempts: attempt,
          elapsedMs: this.elapsedMs(startedAt),
        });
      }
      return { payload, attempts: attempt, elapsedMs: this.elapsedMs(startedAt) };
    }
    throw this.upstreamError({
      code: ErrorCode.UpstreamUnavailable,
      status: 503,
      failureKind: "network",
      attempts: MAX_ATTEMPTS,
      elapsedMs: this.elapsedMs(startedAt),
    });
  }
}
