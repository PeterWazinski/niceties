const { test } = require("@playwright/test");
const { expect, openPuzzle, solveByDragging, dragNodeTo, getState } = require("./helpers");

test("page has a favicon and the title is the game name", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await expect(page).toHaveTitle("Untangle Me");
  const href = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(href).toBe("assets/favicon.svg");
  const res = await page.request.get(new URL(href, page.url()).toString());
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
});

test("solving fires confetti once, shows a check in the title and clears afterwards", async ({ page }) => {
  const errors = await openPuzzle(page, "#n=8&seed=42");
  await expect(page.locator("#confetti")).toBeHidden();
  await solveByDragging(page);
  await expect(page.locator("#confetti")).toBeVisible();
  await expect(page.locator("#confetti")).toHaveAttribute("data-fired", "1");
  await expect(page).toHaveTitle("✓ Untangle Me");

  // Fiddling around after solving must not fire it again.
  const s = await getState(page);
  await dragNodeTo(page, 0, [s.positions[0][0] > 0.5 ? 0.1 : 0.9, 0.1]);
  await dragNodeTo(page, 0, s.positions[0]);
  await expect(page.locator("#confetti")).toHaveAttribute("data-fired", "1");

  await expect(page.locator("#confetti")).toBeHidden({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test("confetti never appears with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  expect((await getState(page)).status).toBe("solved");
  await expect(page).toHaveTitle("✓ Untangle Me");
  await expect(page.locator("#confetti")).toBeHidden();
  expect(await page.locator("#confetti").getAttribute("data-fired")).toBeNull();
});

test("new puzzle and reset restore the plain title", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  await expect(page).toHaveTitle("✓ Untangle Me");
  await page.click("#reset");
  await expect(page).toHaveTitle("Untangle Me");
  await solveByDragging(page);
  await expect(page).toHaveTitle("✓ Untangle Me");
  await page.click("#new-puzzle");
  await expect(page).toHaveTitle("Untangle Me");
  await expect(page.locator("#confetti")).toBeHidden();
});
