import { loadConfig } from "./config";

describe("configuration", () => {
  it("loads safe defaults and normalizes the application origin", () => {
    expect(loadConfig({})).toMatchObject({
      appOrigin: "http://localhost:3000",
      demoUserEmail: "demo@foodiesfeed.local",
      sessionCookieName: "foodiesfeed_demo",
      cookieSecure: false,
      nodeEnv: "development",
    });
    expect(loadConfig({ APP_ORIGIN: "https://foodiesfeed.example/", NODE_ENV: "production", SESSION_SECRET: "a".repeat(32) }))
      .toMatchObject({ appOrigin: "https://foodiesfeed.example", cookieSecure: true });
  });

  it("rejects a short production session secret", () => {
    expect(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "too-short" })).toThrow("at least 32");
  });
});
