import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --webpack --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e"
    },
    timeout: 120_000
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
