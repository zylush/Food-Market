import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@foodiesfeed/contracts": path.resolve(
        process.cwd(),
        "packages/contracts/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    include: ["apps/api/**/*.db.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
