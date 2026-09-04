import {
  EntitlementSchema,
  NutritionDetailsSchema,
  ProductSummarySchema,
  RecentSearchSchema,
  CheckoutResultSchema,
  type CheckoutResult,
  type Entitlement,
  type Locale,
  type NutritionDetails,
  type ProductSummary,
  type RecentSearch,
} from "@foodiesfeed/contracts";

export class ApiClientError extends Error {
  constructor(readonly code: string, readonly status: number, readonly retryAfterSeconds: number | null = null) {
    super(code);
    this.name = "ApiClientError";
  }
}

interface Envelope<T> {
  data: T;
}

function retryAfterSeconds(value: string | null): number | null {
  if (!value) return null;
  const header = value.trim();
  if (/^\d+$/u.test(header)) {
    const seconds = Number(header);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const retryAt = Date.parse(header);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("NETWORK_UNAVAILABLE", 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = body && typeof body === "object" && !Array.isArray(body) && "error" in body
      ? (body as { error?: { code?: string } }).error
      : undefined;
    const code = errorBody?.code ?? "INTERNAL_ERROR";
    throw new ApiClientError(code, response.status, code === "UPSTREAM_RATE_LIMITED"
      ? retryAfterSeconds(response.headers.get("Retry-After"))
      : null);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("data" in body)) {
    throw new ApiClientError("INTERNAL_ERROR", 502);
  }
  return (body as Envelope<T>).data;
}

export function bootstrapSession(): Promise<{ established: boolean }> {
  return apiFetch("/api/v1/demo-session", { method: "POST", body: "{}" });
}

export async function searchProducts(query: string, locale: Locale): Promise<ProductSummary[]> {
  const data = await apiFetch<unknown>("/api/v1/searches", {
    method: "POST",
    body: JSON.stringify({ query, locale }),
  });
  if (!Array.isArray(data)) throw new ApiClientError("INTERNAL_ERROR", 502);
  return data.map((product) => ProductSummarySchema.parse(product));
}

export async function fetchRecentSearches(): Promise<RecentSearch[]> {
  const data = await apiFetch<unknown>("/api/v1/searches/recent");
  if (!Array.isArray(data)) throw new ApiClientError("INTERNAL_ERROR", 502);
  return data.map((search) => RecentSearchSchema.parse(search));
}

export async function fetchPublicProduct(barcode: string, locale: Locale): Promise<ProductSummary> {
  const data = await apiFetch<unknown>(`/api/v1/products/${encodeURIComponent(barcode)}?locale=${locale}`);
  return ProductSummarySchema.parse(data);
}

export async function fetchNutrition(barcode: string): Promise<NutritionDetails> {
  const data = await apiFetch<unknown>(`/api/v1/products/${encodeURIComponent(barcode)}/nutrition`);
  return NutritionDetailsSchema.parse(data);
}

export async function fetchEntitlement(): Promise<Entitlement> {
  const data = await apiFetch<unknown>("/api/v1/entitlements");
  return EntitlementSchema.parse(data);
}

export async function createCheckout(locale: Locale): Promise<CheckoutResult> {
  const data = await apiFetch<unknown>("/api/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ locale }),
  });
  return CheckoutResultSchema.parse(data);
}
