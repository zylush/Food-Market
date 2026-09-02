import { PrismaClient } from "../../generated/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaRepository, type PrismaLikeClient, type Repository } from "./repository";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the Prisma repository");
  const adapter = new PrismaMariaDb(databaseUrl, {
    useTextProtocol: true,
  });
  return new PrismaClient({ adapter });
}

export function createPrismaRepository(databaseUrl: string): { repository: Repository; prisma: PrismaClient } {
  const prisma = createPrismaClient(databaseUrl);
  return { prisma, repository: new PrismaRepository(prisma as unknown as PrismaLikeClient) };
}
