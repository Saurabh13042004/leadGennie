import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // All logging goes through lib/log.ts (structured JSON, secret-redacting).
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["lib/log.ts"],
    rules: { "no-console": "error" },
  },
  {
    // Gennie's agent core proposes and drives; it must not reach the database, the research service, the job
    // queue or any server action directly. Everything it touches arrives through the AgentServices ports
    // (lib/agent/tools/types.ts), implemented outside this folder. Also asserted by tests/unit/agent-boundaries.test.ts.
    files: ["lib/agent/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/lib/db", "@/lib/db/*"], message: "lib/agent may not import the database layer — use an AgentServices port." },
          { group: ["@/lib/domain/*", "@/lib/intelligence/*", "@/lib/jobs/*", "@/lib/actions/*", "@/lib/email/*", "@/lib/campaigns/*", "@/lib/compliance"], message: "lib/agent is a pure core — depend on ports, not services (and it can never send email)." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app: the Python Intelligence Engine (its venv contains thousands of JS files
    // from dependencies). It has its own toolchain: `npm run verify:engine`.
    "services/**",
  ]),
]);

export default eslintConfig;
