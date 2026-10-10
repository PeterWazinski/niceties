const { test } = require("@playwright/test");
const { expect, openPuzzle, dragNodeTo, getState, solveByDragging } = require("./helpers");

test("loads the default puzzle with n nodes and a seed in the URL", async ({ page }) => {
  const errors = await openPuzzle(page);
  await expect(page.locator("#board .node")).toHaveCount(8);
  expect(page.url()).toMatch(/#n=8&seed=\d+$/);
  expect(Number(await page.locator("#crossings").textContent())).toBeGreaterThan(0);
  expect(await page.locator("#moves").textContent()).toBe("0");
  await expect(page).toHaveTitle("Untangle Me");
  expect(errors).toEqual([]);
});

test("URL hash selects the puzzle deterministically", async ({ page }) => {
  await openPuzzle(page, "#n=10&seed=7");
  await expect(page.locator("#board .node")).toHaveCount(10);
  const first = await page.evaluate(() => JSON.stringify(UM.app.getGame().puzzle));
  await page.reload();
  await page.waitForSelector("#board .node");
  const second = await page.evaluate(() => JSON.stringify(UM.app.getGame().puzzle));
  expect(second).toBe(first);
  expect(page.url()).toMatch(/#n=10&seed=7$/);
});

test("invalid hash is repaired and still gives a playable puzzle", async ({ page }) => {
  await openPuzzle(page, "#n=999&seed=abc");
  await expect(page.locator("#board .node")).toHaveCount(30);
  expect(page.url()).toMatch(/#n=30&seed=\d+$/);
});

test("dragging a node moves it, counts a move and starts the timer", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  const before = await getState(page);
  expect(before.status).toBe("idle");
  const target = [before.positions[0][0] > 0.5 ? 0.2 : 0.8, 0.5];
  await dragNodeTo(page, 0, target);
  const after = await getState(page);
  expect(after.status === "playing" || after.status === "solved").toBe(true);
  expect(after.moves).toBe(1);
  expect(Math.abs(after.positions[0][0] - target[0])).toBeLessThan(0.02);
  expect(Math.abs(after.positions[0][1] - target[1])).toBeLessThan(0.02);
  expect(await page.locator("#moves").textContent()).toBe("1");
});

test("dragging all nodes to the solution solves the puzzle", async ({ page }) => {
  const errors = await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  const s = await getState(page);
  expect(s.crossings).toBe(0);
  expect(s.status).toBe("solved");
  expect(await page.locator("#crossings").textContent()).toBe("0");
  await expect(page.locator("html")).toHaveAttribute("data-status", "solved");
  expect(errors).toEqual([]);
});

test("New puzzle gives a different puzzle of the same size", async ({ page }) => {
  await openPuzzle(page, "#n=12&seed=5");
  await page.click("#new-puzzle");
  await expect(page.locator("#board .node")).toHaveCount(12);
  expect(page.url()).toMatch(/#n=12&seed=\d+$/);
  expect(page.url()).not.toMatch(/seed=5$/);
});

test("changing the hash by hand loads that puzzle", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=1");
  await page.evaluate(() => { location.hash = "#n=6&seed=2"; });
  await expect(page.locator("#board .node")).toHaveCount(6);
});

test("the board scales with the viewport", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=1");
  await page.setViewportSize({ width: 1000, height: 800 });
  const wide = (await page.locator("#board").boundingBox()).width;
  await page.setViewportSize({ width: 700, height: 800 });
  const narrow = (await page.locator("#board").boundingBox()).width;
  expect(narrow).toBeLessThan(wide);
  expect(narrow).toBeGreaterThan(400);
});
