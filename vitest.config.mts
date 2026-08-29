import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Unit + component tests.
 *
 * The financial domain runs in a plain Node environment with no Firebase in
 * sight (see ADR-0004); React components run in jsdom. Security Rules tests
 * live in `vitest.rules.config.mts` because they need a running emulator.
 */
export default defineConfig({
  resolve: {
    alias: { "@": `${root}src` },
  },
  test: {
    globals: true,
    passWithNoTests: false,
    projects: [
      {
        resolve: { alias: { "@": `${root}src` } },
        test: {
          name: "domain",
          globals: true,
          environment: "node",
          include: [
            "src/core/**/*.test.ts",
            "src/modules/**/domain/**/*.test.ts",
            "src/modules/**/application/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias: { "@": `${root}src` } },
        test: {
          name: "ui",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./tests/setup/ui.setup.ts"],
          include: ["src/**/*.test.tsx", "src/**/ui/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/core/**", "src/modules/**/domain/**", "src/modules/**/application/**"],
      exclude: ["**/*.test.ts", "**/index.ts"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
