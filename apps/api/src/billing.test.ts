import request from "supertest";
import { createApp } from "./app";
import { InMemoryRepository } from "./db/repository";
import type { StripeGateway, StripeSubscriptionSnapshot } from "./integrations/stripe";

const fakeSnapshot: StripeSubscriptionSnapshot = {
  stripeSubscriptionId: "sub_demo",
  stripeCustomerId: "cus_demo",
  stripePriceId: "price_server",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  syncedAt: new Date("2026-09-03T00:00:00.000Z"),
};

function fakeStripe(options: { invalidSignature?: boolean; snapshot?: StripeSubscriptionSnapshot } = {}): StripeGateway & {
  checkoutInputs: Array<{ customerId: string; priceId: string; locale: "en" | "nl" | "de" | "fr" }>;
} {
  const checkoutInputs: Array<{ customerId: string; priceId: string; locale: "en" | "nl" | "de" | "fr" }> = [];
  return {
    checkoutInputs,
    createCustomer: vi.fn(async () => "cus_demo"),
    createCheckoutSession: vi.fn(async (input) => {
      checkoutInputs.push({ customerId: input.customerId, priceId: input.priceId, locale: input.locale });
      return { url: "https://checkout.stripe.test/session" };
    }),
    constructEvent: vi.fn(() => {
      if (options.invalidSignature) throw new Error("invalid signature");
      return {
        id: "evt_active",
        type: "customer.subscription.updated",
        created: 1_757_000_000,
        data: { object: { id: "sub_demo", customer: "cus_demo" } },
      };
    }),
    retrieveSubscription: vi.fn(async () => options.snapshot ?? fakeSnapshot),
  };
}

async function establishSession(agent: ReturnType<typeof request.agent>): Promise<void> {
  await agent
    .post("/v1/demo-session")
    .set("Origin", "http://localhost:3000")
    .set("Content-Type", "application/json")
    .send({});
}

describe("Stripe checkout and webhook boundary", () => {
  it("creates a server-configured subscription checkout without trusting client price data", async () => {
    const stripe = fakeStripe();
    const agent = request.agent(createApp({
      repository: new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } }),
      stripe,
      config: {
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
      },
    }));
    await establishSession(agent);

    const response = await agent
      .post("/v1/billing/checkout")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({ priceId: "price_attacker", userId: "attacker", locale: "nl" });

    expect(response.status).toBe(200);
    expect(response.body.data.url).toBe("https://checkout.stripe.test/session");
    expect(stripe.checkoutInputs).toEqual([{ customerId: "cus_demo", priceId: "price_server", locale: "nl" }]);
  });

  it("rejects invalid webhook signatures without changing entitlement", async () => {
    const repository = new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } });
    const stripe = fakeStripe({ invalidSignature: true });
    const response = await request(createApp({ repository, stripe }))
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "bad")
      .send(Buffer.from("{}"));

    expect(response.status).toBe(400);
    expect(await repository.findSubscription("demo-user-0001")).toBeNull();
  });

  it("processes an active webhook once and acknowledges duplicate delivery", async () => {
    const repository = new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } });
    const stripe = fakeStripe();
    const app = createApp({ repository, stripe });
    const first = await request(app)
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));
    const second = await request(app)
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));

    expect(first.status).toBe(200);
    expect(first.body.data.processed).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.data.processed).toBe(false);
    expect((await repository.findSubscription("demo-user-0001"))?.status).toBe("active");
  });

  it("does not grant access for a webhook-reconciled non-active status", async () => {
    const repository = new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } });
    const stripe = fakeStripe({ snapshot: { ...fakeSnapshot, status: "past_due" } });
    const app = createApp({ repository, stripe });
    await request(app)
      .post("/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid")
      .send(Buffer.from("{}"));

    const agent = request.agent(app);
    await establishSession(agent);
    const response = await agent.get("/v1/products/1234567890123/nutrition");
    expect(response.status).toBe(403);
    expect((await repository.findSubscription("demo-user-0001"))?.status).toBe("past_due");
  });
});
