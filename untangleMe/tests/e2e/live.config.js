// Read-only smoke test against the deployed game (GitHub Pages).
// Run with: npm run test:live
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: /live\.spec\.js/,
  timeout: 60000,
  retries: 2,
  reporter: [["list"]],
  use: { baseURL: process.env.LIVE_URL || "https://peterwazinski.github.io/niceties/untangleMe/" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ]
});
