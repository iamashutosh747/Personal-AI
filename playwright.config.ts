import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

// End-to-end tests run the real app against the local test stack and a mock
// Claude API (tests/mock-anthropic.mjs), so they need no keys or network.
const stack = Object.fromEntries(
  execFileSync("node", ["tests/stack/stack.mjs", "--env"])
    .toString()
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node tests/stack/stack.mjs", url: `${stack.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, reuseExistingServer: true, timeout: 120_000 },
    { command: "node tests/mock-anthropic.mjs", port: 54400, reuseExistingServer: true, env: { PORT: "54400" } },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/signin`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...stack,
        NEXT_DIST_DIR: ".next-e2e",
        ALLOWED_EMAILS: "e2e-owner@inner.test",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_BASE_URL: "http://127.0.0.1:54400",
        VOYAGE_API_KEY: "",
      },
    },
  ],
});
