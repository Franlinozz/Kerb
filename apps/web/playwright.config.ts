import { defineConfig, devices } from "@playwright/test";

/** E2E against a running Kerb web app: staging by default, a local build in CI (V2-11). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: process.env["KERB_WEB_URL"] ?? "http://127.0.0.1:3301", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
});
