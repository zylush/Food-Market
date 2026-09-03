import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@foodiesfeed/contracts": path.resolve(process.cwd(), "packages/contracts/src/index.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    include: [
      "packages/**/*.test.ts",
      "apps/api/**/*.test.ts",
      "apps/web/**/*.test.ts",
      "apps/web/**/*.test.tsx",
    ],
    exclude: [...configDefaults.exclude, "apps/api/**/*.db.test.ts"],
    environmentMatchGlobs: [["apps/web/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "packages/contracts/src/**/*.ts",
        "apps/api/src/**/*.ts",
        "apps/web/components/**/*.tsx",
        "apps/web/features/**/*.ts",
        "apps/web/i18n/**/*.ts",
        "apps/web/lib/**/*.ts",
      ],
      exclude: [
        "**/*.test.*",
        "**/types.ts",
        "apps/api/src/server.ts",
        "apps/web/components/RegisterServiceWorker.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
