import { loadConfig } from "./config";

describe("configuration", () => {
  const productionEnv = {
    NODE_ENV: "production",
    APP_ORIGIN: "https://foodiesfeed-web.vercel.app",
    DATABASE_URL: "mysql://foodiesfeed:password@tidb.example:4000/foodiesfeed?sslaccept=strict",
    SESSION_SECRET: "a".repeat(32),
    STRIPE_SECRET_KEY: "sk_test_demo",
    STRIPE_WEBHOOK_SECRET: "whsec_demo",
    STRIPE_PRICE_ID: "price_demo",
  };

  it("loads safe defaults and normalizes the application origin", () => {
    expect(loadConfig({})).toMatchObject({
      appOrigin: "http://localhost:3000",
      demoUserEmail: "demo@foodiesfeed.local",
      sessionCookieName: "foodiesfeed_demo",
      cookieSecure: false,
      nodeEnv: "development",
    });
    expect(loadConfig({ ...productionEnv, APP_ORIGIN: "https://foodiesfeed.example/" }))
      .toMatchObject({ appOrigin: "https://foodiesfeed.example", cookieSecure: true });
  });

  it("rejects a short production session secret", () => {
    expect(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "too-short" })).toThrow("at least 32");
  });

  it("fails fast when production is not fully configured for HTTPS and Stripe test mode", () => {
    expect(() => loadConfig({ ...productionEnv, APP_ORIGIN: "http://foodiesfeed.example" })).toThrow("HTTPS");
    expect(() => loadConfig({ ...productionEnv, DATABASE_URL: "" })).toThrow("DATABASE_URL");
    expect(() => loadConfig({ ...productionEnv, STRIPE_SECRET_KEY: "sk_live_forbidden" })).toThrow("test mode");
    expect(() => loadConfig({ ...productionEnv, STRIPE_WEBHOOK_SECRET: "" })).toThrow("STRIPE_WEBHOOK_SECRET");
    expect(() => loadConfig({ ...productionEnv, STRIPE_PRICE_ID: "" })).toThrow("STRIPE_PRICE_ID");
  });
});
