import request from "supertest";
import type { Locale, NutritionDetails, ProductSummary } from "@foodiesfeed/contracts";
import { createApp } from "./app";
import type { AppConfig } from "./config";
import { InMemoryRepository } from "./db/repository";
import type { OpenFoodFactsGateway } from "./integrations/open-food-facts";
import type { StripeEventRecord, StripeGateway, StripeSubscriptionSnapshot } from "./integrations/stripe";

const config: AppConfig = {
  appOrigin: "http://localhost:3000",
  demoUserEmail: "demo@foodiesfeed.local",
  sessionSecret: "test-session-secret",
  sessionCookieName: "foodiesfeed_demo",
  cookieSecure: false,
  stripePriceId: "price_server",
  stripeSecretKey: "sk_test_placeholder",
  stripeWebhookSecret: "whsec_placeholder",
  openFoodFactsBaseUrl: "https://world.openfoodfacts.org",
  openFoodFactsUserAgent: "FoodiesFeed/test",
  databaseUrl: "",
  nodeEnv: "test",
};

const product: ProductSummary = {
  barcode: "1234567890123",
  name: "Cocoa spread",
  brand: "Acme",
  imageUrl: null,
  displayLanguage: "en",
  usedLanguageFallback: false,
  sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
};

const nutrition: NutritionDetails = {
  basis: "100g",
  servingSize: null,
  energyKj: 1800,
  energyKcal: 430,
  fatG: null,
  saturatedFatG: null,
  carbohydratesG: null,
  sugarsG: null,
  fibreG: null,
  proteinG: null,
  saltG: null,
  sodiumG: null,
};

function gateway(overrides: Partial<OpenFoodFactsGateway> = {}): OpenFoodFactsGateway {
  return {
    search: async () => [product],
    getPublicProduct: async () => product,
    getNutrition: async () => nutrition,
    ...overrides,
  };
}

function snapshot(overrides: Partial<StripeSubscriptionSnapshot> = {}): StripeSubscriptionSnapshot {
  return {
    stripeSubscriptionId: "sub_demo",
    stripeCustomerId: "cus_demo",
    stripePriceId: "price_server",
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    syncedAt: new Date("2026-09-03T00:00:00.000Z"),
    ...overrides,
  };
}

function stripeGateway(event: StripeEventRecord, current = snapshot()): StripeGateway {
  return {
    createCustomer: vi.fn(async () => "cus_created"),
    createCheckoutSession: vi.fn(async () => ({ url: "https://checkout.test/session" })),
    constructEvent: vi.fn(() => event),
    retrieveSubscription: vi.fn(async () => current),
  };
}

function webhookEvent(type: string, object: Record<string, unknown>): StripeEventRecord {
  return {
    id: `evt_${type.replaceAll(".", "_")}`,
    type,
    created: 1_757_000_000,
    data: { object },
  };
}

async function establishSession(agent: ReturnType<typeof request.agent>): Promise<void> {
  await agent
    .post("/v1/demo-session")
    .set("Origin", config.appOrigin)
    .set("Content-Type", "application/json")
    .send({});
}

describe("API edge behavior", () => {
  it("requires JSON state-changing requests and returns unauthorized history without a session", async () => {
    const app = createApp({ config, gateway: gateway(), repository: new InMemoryRepository() });
    const missingJson = await request(app).post("/v1/demo-session").set("Content-Type", "text/plain").send("{}");
    expect(missingJson.status).toBe(415);
    const recent = await request(app).get("/v1/searches/recent");
    expect(recent.status).toBe(401);
    expect(recent.headers["cache-control"]).toBe("private, no-store");
  });

  it("serves public products with a short public cache and rejects bad identifiers", async () => {
    const app = createApp({ config, gateway: gateway(), repository: new InMemoryRepository() });
    const response = await request(app).get("/v1/products/1234567890123?locale=nl");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("public, max-age=60");
    expect(response.body.data).toEqual(product);

    expect((await request(app).get("/v1/products/nope")).status).toBe(400);
    expect((await request(app).get("/v1/products/1234567890123?locale=xx")).status).toBe(400);
    expect((await request(createApp({ config, gateway: gateway({ getPublicProduct: async () => null }), repository: new InMemoryRepository() }))
      .get("/v1/products/1234567890123")).status).toBe(404);
  });

  it("protects entitlement and nutrition routes all the way through the upstream call", async () => {
    const missingNutrition = vi.fn(async () => null);
    const repository = new InMemoryRepository({ subscription: { status: "active" } });
    const agent = request.agent(createApp({ config, gateway: gateway({ getNutrition: missingNutrition }), repository }));
    await establishSession(agent);

    const entitlement = await agent.get("/v1/entitlements");
    expect(entitlement.status).toBe(200);
    expect(entitlement.body.data).toMatchObject({ canViewNutrition: true, subscriptionStatus: "active" });
    expect(entitlement.headers["cache-control"]).toBe("private, no-store");
    expect((await agent.get("/v1/products/invalid/nutrition")).status).toBe(400);
    expect((await agent.get("/v1/products/1234567890123/nutrition")).status).toBe(404);
    expect(missingNutrition).toHaveBeenCalledTimes(1);
  });

  it("uses the persisted server price and creates a customer only when needed", async () => {
    const repository = new InMemoryRepository();
    const stripe = stripeGateway(webhookEvent("ignored", {}));
    const agent = request.agent(createApp({ config, gateway: gateway(), repository, stripe }));
    await establishSession(agent);
    const response = await agent
      .post("/v1/billing/checkout")
      .set("Origin", config.appOrigin)
      .set("Content-Type", "application/json")
      .send({});
    expect(response.status).toBe(200);
    expect(stripe.createCustomer).toHaveBeenCalledWith({ email: "demo@foodiesfeed.local", metadata: { demoUserId: "demo-user-0001" } });
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ priceId: "price_server", locale: "en" }));
    expect((await repository.findUserById("demo-user-0001"))?.stripeCustomerId).toBe("cus_created");
  });

  it("rejects active accounts, missing price configuration, and malformed checkout bodies", async () => {
    const activeAgent = request.agent(createApp({ config, gateway: gateway(), repository: new InMemoryRepository({ subscription: { status: "active" } }) }));
    await establishSession(activeAgent);
    expect((await activeAgent.post("/v1/billing/checkout").set("Content-Type", "application/json").send({ locale: "en" })).status).toBe(409);
    expect((await activeAgent.post("/v1/billing/checkout").set("Content-Type", "application/json").send([])).status).toBe(400);

    const noPriceConfig = { ...config, stripePriceId: "" };
    const noPriceAgent = request.agent(createApp({ config: noPriceConfig, gateway: gateway(), repository: new InMemoryRepository() }));
    await establishSession(noPriceAgent);
    const unavailable = await noPriceAgent.post("/v1/billing/checkout").set("Content-Type", "application/json").send({ locale: "en" });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe("CHECKOUT_UNAVAILABLE");
  });

  it("acknowledges irrelevant webhook deliveries and rejects mismatched snapshots", async () => {
    const irrelevant = webhookEvent("charge.succeeded", {});
    const irrelevantStripe = stripeGateway(irrelevant);
    const irrelevantResponse = await request(createApp({ config, gateway: gateway(), repository: new InMemoryRepository(), stripe: irrelevantStripe }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    expect(irrelevantResponse.body.data).toEqual({ received: true, processed: false });
    expect(irrelevantStripe.retrieveSubscription).not.toHaveBeenCalled();

    const missingFields = webhookEvent("invoice.paid", { customer: "cus_demo" });
    const missingResponse = await request(createApp({ config, gateway: gateway(), repository: new InMemoryRepository(), stripe: stripeGateway(missingFields) }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    expect(missingResponse.body.data.processed).toBe(false);

    const unknownUser = webhookEvent("invoice.paid", { subscription: "sub_demo", customer: "cus_unknown" });
    const unknownResponse = await request(createApp({ config, gateway: gateway(), repository: new InMemoryRepository(), stripe: stripeGateway(unknownUser) }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    expect(unknownResponse.body.data.processed).toBe(false);

    const mismatch = webhookEvent("invoice.paid", { subscription: "sub_demo", customer: "cus_demo" });
    const mismatchResponse = await request(createApp({
      config,
      gateway: gateway(),
      repository: new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } }),
      stripe: stripeGateway(mismatch, snapshot({ stripeSubscriptionId: "sub_other" })),
    }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    expect(mismatchResponse.status).toBe(400);
  });

  it("accepts nested invoice subscription identifiers and never leaks internal errors", async () => {
    const event = webhookEvent("invoice.paid", {
      customer: "cus_demo",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_demo" },
      },
    });
    const repository = new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } });
    const response = await request(createApp({ config, gateway: gateway(), repository, stripe: stripeGateway(event) }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    expect(response.status).toBe(200);
    expect((await repository.findSubscription("demo-user-0001"))?.status).toBe("active");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = createApp({ config, gateway: gateway({ getPublicProduct: async () => { throw new Error("upstream detail"); } }), repository: new InMemoryRepository() });
    const failure = await request(failing).get("/v1/products/1234567890123");
    expect(failure.status).toBe(500);
    expect(failure.body.error.code).toBe("INTERNAL_ERROR");
    expect(failure.body.error).not.toHaveProperty("stack");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("INTERNAL_ERROR"));
    errorSpy.mockRestore();
  });

  it("requires a raw signed webhook body", async () => {
    const app = createApp({ config, gateway: gateway(), repository: new InMemoryRepository(), stripe: stripeGateway(webhookEvent("ignored", {})) });
    expect((await request(app).post("/v1/webhooks/stripe").set("stripe-signature", "valid").send("{}"))).toMatchObject({ status: 400 });
    expect((await request(app).post("/v1/webhooks/stripe").set("Content-Type", "application/json").send(Buffer.from("{}")))).toMatchObject({ status: 400 });
  });
});
