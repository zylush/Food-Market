export interface AppConfig {
  appOrigin: string;
  demoUserEmail: string;
  sessionSecret: string;
  sessionCookieName: string;
  cookieSecure: boolean;
  stripePriceId: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  openFoodFactsBaseUrl: string;
  openFoodFactsUserAgent: string;
  databaseUrl: string;
  nodeEnv: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const sessionSecret = env.SESSION_SECRET ?? "local-only-foodiesfeed-session-secret";
  const appOrigin = (env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/u, "");
  const databaseUrl = env.DATABASE_URL ?? "";
  const stripeSecretKey = env.STRIPE_SECRET_KEY ?? "";
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";
  const stripePriceId = env.STRIPE_PRICE_ID ?? "";
  if (nodeEnv === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  if (nodeEnv === "production") {
    if (!appOrigin.startsWith("https://")) throw new Error("APP_ORIGIN must use HTTPS in production");
    if (!databaseUrl) throw new Error("DATABASE_URL is required in production");
    if (!/^(?:sk|rk)_test_/u.test(stripeSecretKey)) {
      throw new Error("STRIPE_SECRET_KEY must be a Stripe test mode key");
    }
    if (!stripeWebhookSecret.startsWith("whsec_")) {
      throw new Error("STRIPE_WEBHOOK_SECRET is required in production");
    }
    if (!stripePriceId.startsWith("price_")) {
      throw new Error("STRIPE_PRICE_ID is required in production");
    }
  }

  return {
    appOrigin,
    demoUserEmail: env.DEMO_USER_EMAIL ?? "demo@foodiesfeed.local",
    sessionSecret,
    sessionCookieName: "foodiesfeed_demo",
    cookieSecure: nodeEnv === "production",
    stripePriceId,
    stripeSecretKey,
    stripeWebhookSecret,
    openFoodFactsBaseUrl: env.OPEN_FOOD_FACTS_BASE_URL ?? "https://world.openfoodfacts.org",
    openFoodFactsUserAgent: env.OPEN_FOOD_FACTS_USER_AGENT ?? "FoodiesFeed/0.1 (demo@example.invalid)",
    databaseUrl,
    nodeEnv,
  };
}
