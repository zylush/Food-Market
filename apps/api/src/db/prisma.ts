import { PrismaClient } from "../../generated/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaRepository, type PrismaLikeClient, type Repository } from "./repository.js";

interface MariaDbConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  connectTimeout: number;
  ssl?: { rejectUnauthorized: true };
}

export function parseMariaDbConnectionUrl(databaseUrl: string): MariaDbConnectionConfig {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL URL");
  }
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the MySQL protocol");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL must include a MySQL host and database");
  }

  const sslAccept = url.searchParams.get("sslaccept");
  if (sslAccept && sslAccept !== "strict") {
    throw new Error("DATABASE_URL sslaccept must be strict when provided");
  }
  const sslFlag = url.searchParams.get("ssl");
  if (sslFlag && sslFlag !== "true" && sslFlag !== "false") {
    throw new Error("DATABASE_URL ssl must be true or false when provided");
  }
  const strictTls = sslAccept === "strict" || sslFlag === "true";

  return {
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 5,
    connectTimeout: 8_000,
    ...(strictTls ? { ssl: { rejectUnauthorized: true as const } } : {}),
  };
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the Prisma repository");
  const adapter = new PrismaMariaDb(parseMariaDbConnectionUrl(databaseUrl), {
    useTextProtocol: true,
  });
  return new PrismaClient({ adapter });
}

export function createPrismaRepository(databaseUrl: string): { repository: Repository; prisma: PrismaClient } {
  const prisma = createPrismaClient(databaseUrl);
  return { prisma, repository: new PrismaRepository(prisma as unknown as PrismaLikeClient) };
}
