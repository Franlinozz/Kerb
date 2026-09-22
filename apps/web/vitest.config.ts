import { defineConfig } from "vitest/config";

// Unit tests only: the Playwright suite in e2e/ runs with `pnpm e2e` against a running app.
export default defineConfig({
  test: { include: ["test/**/*.test.ts", "src/**/*.test.ts"], exclude: ["e2e/**", "node_modules/**"] },
});
