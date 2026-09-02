import request from "supertest";
import { createApp } from "./app";
import { InMemoryRepository } from "./db/repository";
import type { OpenFoodFactsGateway } from "./integrations/open-food-facts";
import type { NutritionDetails } from "@foodiesfeed/contracts";

const gateway: OpenFoodFactsGateway = {
  search: async () => [
    {
      barcode: "1234567890123",
      name: "Cocoa spread",
      brand: "Acme",
      imageUrl: null,
      displayLanguage: "en",
      usedLanguageFallback: false,
      sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
    },
  ],
  getPublicProduct: async () => null,
  getNutrition: async () => null,
};

describe("Express API foundation", () => {
  it("returns a shallow health response with no secrets", async () => {
    const response = await request(createApp({ gateway, repository: new InMemoryRepository() }))
      .get("/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toEqual({ data: { status: "ok" }, meta: {} });
  });

  it("rejects invalid search input before calling the gateway", async () => {
    const search = vi.fn(gateway.search);
    const response = await request(
      createApp({ gateway: { ...gateway, search }, repository: new InMemoryRepository() }),
    )
      .post("/v1/searches")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({ query: "x", locale: "en" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(search).not.toHaveBeenCalled();
  });

  it("returns an explicit public allowlist without nutrition fields", async () => {
    const response = await request(
      createApp({ gateway, repository: new InMemoryRepository() }),
    )
      .post("/v1/searches")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({ query: "cocoa", locale: "en" });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({
      barcode: "1234567890123",
      name: "Cocoa spread",
      brand: "Acme",
      imageUrl: null,
      displayLanguage: "en",
      usedLanguageFallback: false,
      sourceUrl: "https://world.openfoodfacts.org/product/1234567890123",
    });
    expect(response.body.data[0]).not.toHaveProperty("nutriments");
  });

  it("establishes a signed demo session and stores accepted searches", async () => {
    const agent = request.agent(createApp({ gateway, repository: new InMemoryRepository() }));
    const session = await agent
      .post("/v1/demo-session")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({});
    expect(session.status).toBe(200);
    expect(session.headers["set-cookie"]?.[0]).toContain("HttpOnly");

    const search = await agent
      .post("/v1/searches")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({ query: "cocoa", locale: "en" });
    expect(search.status).toBe(200);

    const recent = await agent.get("/v1/searches/recent");
    expect(recent.status).toBe(200);
    expect(recent.body.data).toHaveLength(1);
    expect(recent.body.data[0]).toMatchObject({ normalizedTerm: "cocoa", locale: "en" });
  });

  it.each(["incomplete", "incomplete_expired", "past_due", "unpaid", "paused", "canceled"])(
    "denies nutrition for %s persisted status before the upstream call",
    async (status) => {
      const nutrition = vi.fn<() => Promise<NutritionDetails>>(async () => ({
        basis: "100g",
        servingSize: null,
        energyKj: 1,
        energyKcal: 1,
        fatG: null,
        saturatedFatG: null,
        carbohydratesG: null,
        sugarsG: null,
        fibreG: null,
        proteinG: null,
        saltG: null,
        sodiumG: null,
      }));
      const agent = request.agent(
        createApp({
          gateway: { ...gateway, getNutrition: nutrition },
          repository: new InMemoryRepository({ subscription: { status } }),
        }),
      );
      await agent
        .post("/v1/demo-session")
        .set("Origin", "http://localhost:3000")
        .set("Content-Type", "application/json")
        .send({});

      const response = await agent.get("/v1/products/1234567890123/nutrition");
      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
      expect(response.body).not.toHaveProperty("data.energyKj");
      expect(nutrition).not.toHaveBeenCalled();
    },
  );

  it("returns approved nutrition privately for an active persisted status", async () => {
    const activeNutrition: NutritionDetails = {
      basis: "100g",
      servingSize: "30 g",
      energyKj: 1800,
      energyKcal: 430,
      fatG: 12,
      saturatedFatG: null,
      carbohydratesG: null,
      sugarsG: null,
      fibreG: null,
      proteinG: null,
      saltG: null,
      sodiumG: null,
    };
    const nutrition = vi.fn(async () => activeNutrition);
    const agent = request.agent(
      createApp({
        gateway: { ...gateway, getNutrition: nutrition },
        repository: new InMemoryRepository({ subscription: { status: "active" } }),
      }),
    );
    await agent
      .post("/v1/demo-session")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({});

    const response = await agent.get("/v1/products/1234567890123/nutrition");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data).toEqual(activeNutrition);
    expect(response.body.data).not.toHaveProperty("product_name");
  });

  it("rejects state-changing requests from an unapproved origin", async () => {
    const response = await request(createApp({ gateway, repository: new InMemoryRepository() }))
      .post("/v1/demo-session")
      .set("Origin", "https://evil.example")
      .set("Content-Type", "application/json")
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});
