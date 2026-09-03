import { createPrismaClient } from "../src/db/prisma.js";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { email: process.env.DEMO_USER_EMAIL ?? "demo@foodiesfeed.local" },
    update: {},
    create: {
      id: "demo-user-0001",
      email: process.env.DEMO_USER_EMAIL ?? "demo@foodiesfeed.local",
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async () => {
    console.error(JSON.stringify({ event: "seed_failed" }));
    await prisma.$disconnect();
    process.exitCode = 1;
  });
