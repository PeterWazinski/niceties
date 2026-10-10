const { test, expect } = require("@playwright/test");

test("phones get the notice and no board", async ({ page }) => {
  await page.goto("index.html#n=8&seed=1");
  await expect(page.locator("#small-screen")).toBeVisible();
  await expect(page.locator("#small-screen")).toContainText("too small");
  await expect(page.locator("#board")).toBeHidden();
  expect(await page.locator("#board .node").count()).toBe(0);
});
