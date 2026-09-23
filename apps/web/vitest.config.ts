import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests only: the Playwright suite in e2e/ runs with `pnpm e2e` against a running app.
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  esbuild: { jsx: "automatic" },
  test: { include: ["test/**/*.test.ts", "test/**/*.test.tsx", "src/**/*.test.ts"], exclude: ["e2e/**", "node_modules/**"] },
});
