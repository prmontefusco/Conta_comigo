import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Firestore Security Rules tests.
 *
 * These run against the Firestore emulator via @firebase/rules-unit-testing.
 * They are deliberately separate from the unit suite: they are slower, they
 * need `npm run emulators` (or `npm run test:rules`, which starts one for you),
 * and they must never be silently skipped.
 */
export default defineConfig({
  resolve: {
    alias: { "@": `${root}src` },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    passWithNoTests: false,
  },
});
