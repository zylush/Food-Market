import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageManifest {
  scripts?: Record<string, string>;
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
});
