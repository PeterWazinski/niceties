const { test, expect, solveByDragging, getState } = require("./helpers");

test("deployed game loads, shows the right puzzle and can be solved", async ({ page }) => {
  await page.goto("./#n=8&seed=42");
  await page.waitForSelector("#board .node");
  await expect(page).toHaveTitle("Untangle Me");
  await expect(page.locator("#board .node")).toHaveCount(8);
  await solveByDragging(page);
  expect((await getState(page)).status).toBe("solved");
});
