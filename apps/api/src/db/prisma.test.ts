import { describe, expect, it } from "vitest";
import { parseMariaDbConnectionUrl } from "./prisma";

describe("parseMariaDbConnectionUrl", () => {
  it("maps TiDB's strict Prisma TLS option into the MariaDB driver", () => {
    expect(
      parseMariaDbConnectionUrl(
        "mysql://foodiesfeed:p%40ss@eu-central-1.example.tidbcloud.com:4000/foodiesfeed?sslaccept=strict",
      ),
    ).toEqual({
      host: "eu-central-1.example.tidbcloud.com",
      port: 4000,
      user: "foodiesfeed",
      password: "p@ss",
      database: "foodiesfeed",
      connectionLimit: 5,
      connectTimeout: 8_000,
      ssl: { rejectUnauthorized: true },
    });
  });

  it("keeps local MySQL connections non-TLS unless explicitly requested", () => {
    expect(parseMariaDbConnectionUrl("mysql://foodiesfeed:local@127.0.0.1:3306/foodiesfeed_dev")).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "foodiesfeed",
      password: "local",
      database: "foodiesfeed_dev",
      connectionLimit: 5,
      connectTimeout: 8_000,
    });
  });

  it("rejects unsupported database schemes and weakened sslaccept modes", () => {
    expect(() => parseMariaDbConnectionUrl("postgresql://localhost/foodiesfeed")).toThrow("MySQL");
    expect(() => parseMariaDbConnectionUrl("mysql://localhost/foodiesfeed?sslaccept=accept_invalid_certs")).toThrow(
      "strict",
    );
  });
});
