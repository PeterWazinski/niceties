import { defineConfig, devices } from "@playwright/test";

const PORT = 4175;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: 2,
  // No retries: a flaky test must be fixed, not rerun (see the working rules).
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:" + PORT + "/color_tool/",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node ../server.mjs",
    url: "http://localhost:" + PORT + "/color_tool/index.html",
    reuseExistingServer: true,
    env: { PORT: String(PORT) }
  },
  // The iOS device descriptors run WebKit, the closest stand-in for Safari.
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "ipad-portrait", use: { ...devices["iPad (gen 7)"] } },
    { name: "ipad-landscape", use: { ...devices["iPad (gen 7) landscape"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }
  ]
});
