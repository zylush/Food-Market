import Stripe from "stripe";
import type { UserRecord } from "../db/repository";
import {
  StripeApiGateway,
  UnavailableStripeGateway,
  customerIdForUser,
} from "./stripe";

function fakeStripeClient(options: { customer?: string | { id: string }; url?: string | null } = {}) {
  const client = {
    customers: {
      create: vi.fn(async () => ({ id: "cus_created" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: options.url === undefined ? "https://checkout.test/session" : options.url })),
      },
    },
    webhooks: {
      constructEvent: vi.fn(() => ({
        id: "evt_test",
        type: "customer.subscription.updated",
        created: 1_757_000_000,
        data: { object: { id: "sub_test", customer: "cus_test" } },
      })),
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: "sub_test",
        customer: options.customer ?? "cus_test",
        status: "active",
        cancel_at_period_end: true,
        items: {
          data: [{ price: { id: "price_test" }, current_period_end: 1_757_000_100 }],
        },
      })),
    },
  } as unknown as Stripe;
  return client;
}

describe("StripeApiGateway", () => {
  it("delegates customer, localized subscription checkout, webhook, and subscription reads", async () => {
    const stripeClient = fakeStripeClient();
    const gateway = new StripeApiGateway("sk_test_key", "whsec_test_secret", stripeClient);

    await expect(gateway.createCustomer({ email: "demo@example.test", metadata: { demoUserId: "demo" } }))
      .resolves.toBe("cus_created");
    await expect(gateway.createCheckoutSession({
      customerId: "cus_test",
      priceId: "price_test",
      locale: "nl",
      successUrl: "https://foodiesfeed.test/nl/checkout/success",
      cancelUrl: "https://foodiesfeed.test/nl/checkout/cancel",
    })).resolves.toEqual({ url: "https://checkout.test/session" });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      customer: "cus_test",
      line_items: [{ price: "price_test", quantity: 1 }],
      locale: "nl",
      allow_promotion_codes: false,
    }));

    expect(gateway.constructEvent(Buffer.from("{}"), "signature")).toMatchObject({
      id: "evt_test",
      type: "customer.subscription.updated",
    });
    await expect(gateway.retrieveSubscription("sub_test")).resolves.toMatchObject({
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      stripePriceId: "price_test",
      status: "active",
      cancelAtPeriodEnd: true,
    });
  });

  it("handles object customers and subscriptions without items", async () => {
    const stripeClient = fakeStripeClient({ customer: { id: "cus_object" } });
    const retrieve = stripeClient.subscriptions.retrieve as unknown as {
      mockResolvedValueOnce(value: unknown): void;
    };
    retrieve.mockResolvedValueOnce({
      id: "sub_empty",
      customer: { id: "cus_object" },
      status: "canceled",
      cancel_at_period_end: false,
      items: { data: [] },
    });
    const gateway = new StripeApiGateway("sk_test_key", "whsec_test_secret", stripeClient);

    await expect(gateway.retrieveSubscription("sub_empty")).resolves.toMatchObject({
      stripeCustomerId: "cus_object",
      stripePriceId: "",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  it("rejects incomplete configuration and missing checkout URLs", async () => {
    expect(() => new StripeApiGateway("", "whsec_test_secret")).toThrow("incomplete");
    expect(() => new StripeApiGateway("sk_test_key", "")).toThrow("incomplete");

    const stripeClient = fakeStripeClient({ url: null });
    const gateway = new StripeApiGateway("sk_test_key", "whsec_test_secret", stripeClient);
    await expect(gateway.createCheckoutSession({
      customerId: "cus_test",
      priceId: "price_test",
      locale: "en",
      successUrl: "https://foodiesfeed.test/en/checkout/success",
      cancelUrl: "https://foodiesfeed.test/en/checkout/cancel",
    })).rejects.toThrow("no checkout URL");
  });

  it("maps user customer identifiers and exposes configured-service failures", async () => {
    const user: UserRecord = {
      id: "demo",
      email: "demo@example.test",
      stripeCustomerId: "cus_demo",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(customerIdForUser(user)).toBe("cus_demo");
    expect(customerIdForUser({ ...user, stripeCustomerId: null })).toBeNull();
    const unavailable = new UnavailableStripeGateway();
    await expect(unavailable.createCustomer()).rejects.toThrow("not configured");
    await expect(unavailable.createCheckoutSession()).rejects.toThrow("not configured");
    expect(() => unavailable.constructEvent()).toThrow("not configured");
    await expect(unavailable.retrieveSubscription()).rejects.toThrow("not configured");
  });
});
