import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // TODO(phase-0 backlog): LiquidEther is a vendored third-party WebGL effect
    // (untyped three.js internals). Scoped to this one file so the rule stays an
    // error everywhere else; remove once the component is typed or replaced.
    files: ["components/LiquidEther.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // All logging goes through lib/log.ts (structured JSON, secret-redacting).
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["lib/log.ts"],
    rules: { "no-console": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
