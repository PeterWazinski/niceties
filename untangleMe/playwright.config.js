const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: true,
  // More parallel browsers made page loads stall on this Windows machine.
  workers: 2,
  // Occasionally a page load stalls ~10 s (test server / WebKit on Windows, not
  // the game). A retry is enough; real failures still fail all attempts.
  retries: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:" + PORT + "/",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node tests/e2e/server.js",
    url: "http://localhost:" + PORT + "/index.html",
    reuseExistingServer: true,
    env: { PORT: String(PORT) }
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /small-screen/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /small-screen/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /small-screen/ },
    { name: "ipad", use: { ...devices["iPad (gen 7) landscape"] }, testIgnore: /small-screen/ },
    { name: "iphone", use: { ...devices["iPhone 13"] }, testMatch: /small-screen/ }
  ]
});
