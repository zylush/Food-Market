import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { createPrismaClient } from "./prisma";
import {
  PrismaRepository,
  type PrismaLikeClient,
} from "./repository";

loadDotenv({ path: resolve(process.cwd(), "apps/api/.env"), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const parsedTestUrl = new URL(testDatabaseUrl);
const testDatabaseName = decodeURIComponent(
  parsedTestUrl.pathname.replace(/^\/+/, ""),
);

if (
  parsedTestUrl.protocol !== "mysql:" ||
  !["localhost", "127.0.0.1"].includes(parsedTestUrl.hostname) ||
  testDatabaseName !== "foodiesfeed_test"
) {
  throw new Error(
    "TEST_DATABASE_URL must target the dedicated local foodiesfeed_test MySQL database",
  );
}

const childEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  DEMO_USER_EMAIL: "demo@foodiesfeed.local",
};

function runApiTool(arguments_: string[]): void {
  const corepackCli = resolve(
    dirname(process.execPath),
    "node_modules/corepack/dist/corepack.js",
  );
  const executable = existsSync(corepackCli) ? process.execPath : "corepack";
  const corepackArguments = [
    ...(existsSync(corepackCli) ? [corepackCli] : []),
    "pnpm",
    "--filter",
    "@foodiesfeed/api",
    "exec",
    ...arguments_,
  ];
  const result = spawnSync(
    executable,
    corepackArguments,
    {
      cwd: process.cwd(),
      env: childEnvironment,
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  if (result.status !== 0) {
    const password = decodeURIComponent(parsedTestUrl.password);
    const safeError = String(result.stderr || result.stdout || "unknown error")
      .replaceAll(password, "[REDACTED]")
      .replace(/mysql:\/\/\S+/gu, "mysql://[REDACTED]")
      .trim();
    throw new Error(`Database integration command failed: ${safeError}`);
  }
}

const prisma = createPrismaClient(testDatabaseUrl);
const repository = new PrismaRepository(
  prisma as unknown as PrismaLikeClient,
);

describe.sequential("PrismaRepository against clean local MySQL", () => {
  beforeAll(async () => {
    await prisma.$disconnect();
    runApiTool(["prisma", "migrate", "reset", "--force"]);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.stripeWebhookEvent.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.recentSearch.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: {
        id: "demo-user-0001",
        email: "demo@foodiesfeed.local",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("applies the committed migration to an exact clean table set", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'foodiesfeed_test' ORDER BY TABLE_NAME",
    );
    const migrations = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE migration_name = '20260903000000_init' AND finished_at IS NOT NULL",
    );

    expect(tables.map(({ name }) => name.toLowerCase()).sort()).toEqual([
      "_prisma_migrations",
      "recentsearch",
      "stripewebhookevent",
      "subscription",
      "user",
    ]);
    expect(Number(migrations[0]?.count)).toBe(1);
  });

  it("runs the real seed twice without duplicating the demo user", async () => {
    runApiTool(["tsx", "prisma/seed.ts"]);
    runApiTool(["tsx", "prisma/seed.ts"]);

    await expect(
      prisma.user.count({
        where: {
          id: "demo-user-0001",
          email: "demo@foodiesfeed.local",
        },
      }),
    ).resolves.toBe(1);
  });

  it("deduplicates recent terms and retains the newest ten", async () => {
    const base = new Date("2026-09-03T00:00:00.000Z");
    for (let index = 0; index < 11; index += 1) {
      await repository.upsertRecentSearch({
        userId: "demo-user-0001",
        displayTerm: `Term ${index}`,
        normalizedTerm: `term-${index}`,
        locale: "en",
        searchedAt: new Date(base.getTime() + index * 1_000),
      });
    }
    await repository.upsertRecentSearch({
      userId: "demo-user-0001",
      displayTerm: "Newest cocoa",
      normalizedTerm: "term-5",
      locale: "en",
      searchedAt: new Date(base.getTime() + 20_000),
    });

    const searches = await repository.listRecentSearches(
      "demo-user-0001",
      20,
    );
    expect(searches).toHaveLength(10);
    expect(searches[0]?.displayTerm).toBe("Newest cocoa");
    expect(
      searches.filter(({ normalizedTerm }) => normalizedTerm === "term-5"),
    ).toHaveLength(1);
    expect(
      searches.some(({ normalizedTerm }) => normalizedTerm === "term-0"),
    ).toBe(false);
  });

  it("persists one subscription and one event for duplicate webhooks", async () => {
    await repository.setStripeCustomerId("demo-user-0001", "cus_mysql_test");
    const timestamp = new Date("2026-09-03T00:00:00.000Z");
    const event = {
      id: "evt_mysql_test",
      userId: "demo-user-0001",
      type: "customer.subscription.updated",
      stripeCreatedAt: timestamp,
      processedAt: timestamp,
    };
    const snapshot = {
      stripeSubscriptionId: "sub_mysql_test",
      stripePriceId: "price_mysql_test",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      syncedAt: timestamp,
    };

    await expect(
      repository.reconcileWebhook({
        event,
        userId: "demo-user-0001",
        snapshot,
      }),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      repository.reconcileWebhook({
        event,
        userId: "demo-user-0001",
        snapshot: { ...snapshot, status: "canceled" },
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      subscription: { status: "active" },
    });

    await expect(prisma.subscription.count()).resolves.toBe(1);
    await expect(prisma.stripeWebhookEvent.count()).resolves.toBe(1);
  });
});
