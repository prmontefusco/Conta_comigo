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
        resolve: {
          alias: {
            "@": `${root}src`,
            // Fora do bundler do Next, `server-only` lança ao ser importado.
            // Sem este atalho, as barreiras da infraestrutura ficariam sem teste.
            "server-only": `${root}tests/setup/server-only-stub.ts`,
          },
        },
        test: {
          name: "domain",
          globals: true,
          environment: "node",
          include: [
            "src/core/**/*.test.ts",
            "src/lib/**/*.test.ts",
            "src/server/**/*.test.ts",
            "src/modules/**/domain/**/*.test.ts",
            "src/modules/**/application/**/*.test.ts",
            "src/modules/**/infrastructure/**/*.test.ts",
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
