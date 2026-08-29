import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "firebase-export/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // The financial domain must stay free of infrastructure concerns
              // so it can be unit tested entirely in memory (ARCHITECTURE.md, ADR-0004).
              group: ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"],
              importNames: ["*"],
              message:
                "Domain and core layers must not import Firebase. Use the repository ports instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Only infrastructure adapters, the Firebase bootstrap and scripts may touch Firebase.
    files: [
      "src/lib/firebase/**",
      "src/modules/**/infrastructure/**",
      "src/server/**",
      "scripts/**",
      "tests/**",
    ],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
