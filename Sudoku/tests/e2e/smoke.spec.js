import { test, expect } from "@playwright/test";

test("page loads without console errors and has the app root", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("index.html");
  await expect(page).toHaveTitle("Sudoku");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  expect(errors).toEqual([]);
});
