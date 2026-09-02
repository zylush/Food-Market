import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    environmentMatchGlobs: [["apps/web/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "packages/contracts/src/**/*.ts",
        "apps/api/src/**/*.ts",
        "apps/web/components/**/*.tsx",
        "apps/web/features/**/*.tsx",
        "apps/web/i18n/**/*.ts",
        "apps/web/lib/**/*.ts",
      ],
      exclude: ["**/*.test.*", "**/types.ts", "**/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
