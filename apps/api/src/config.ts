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
  if (nodeEnv === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }

  return {
    appOrigin: (env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/u, ""),
    demoUserEmail: env.DEMO_USER_EMAIL ?? "demo@foodiesfeed.local",
    sessionSecret,
    sessionCookieName: "foodiesfeed_demo",
    cookieSecure: nodeEnv === "production",
    stripePriceId: env.STRIPE_PRICE_ID ?? "",
    stripeSecretKey: env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    openFoodFactsBaseUrl: env.OPEN_FOOD_FACTS_BASE_URL ?? "https://world.openfoodfacts.org",
    openFoodFactsUserAgent: env.OPEN_FOOD_FACTS_USER_AGENT ?? "FoodiesFeed/0.1 (demo@example.invalid)",
    databaseUrl: env.DATABASE_URL ?? "",
    nodeEnv,
  };
}
