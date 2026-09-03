import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageManifest {
  scripts?: Record<string, string>;
}

interface VercelConfig {
  builds?: Array<{ src?: string; use?: string }>;
  routes?: Array<{ src?: string; dest?: string }>;
}

function readManifest(relativePath: string): PackageManifest {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as PackageManifest;
}

describe("clean Vercel monorepo builds", () => {
  it.each(["apps/api/package.json", "apps/web/package.json"])(
    "%s builds the shared contracts package first",
    (manifestPath) => {
      const manifest = readManifest(manifestPath);

      expect(manifest.scripts?.prebuild).toBe("corepack pnpm --filter @foodiesfeed/contracts build");
    },
  );

  it("builds shared contracts before Vercel traces the API function", () => {
    const manifest = readManifest("apps/api/package.json");

    expect(manifest.scripts?.["vercel-build"]).toBe(
      "corepack pnpm run build",
    );
  });

  it("serves the API from the verified TypeScript build output", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "apps/api/vercel.json"), "utf8"),
    ) as VercelConfig;
    const wrapper = readFileSync(resolve(process.cwd(), "apps/api/api/vercel.js"), "utf8");

    expect(config.builds?.[0]).toEqual({ src: "api/vercel.js", use: "@vercel/node" });
    expect(config.routes?.[0]?.dest).toBe("/api/vercel.js");
    expect(wrapper.trim()).toBe('export { default } from "../dist/api/index.js";');
  });

  it("uses Node ESM-safe relative imports in deployed API modules", () => {
    const runtimeModules = [
      "apps/api/api/index.ts",
      "apps/api/prisma/seed.ts",
      "apps/api/src/app.ts",
      "apps/api/src/server.ts",
      "apps/api/src/db/prisma.ts",
      "apps/api/src/integrations/open-food-facts.ts",
      "apps/api/src/integrations/stripe.ts",
      "apps/api/src/modules/query.ts",
    ];
    const unsafeImports = runtimeModules.flatMap((modulePath) => {
      const source = readFileSync(resolve(process.cwd(), modulePath), "utf8");
      const specifiers = [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map(
        (match) => match[1],
      );

      return specifiers
        .filter((specifier): specifier is string => Boolean(specifier) && !specifier.endsWith(".js"))
        .map((specifier) => `${modulePath}: ${specifier}`);
    });

    expect(unsafeImports).toEqual([]);
  });

  it("generates a Node ESM-compatible Prisma client", () => {
    const schema = readFileSync(resolve(process.cwd(), "apps/api/prisma/schema.prisma"), "utf8");

    expect(schema).toMatch(/moduleFormat\s*=\s*"esm"/);
    expect(schema).toMatch(/importFileExtension\s*=\s*"js"/);
  });
});
