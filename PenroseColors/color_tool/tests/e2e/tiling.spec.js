import { test, expect } from "@playwright/test";
import { openTool, tiles } from "./helpers.js";

const COUNTS = { wheel: [10, 20, 60, 160, 430], half: [4, 9, 28, 77, 210], fan: [2, 5, 16, 45, 124] };

test("every seed and depth draws the expected number of tiles", async ({ page }) => {
  for (const seed of Object.keys(COUNTS)) {
    for (let depth = 1; depth <= 5; depth++) {
      await openTool(page, `?seed=${seed}&depth=${depth}`);
      await expect(page.locator(".tile")).toHaveCount(COUNTS[seed][depth - 1]);
    }
  }
});

test("the patch fits the window without scrolling sideways, at every depth", async ({ page }) => {
  for (const depth of [1, 3, 5]) {
    await openTool(page, `?depth=${depth}`);
    const r = await page.evaluate(() => {
      const board = document.querySelector("#board").getBoundingClientRect();
      const boxes = [...document.querySelectorAll(".tile")].map((e) => e.getBoundingClientRect());
      return {
        left: Math.min(...boxes.map((b) => b.left)) - board.left, right: board.right - Math.max(...boxes.map((b) => b.right)),
        top: Math.min(...boxes.map((b) => b.top)) - board.top, bottom: board.bottom - Math.max(...boxes.map((b) => b.bottom)),
        scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth
      };
    });
    expect(r.left, "left").toBeGreaterThanOrEqual(0);
    expect(r.right, "right").toBeGreaterThanOrEqual(0);
    expect(r.top, "top").toBeGreaterThanOrEqual(0);
    expect(r.bottom, "bottom").toBeGreaterThanOrEqual(0);
    expect(r.scrollW).toBeLessThanOrEqual(r.innerW);
  }
});

test("seed and depth controls redraw the patch and the URL", async ({ page }) => {
  await openTool(page);
  await page.selectOption("#depth", "2");
  await expect(page.locator(".tile")).toHaveCount(20);
  await expect(page).toHaveURL(/depth=2/);
  await page.selectOption("#seed", "half");
  await expect(page.locator(".tile")).toHaveCount(9);
  await expect(page).toHaveURL(/seed=half/);
  await page.selectOption("#depth", "4");
  await expect(page.locator(".tile")).toHaveCount(77);
  await expect(page.locator("#tile-info")).toContainText("77 tiles");
});

test("a large patch warns that it is too big for a puzzle", async ({ page }) => {
  await openTool(page, "?depth=5");
  await expect(page.locator("#tile-info")).toContainText("430 tiles");
  await expect(page.locator("#tile-info")).toContainText("too many for a puzzle");
});

test("the tiles are thick and thin rhombs, all in one picture", async ({ page }) => {
  await openTool(page, "?depth=3");
  const all = await tiles(page);
  expect(all.filter((t) => t.type === "thick")).toHaveLength(35);
  expect(all.filter((t) => t.type === "thin")).toHaveLength(25);
  // each polygon has four corners
  const corners = await page.$$eval(".tile", (els) => els.map((e) => e.getAttribute("points").trim().split(/\s+/).length));
  expect(new Set(corners)).toEqual(new Set([4]));
});

test("bad URL parameters fall back to the defaults", async ({ page }) => {
  await openTool(page, "?seed=nope&depth=99&map=x&h0=abc");
  await expect(page.locator(".tile")).toHaveCount(430); // depth clamped to 5
  await expect(page.locator("#seed")).toHaveValue("wheel");
  await expect(page.locator("#map")).toHaveValue("plane");
  await expect(page.locator("#in-h0")).toHaveValue("250");
});
