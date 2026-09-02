import type { Locale } from "@foodiesfeed/contracts";

export interface UserRecord {
  id: string;
  email: string;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecentSearchRecord {
  id: string;
  userId: string;
  displayTerm: string;
  normalizedTerm: string;
  locale: Locale;
  searchedAt: Date;
}

export interface StripeWebhookEventRecord {
  id: string;
  userId: string | null;
  type: string;
  stripeCreatedAt: Date;
  processedAt: Date;
}

export interface SubscriptionSnapshot {
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  syncedAt: Date;
}

export interface Repository {
  findDemoUser(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByStripeCustomerId(stripeCustomerId: string): Promise<UserRecord | null>;
  setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<UserRecord>;
  findSubscription(userId: string): Promise<SubscriptionRecord | null>;
  upsertRecentSearch(input: {
    userId: string;
    displayTerm: string;
    normalizedTerm: string;
    locale: Locale;
    searchedAt: Date;
  }): Promise<void>;
  listRecentSearches(userId: string, limit: number): Promise<RecentSearchRecord[]>;
  reconcileWebhook(input: {
    event: StripeWebhookEventRecord;
    userId: string;
    snapshot: SubscriptionSnapshot;
  }): Promise<{ duplicate: boolean; subscription: SubscriptionRecord }>;
}

export interface PrismaTransactionClient {
  user: {
    findUnique(args: unknown): Promise<UserRecord | null>;
    update(args: unknown): Promise<UserRecord>;
  };
  subscription: {
    findUnique(args: unknown): Promise<SubscriptionRecord | null>;
    upsert(args: unknown): Promise<SubscriptionRecord>;
  };
  recentSearch: {
    upsert(args: unknown): Promise<RecentSearchRecord>;
    findMany(args: unknown): Promise<RecentSearchRecord[]>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  stripeWebhookEvent: {
    findUnique(args: unknown): Promise<StripeWebhookEventRecord | null>;
    create(args: unknown): Promise<StripeWebhookEventRecord>;
  };
}

export interface PrismaLikeClient extends PrismaTransactionClient {
  $transaction<T>(fn: (transaction: PrismaTransactionClient) => Promise<T>): Promise<T>;
}

function cloneUser(user: UserRecord): UserRecord {
  return { ...user };
}

function cloneSubscription(subscription: SubscriptionRecord): SubscriptionRecord {
  return { ...subscription };
}

export class InMemoryRepository implements Repository {
  private readonly users = new Map<string, UserRecord>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private readonly recentSearches: RecentSearchRecord[] = [];
  private readonly webhookEvents = new Map<string, StripeWebhookEventRecord>();

  constructor(options: { demoUser?: Partial<UserRecord>; subscription?: Partial<SubscriptionRecord> } = {}) {
    const now = new Date();
    const demoUser: UserRecord = {
      id: options.demoUser?.id ?? "demo-user-0001",
      email: options.demoUser?.email ?? "demo@foodiesfeed.local",
      stripeCustomerId: options.demoUser?.stripeCustomerId ?? null,
      createdAt: options.demoUser?.createdAt ?? now,
      updatedAt: options.demoUser?.updatedAt ?? now,
    };
    this.users.set(demoUser.id, demoUser);

    if (options.subscription) {
      const subscription: SubscriptionRecord = {
        id: options.subscription.id ?? "subscription-0001",
        userId: options.subscription.userId ?? demoUser.id,
        stripeSubscriptionId: options.subscription.stripeSubscriptionId ?? "sub_demo",
        stripePriceId: options.subscription.stripePriceId ?? "price_demo",
        status: options.subscription.status ?? "active",
        currentPeriodEnd: options.subscription.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: options.subscription.cancelAtPeriodEnd ?? false,
        syncedAt: options.subscription.syncedAt ?? now,
        createdAt: options.subscription.createdAt ?? now,
        updatedAt: options.subscription.updatedAt ?? now,
      };
      this.subscriptions.set(subscription.userId, subscription);
    }
  }

  async findDemoUser(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    return user ? cloneUser(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? cloneUser(user) : null;
  }

  async findUserByStripeCustomerId(stripeCustomerId: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((candidate) => candidate.stripeCustomerId === stripeCustomerId);
    return user ? cloneUser(user) : null;
  }

  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<UserRecord> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const updated = { ...user, stripeCustomerId, updatedAt: new Date() };
    this.users.set(userId, updated);
    return cloneUser(updated);
  }

  async findSubscription(userId: string): Promise<SubscriptionRecord | null> {
    const subscription = this.subscriptions.get(userId);
    return subscription ? cloneSubscription(subscription) : null;
  }

  async upsertRecentSearch(input: {
    userId: string;
    displayTerm: string;
    normalizedTerm: string;
    locale: Locale;
    searchedAt: Date;
  }): Promise<void> {
    const existing = this.recentSearches.find(
      (search) =>
        search.userId === input.userId &&
        search.normalizedTerm === input.normalizedTerm &&
        search.locale === input.locale,
    );
    if (existing) {
      existing.displayTerm = input.displayTerm;
      existing.searchedAt = input.searchedAt;
    } else {
      this.recentSearches.push({ id: `recent-${crypto.randomUUID()}`, ...input });
    }
    this.recentSearches.sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime());
    const userItems = this.recentSearches.filter((search) => search.userId === input.userId);
    for (const item of userItems.slice(10)) {
      const index = this.recentSearches.indexOf(item);
      if (index >= 0) this.recentSearches.splice(index, 1);
    }
  }

  async listRecentSearches(userId: string, limit: number): Promise<RecentSearchRecord[]> {
    return this.recentSearches
      .filter((search) => search.userId === userId)
      .sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime())
      .slice(0, limit)
      .map((search) => ({ ...search }));
  }

  async reconcileWebhook(input: {
    event: StripeWebhookEventRecord;
    userId: string;
    snapshot: SubscriptionSnapshot;
  }): Promise<{ duplicate: boolean; subscription: SubscriptionRecord }> {
    const existingEvent = this.webhookEvents.get(input.event.id);
    const existingSubscription = this.subscriptions.get(input.userId);
    if (existingEvent && existingSubscription) {
      return { duplicate: true, subscription: cloneSubscription(existingSubscription) };
    }

    this.webhookEvents.set(input.event.id, { ...input.event });
    const now = new Date();
    const current = existingSubscription;
    const subscription: SubscriptionRecord = {
      id: current?.id ?? `subscription-${crypto.randomUUID()}`,
      userId: input.userId,
      stripeSubscriptionId: input.snapshot.stripeSubscriptionId,
      stripePriceId: input.snapshot.stripePriceId,
      status: input.snapshot.status,
      currentPeriodEnd: input.snapshot.currentPeriodEnd,
      cancelAtPeriodEnd: input.snapshot.cancelAtPeriodEnd,
      syncedAt: input.snapshot.syncedAt,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.subscriptions.set(input.userId, subscription);
    return { duplicate: false, subscription: cloneSubscription(subscription) };
  }
}

export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaLikeClient) {}

  findDemoUser(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findUserByStripeCustomerId(stripeCustomerId: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { stripeCustomerId } });
  }

  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  }

  findSubscription(userId: string): Promise<SubscriptionRecord | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  async upsertRecentSearch(input: {
    userId: string;
    displayTerm: string;
    normalizedTerm: string;
    locale: Locale;
    searchedAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.recentSearch.upsert({
        where: {
          userId_normalizedTerm_locale: {
            userId: input.userId,
            normalizedTerm: input.normalizedTerm,
            locale: input.locale,
          },
        },
        update: { displayTerm: input.displayTerm, searchedAt: input.searchedAt },
        create: input,
      });
      const keep = await transaction.recentSearch.findMany({
        where: { userId: input.userId },
        orderBy: { searchedAt: "desc" },
        select: { id: true },
        take: 10,
      });
      const ids = keep.map((search) => search.id);
      await transaction.recentSearch.deleteMany({
        where: { userId: input.userId, id: { notIn: ids } },
      });
    });
  }

  async listRecentSearches(userId: string, limit: number): Promise<RecentSearchRecord[]> {
    return this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { searchedAt: "desc" },
      take: limit,
    });
  }

  async reconcileWebhook(input: {
    event: StripeWebhookEventRecord;
    userId: string;
    snapshot: SubscriptionSnapshot;
  }): Promise<{ duplicate: boolean; subscription: SubscriptionRecord }> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.stripeWebhookEvent.findUnique({ where: { id: input.event.id } });
      const existingSubscription = await transaction.subscription.findUnique({ where: { userId: input.userId } });
      if (existing && existingSubscription) {
        return { duplicate: true, subscription: existingSubscription };
      }

      await transaction.stripeWebhookEvent.create({ data: input.event });
      const subscription = await transaction.subscription.upsert({
        where: { userId: input.userId },
        update: {
          stripeSubscriptionId: input.snapshot.stripeSubscriptionId,
          stripePriceId: input.snapshot.stripePriceId,
          status: input.snapshot.status,
          currentPeriodEnd: input.snapshot.currentPeriodEnd,
          cancelAtPeriodEnd: input.snapshot.cancelAtPeriodEnd,
          syncedAt: input.snapshot.syncedAt,
        },
        create: {
          userId: input.userId,
          stripeSubscriptionId: input.snapshot.stripeSubscriptionId,
          stripePriceId: input.snapshot.stripePriceId,
          status: input.snapshot.status,
          currentPeriodEnd: input.snapshot.currentPeriodEnd,
          cancelAtPeriodEnd: input.snapshot.cancelAtPeriodEnd,
          syncedAt: input.snapshot.syncedAt,
        },
      });
      return { duplicate: false, subscription };
    });
  }
}
