import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import {
  API_ERROR_MESSAGE_KEYS,
  EntitlementSchema,
  ErrorCode,
  LocaleSchema,
  NutritionDetailsSchema,
  ProductSummarySchema,
  SearchRequestSchema,
  type Locale,
} from "@foodiesfeed/contracts";
import { loadConfig, type AppConfig } from "./config";
import { InMemoryRepository, type Repository } from "./db/repository";
import {
  OpenFoodFactsHttpGateway,
  type OpenFoodFactsGateway,
} from "./integrations/open-food-facts";
import {
  UnavailableStripeGateway,
  type StripeEventRecord,
  type StripeGateway,
} from "./integrations/stripe";
import { AppError, isAppError, messageKeyForCode } from "./modules/errors";
import { canViewNutrition, toEntitlement } from "./modules/entitlements";
import { normalizeBarcode, normalizeSearchQuery } from "./modules/query";
import { readCookie, serializeSessionCookie, signDemoSession, verifyDemoSession } from "./middleware/session";

const SUPPORTED_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export interface AppDependencies {
  repository?: Repository;
  gateway?: OpenFoodFactsGateway;
  stripe?: StripeGateway;
  config?: AppConfig;
  now?: () => Date;
}

function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function setNoStore(response: Response, privateResponse = false): void {
  response.setHeader("Cache-Control", privateResponse ? "private, no-store" : "no-store");
}

function allowedOrigin(origin: string, config: AppConfig): boolean {
  if (config.nodeEnv === "production") return origin === config.appOrigin;
  return new Set([config.appOrigin, "http://localhost:3000", "http://127.0.0.1:3000"]).has(origin);
}

function validateBrowserMutation(config: AppConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const origin = request.get("origin");
    if ((!origin && config.nodeEnv === "production") || (origin && !allowedOrigin(origin, config))) {
      next(new AppError(ErrorCode.OriginNotAllowed, 403));
      return;
    }
    const contentType = request.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      next(new AppError(ErrorCode.ContentTypeRequired, 415));
      return;
    }
    next();
  };
}

function parseLocale(value: unknown): Locale {
  const result = LocaleSchema.safeParse(value ?? "en");
  if (!result.success) throw new AppError(ErrorCode.InvalidRequest, 400);
  return result.data;
}

function parseBodyLocale(value: unknown): Locale {
  if (value === undefined) return "en";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(ErrorCode.InvalidRequest, 400);
  }
  return parseLocale((value as { locale?: unknown }).locale);
}

function stringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function recordField(record: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const value = record[field];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function expandableId(record: Record<string, unknown>, field: string): string | null {
  const expanded = recordField(record, field);
  return stringField(record, field) ?? (expanded ? stringField(expanded, "id") : null);
}

function barcodeParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") throw new AppError(ErrorCode.InvalidRequest, 400);
  return normalizeBarcode(value);
}

function subscriptionIdForEvent(event: StripeEventRecord): string | null {
  const object = event.data.object;
  const directId = stringField(object, "id");
  const nestedId = expandableId(object, "subscription");
  if (event.type.startsWith("customer.subscription.") && directId) return directId;
  if (nestedId) return nestedId;

  const parent = recordField(object, "parent");
  const subscriptionDetails = parent ? recordField(parent, "subscription_details") : null;
  return subscriptionDetails ? expandableId(subscriptionDetails, "subscription") : null;
}

function customerIdForEvent(event: StripeEventRecord): string | null {
  return expandableId(event.data.object, "customer");
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const config = dependencies.config ?? loadConfig();
  const repository = dependencies.repository ?? new InMemoryRepository();
  const gateway = dependencies.gateway ?? new OpenFoodFactsHttpGateway({
    baseUrl: config.openFoodFactsBaseUrl,
    userAgent: config.openFoodFactsUserAgent,
  });
  const stripe = dependencies.stripe ?? new UnavailableStripeGateway();
  const now = dependencies.now ?? (() => new Date());

  const app = express();
  app.disable("x-powered-by");

  app.post(
    "/v1/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncRoute(async (request, response) => {
      setNoStore(response);
      const signature = request.get("stripe-signature");
      if (!signature || !Buffer.isBuffer(request.body)) {
        throw new AppError(ErrorCode.InvalidRequest, 400);
      }

      let event: StripeEventRecord;
      try {
        event = stripe.constructEvent(request.body, signature);
      } catch {
        throw new AppError(ErrorCode.InvalidRequest, 400);
      }

      if (!SUPPORTED_WEBHOOK_EVENTS.has(event.type)) {
        response.status(200).json({ data: { received: true, processed: false }, meta: {} });
        return;
      }

      const subscriptionId = subscriptionIdForEvent(event);
      const customerId = customerIdForEvent(event);
      if (!subscriptionId || !customerId) {
        response.status(200).json({ data: { received: true, processed: false }, meta: {} });
        return;
      }

      const user = await repository.findUserByStripeCustomerId(customerId);
      if (!user) {
        response.status(200).json({ data: { received: true, processed: false }, meta: {} });
        return;
      }

      const snapshot = await stripe.retrieveSubscription(subscriptionId);
      if (snapshot.stripeSubscriptionId !== subscriptionId || snapshot.stripeCustomerId !== customerId) {
        throw new AppError(ErrorCode.InvalidRequest, 400);
      }

      const result = await repository.reconcileWebhook({
        userId: user.id,
        event: {
          id: event.id,
          userId: user.id,
          type: event.type,
          stripeCreatedAt: new Date(event.created * 1000),
          processedAt: now(),
        },
        snapshot,
      });
      response.status(200).json({ data: { received: true, processed: !result.duplicate }, meta: {} });
    }),
  );

  app.use(express.json({ limit: "32kb" }));
  app.use((request, _response, next) => {
    if (request.method === "POST" && request.path !== "/v1/webhooks/stripe") {
      validateBrowserMutation(config)(request, _response, next);
      return;
    }
    next();
  });

  const resolveSessionUser = async (request: Request) => {
    const session = verifyDemoSession(readCookie(request, config.sessionCookieName), config.sessionSecret);
    if (!session) return null;
    return repository.findUserById(session);
  };

  const requireSessionUser = async (request: Request) => {
    const user = await resolveSessionUser(request);
    if (!user) throw new AppError(ErrorCode.InvalidSession, 401);
    return user;
  };

  app.get("/v1/health", (_request, response) => {
    setNoStore(response);
    response.status(200).json({ data: { status: "ok" }, meta: {} });
  });

  app.post(
    "/v1/demo-session",
    asyncRoute(async (_request, response) => {
      const user = await repository.findDemoUser(config.demoUserEmail);
      if (!user) throw new AppError(ErrorCode.InternalError, 500, undefined, false);
      response.setHeader(
        "Set-Cookie",
        serializeSessionCookie(config.sessionCookieName, signDemoSession(user.id, config.sessionSecret, now().getTime()), config.cookieSecure),
      );
      setNoStore(response);
      response.status(200).json({ data: { established: true }, meta: {} });
    }),
  );

  app.post(
    "/v1/searches",
    asyncRoute(async (request, response) => {
      const parsed = SearchRequestSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(ErrorCode.InvalidRequest, 400);
      const query = normalizeSearchQuery(parsed.data.query);
      const products = await gateway.search({ query, locale: parsed.data.locale, limit: 20 });
      const safeProducts = products.map((product) => ProductSummarySchema.parse(product));

      try {
        const user = await resolveSessionUser(request);
        if (user) {
          await repository.upsertRecentSearch({
            userId: user.id,
            displayTerm: query,
            normalizedTerm: query.toLocaleLowerCase("en-US"),
            locale: parsed.data.locale,
            searchedAt: now(),
          });
        }
      } catch {
        // Public search remains useful when the optional demo-history write is unavailable.
      }

      setNoStore(response);
      response.status(200).json({
        data: safeProducts.slice(0, 20),
        meta: { query, locale: parsed.data.locale },
      });
    }),
  );

  app.get(
    "/v1/searches/recent",
    asyncRoute(async (request, response) => {
      const user = await requireSessionUser(request);
      const searches = await repository.listRecentSearches(user.id, 10);
      setNoStore(response, true);
      response.status(200).json({
        data: searches.map((search) => ({
          id: search.id,
          displayTerm: search.displayTerm,
          normalizedTerm: search.normalizedTerm,
          locale: search.locale,
          searchedAt: search.searchedAt.toISOString(),
        })),
        meta: {},
      });
    }),
  );

  app.get(
    "/v1/products/:barcode",
    asyncRoute(async (request, response) => {
      const barcode = barcodeParam(request.params.barcode);
      const locale = parseLocale(request.query.locale);
      const product = await gateway.getPublicProduct(barcode, locale);
      if (!product) throw new AppError(ErrorCode.NotFound, 404);
      setNoStore(response);
      response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      response.status(200).json({ data: ProductSummarySchema.parse(product), meta: { locale } });
    }),
  );

  app.get(
    "/v1/products/:barcode/nutrition",
    asyncRoute(async (request, response) => {
      const user = await requireSessionUser(request);
      const subscription = await repository.findSubscription(user.id);
      if (!canViewNutrition(subscription)) throw new AppError(ErrorCode.SubscriptionRequired, 403);
      const barcode = barcodeParam(request.params.barcode);
      const nutrition = await gateway.getNutrition(barcode);
      if (!nutrition) throw new AppError(ErrorCode.NotFound, 404);
      setNoStore(response, true);
      response.status(200).json({ data: NutritionDetailsSchema.parse(nutrition), meta: {} });
    }),
  );

  app.get(
    "/v1/entitlements",
    asyncRoute(async (request, response) => {
      const user = await requireSessionUser(request);
      const entitlement = EntitlementSchema.parse(toEntitlement(await repository.findSubscription(user.id)));
      setNoStore(response, true);
      response.status(200).json({ data: entitlement, meta: {} });
    }),
  );

  app.post(
    "/v1/billing/checkout",
    asyncRoute(async (request, response) => {
      const user = await requireSessionUser(request);
      const locale = parseBodyLocale(request.body);
      const subscription = await repository.findSubscription(user.id);
      if (canViewNutrition(subscription)) throw new AppError(ErrorCode.AlreadySubscribed, 409);
      if (!config.stripePriceId) throw new AppError(ErrorCode.CheckoutUnavailable, 503);

      try {
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          customerId = await stripe.createCustomer({ email: user.email, metadata: { demoUserId: user.id } });
          await repository.setStripeCustomerId(user.id, customerId);
        }
        const checkout = await stripe.createCheckoutSession({
          customerId,
          priceId: config.stripePriceId,
          locale,
          successUrl: `${config.appOrigin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${config.appOrigin}/${locale}/checkout/cancel`,
        });
        setNoStore(response);
        response.status(200).json({ data: checkout, meta: {} });
      } catch {
        throw new AppError(ErrorCode.CheckoutUnavailable, 503);
      }
    }),
  );

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const appError = isAppError(error) ? error : new AppError(ErrorCode.InternalError, 500, undefined, false);
    if (appError.status >= 500 && !appError.expose) {
      // Deliberately avoid logging request bodies, cookies, or upstream payloads.
      console.error(JSON.stringify({ code: appError.code }));
    }
    setNoStore(response, appError.status === 401 || appError.status === 403);
    response.status(appError.status).json({
      error: {
        code: appError.code,
        messageKey: messageKeyForCode(appError.code),
      },
    });
  };
  app.use(errorHandler);

  return app;
}

export { API_ERROR_MESSAGE_KEYS };
