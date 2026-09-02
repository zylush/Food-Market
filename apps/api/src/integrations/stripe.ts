import Stripe from "stripe";
import type { Locale } from "@foodiesfeed/contracts";
import type { UserRecord } from "../db/repository";

export interface StripeSubscriptionSnapshot {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  syncedAt: Date;
}

export interface StripeEventRecord {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

export interface StripeGateway {
  createCustomer(input: { email: string; metadata: { demoUserId: string } }): Promise<string>;
  createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    locale: Locale;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  constructEvent(rawBody: Buffer, signature: string): StripeEventRecord;
  retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
}

export class UnavailableStripeGateway implements StripeGateway {
  async createCustomer(): Promise<string> {
    throw new Error("Stripe is not configured");
  }

  async createCheckoutSession(): Promise<{ url: string }> {
    throw new Error("Stripe is not configured");
  }

  constructEvent(): StripeEventRecord {
    throw new Error("Stripe webhook verification is not configured");
  }

  async retrieveSubscription(): Promise<StripeSubscriptionSnapshot> {
    throw new Error("Stripe is not configured");
  }
}

export class StripeApiGateway implements StripeGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string, stripeClient?: Stripe) {
    if (!secretKey || !webhookSecret) throw new Error("Stripe configuration is incomplete");
    this.stripe = stripeClient ?? new Stripe(secretKey, { maxNetworkRetries: 1 });
    this.webhookSecret = webhookSecret;
  }

  async createCustomer(input: { email: string; metadata: { demoUserId: string } }): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: input.email,
      metadata: input.metadata,
    });
    return customer.id;
  }

  async createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    locale: Locale;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: input.locale,
      allow_promotion_codes: false,
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url };
  }

  constructEvent(rawBody: Buffer, signature: string): StripeEventRecord {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    const object = event.data.object;
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      throw new Error("Stripe event object is malformed");
    }
    return {
      id: event.id,
      type: event.type,
      created: event.created,
      data: { object: object as unknown as Record<string, unknown> },
    };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionSnapshot> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price.id ?? "";
    return {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripePriceId: priceId,
      status: subscription.status,
      currentPeriodEnd: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      syncedAt: new Date(),
    };
  }
}

export function customerIdForUser(user: UserRecord): string | null {
  return user.stripeCustomerId;
}
