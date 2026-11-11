import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // design-system/ is the design project copied as-is: CSS, assets and the kit's page
  // designs (.jsx layout references that are never imported).
  // public/legacy and public/js are the old /download page and its PostHog
  // snippet, copied unchanged.
  globalIgnores([".next/**", ".vercel/**", "out/**", "build/**", "next-env.d.ts", "design-system/**", "public/**"]),
]);
