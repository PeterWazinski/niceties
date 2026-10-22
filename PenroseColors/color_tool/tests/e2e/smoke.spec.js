import { test, expect } from "@playwright/test";
import { openTool } from "./helpers.js";

test("page loads without console errors and shows the default patch", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await openTool(page);
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator(".tile")).toHaveCount(60); // wheel, depth 3
  await expect(page.locator("#tile-info")).toContainText("60 tiles (35 thick, 25 thin)");
  expect(errors).toEqual([]);
});
