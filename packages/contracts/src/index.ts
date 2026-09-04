import { z } from "zod";

export const SUPPORTED_LOCALES = ["en", "nl", "de", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LocaleSchema = z.enum(SUPPORTED_LOCALES);

export const ProductSummarySchema = z
  .object({
    barcode: z.string().min(1),
    name: z.string().nullable(),
    brand: z.string().nullable(),
    imageUrl: z.string().url().nullable(),
    displayLanguage: z.string().nullable(),
    usedLanguageFallback: z.boolean(),
    sourceUrl: z.string().url(),
  })
  .strict();
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const NutritionBasisSchema = z.enum(["100g", "100ml", "serving"]);
export type NutritionBasis = z.infer<typeof NutritionBasisSchema>;

export const NutritionDetailsSchema = z
  .object({
    basis: NutritionBasisSchema.nullable(),
    servingSize: z.string().nullable(),
    energyKj: z.number().finite().nullable(),
    energyKcal: z.number().finite().nullable(),
    fatG: z.number().finite().nullable(),
    saturatedFatG: z.number().finite().nullable(),
    carbohydratesG: z.number().finite().nullable(),
    sugarsG: z.number().finite().nullable(),
    fibreG: z.number().finite().nullable(),
    proteinG: z.number().finite().nullable(),
    saltG: z.number().finite().nullable(),
    sodiumG: z.number().finite().nullable(),
  })
  .strict();
export type NutritionDetails = z.infer<typeof NutritionDetailsSchema>;

export const SearchRequestSchema = z
  .object({
    query: z.string().max(120),
    locale: LocaleSchema,
  })
  .strict();
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResponseSchema = z.object({
  data: z.array(ProductSummarySchema).max(20),
  meta: z.object({
    query: z.string(),
    locale: LocaleSchema,
  }),
});

export const EntitlementSchema = z
  .object({
    canViewNutrition: z.boolean(),
    subscriptionStatus: z.string().nullable(),
    currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
    cancelAtPeriodEnd: z.boolean(),
  })
  .strict();
export type Entitlement = z.infer<typeof EntitlementSchema>;

export const ErrorCode = {
  InvalidRequest: "INVALID_REQUEST",
  InvalidSession: "INVALID_SESSION",
  NotFound: "NOT_FOUND",
  SubscriptionRequired: "SUBSCRIPTION_REQUIRED",
  AlreadySubscribed: "ALREADY_SUBSCRIBED",
  CheckoutUnavailable: "CHECKOUT_UNAVAILABLE",
  UpstreamRateLimited: "UPSTREAM_RATE_LIMITED",
  UpstreamTimeout: "UPSTREAM_TIMEOUT",
  UpstreamUnavailable: "UPSTREAM_UNAVAILABLE",
  UpstreamMalformed: "UPSTREAM_MALFORMED",
  OriginNotAllowed: "ORIGIN_NOT_ALLOWED",
  ContentTypeRequired: "CONTENT_TYPE_REQUIRED",
  InternalError: "INTERNAL_ERROR",
} as const;
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const API_ERROR_MESSAGE_KEYS: Record<ErrorCodeValue, string> = {
  INVALID_REQUEST: "errors.invalidRequest",
  INVALID_SESSION: "errors.invalidSession",
  NOT_FOUND: "errors.notFound",
  SUBSCRIPTION_REQUIRED: "errors.subscriptionRequired",
  ALREADY_SUBSCRIBED: "errors.alreadySubscribed",
  CHECKOUT_UNAVAILABLE: "errors.checkoutUnavailable",
  UPSTREAM_RATE_LIMITED: "errors.upstreamRateLimited",
  UPSTREAM_TIMEOUT: "errors.upstreamTimeout",
  UPSTREAM_UNAVAILABLE: "errors.upstreamUnavailable",
  UPSTREAM_MALFORMED: "errors.upstreamMalformed",
  ORIGIN_NOT_ALLOWED: "errors.originNotAllowed",
  CONTENT_TYPE_REQUIRED: "errors.contentTypeRequired",
  INTERNAL_ERROR: "errors.internal",
};

export interface ApiErrorBody {
  error: {
    code: ErrorCodeValue;
    messageKey: string;
  };
}

export interface ApiSuccess<T, M extends object = Record<string, never>> {
  data: T;
  meta: M;
}

export const RecentSearchSchema = z
  .object({
    id: z.string().min(1),
    displayTerm: z.string().min(1),
    normalizedTerm: z.string().min(1),
    locale: LocaleSchema,
    searchedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type RecentSearch = z.infer<typeof RecentSearchSchema>;

export const CheckoutResultSchema = z.object({ url: z.string().url() }).strict();
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;
