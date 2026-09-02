import {
  InMemoryRepository,
  PrismaRepository,
  type PrismaLikeClient,
  type RecentSearchRecord,
  type SubscriptionRecord,
  type StripeWebhookEventRecord,
  type UserRecord,
} from "./repository";

describe("recent-search repository", () => {
  it("deduplicates by normalized term and locale and retains the newest ten", async () => {
    const repository = new InMemoryRepository();
    const base = new Date("2026-09-03T00:00:00.000Z");
    for (let index = 0; index < 11; index += 1) {
      await repository.upsertRecentSearch({
        userId: "demo-user-0001",
        displayTerm: `Term ${index}`,
        normalizedTerm: `term-${index}`,
        locale: "en",
        searchedAt: new Date(base.getTime() + index * 1000),
      });
    }
    await repository.upsertRecentSearch({
      userId: "demo-user-0001",
      displayTerm: "Newest cocoa",
      normalizedTerm: "term-5",
      locale: "en",
      searchedAt: new Date(base.getTime() + 20_000),
    });

    const searches = await repository.listRecentSearches("demo-user-0001", 10);
    expect(searches).toHaveLength(10);
    expect(searches[0]?.displayTerm).toBe("Newest cocoa");
    expect(searches.filter((search) => search.normalizedTerm === "term-5")).toHaveLength(1);
    expect(searches.some((search) => search.normalizedTerm === "term-0")).toBe(false);
  });
});

describe("webhook repository", () => {
  it("makes event recording and subscription replacement idempotent", async () => {
    const repository = new InMemoryRepository({ demoUser: { stripeCustomerId: "cus_demo" } });
    const event = {
      id: "evt_demo",
      userId: "demo-user-0001",
      type: "customer.subscription.updated",
      stripeCreatedAt: new Date("2026-09-03T00:00:00.000Z"),
      processedAt: new Date("2026-09-03T00:00:01.000Z"),
    };
    const snapshot = {
      stripeSubscriptionId: "sub_demo",
      stripePriceId: "price_demo",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      syncedAt: new Date("2026-09-03T00:00:01.000Z"),
    };

    expect((await repository.reconcileWebhook({ event, userId: "demo-user-0001", snapshot })).duplicate).toBe(false);
    const duplicate = await repository.reconcileWebhook({ event, userId: "demo-user-0001", snapshot: { ...snapshot, status: "canceled" } });
    expect(duplicate.duplicate).toBe(true);
    expect((await repository.findSubscription("demo-user-0001"))?.status).toBe("active");
  });
});

describe("PrismaRepository", () => {
  function createFakePrisma() {
    const now = new Date("2026-09-03T00:00:00.000Z");
    const user: UserRecord = {
      id: "demo-user-0001",
      email: "demo@foodiesfeed.local",
      stripeCustomerId: "cus_demo",
      createdAt: now,
      updatedAt: now,
    };
    const subscription: SubscriptionRecord = {
      id: "subscription-0001",
      userId: user.id,
      stripeSubscriptionId: "sub_demo",
      stripePriceId: "price_demo",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const recent: RecentSearchRecord = {
      id: "recent-0001",
      userId: user.id,
      displayTerm: "Cocoa",
      normalizedTerm: "cocoa",
      locale: "en",
      searchedAt: now,
    };
    const event: StripeWebhookEventRecord = {
      id: "evt_demo",
      userId: user.id,
      type: "customer.subscription.updated",
      stripeCreatedAt: now,
      processedAt: now,
    };

    const eventFindUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(event);
    const subscriptionFindUnique = vi.fn().mockResolvedValue(subscription);
    const client = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue({ ...user, stripeCustomerId: "cus_new" }),
      },
      subscription: {
        findUnique: subscriptionFindUnique,
        upsert: vi.fn().mockResolvedValue(subscription),
      },
      recentSearch: {
        upsert: vi.fn().mockResolvedValue(recent),
        findMany: vi.fn().mockResolvedValue([recent]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      stripeWebhookEvent: {
        findUnique: eventFindUnique,
        create: vi.fn().mockResolvedValue(event),
      },
    } as unknown as PrismaLikeClient;
    client.$transaction = vi.fn(async (callback) => callback(client));

    return { client, user, subscription, recent, event, subscriptionFindUnique };
  }

  it("maps user, subscription, and recent-search operations to Prisma delegates", async () => {
    const { client, user, subscription, recent } = createFakePrisma();
    const repository = new PrismaRepository(client);

    await expect(repository.findDemoUser(user.email)).resolves.toEqual(user);
    await expect(repository.findUserById(user.id)).resolves.toEqual(user);
    await expect(repository.findUserByStripeCustomerId("cus_demo")).resolves.toEqual(user);
    await expect(repository.setStripeCustomerId(user.id, "cus_new")).resolves.toMatchObject({ stripeCustomerId: "cus_new" });
    await expect(repository.findSubscription(user.id)).resolves.toEqual(subscription);

    await repository.upsertRecentSearch({
      userId: user.id,
      displayTerm: "Cocoa",
      normalizedTerm: "cocoa",
      locale: "en",
      searchedAt: recent.searchedAt,
    });
    await expect(repository.listRecentSearches(user.id, 10)).resolves.toEqual([recent]);

    expect(client.$transaction).toHaveBeenCalled();
    expect(client.recentSearch.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_normalizedTerm_locale: { userId: user.id, normalizedTerm: "cocoa", locale: "en" } },
      create: expect.objectContaining({ displayTerm: "Cocoa" }),
    }));
    expect(client.recentSearch.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, id: { notIn: [recent.id] } },
    });
  });

  it("records a webhook and returns duplicate deliveries without a second upsert", async () => {
    const { client, user, subscription, event, subscriptionFindUnique } = createFakePrisma();
    const repository = new PrismaRepository(client);
    subscriptionFindUnique
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subscription);
    const snapshot = {
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripePriceId: subscription.stripePriceId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      syncedAt: subscription.syncedAt,
    };

    await expect(repository.reconcileWebhook({ event, userId: user.id, snapshot }))
      .resolves.toMatchObject({ duplicate: false, subscription });
    await expect(repository.reconcileWebhook({ event, userId: user.id, snapshot: { ...snapshot, status: "canceled" } }))
      .resolves.toMatchObject({ duplicate: true, subscription });

    expect(client.stripeWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(client.subscription.upsert).toHaveBeenCalledTimes(1);
  });
});
