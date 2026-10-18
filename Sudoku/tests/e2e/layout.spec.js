import { test, expect } from "@playwright/test";
import { openGame, isLandscapeLayout } from "./helpers.js";

test.beforeEach(async ({ page }) => { await openGame(page); });

test("the page never scrolls", async ({ page }) => {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    iw: window.innerWidth, ih: window.innerHeight
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
});

test("the board is square and fully inside the viewport", async ({ page }) => {
  const box = await page.locator("#board").boundingBox();
  const { width, height } = page.viewportSize();
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
  // and big enough to be playable: at least 300 px
  expect(box.width).toBeGreaterThanOrEqual(300);
});

test("the board is as large as the layout allows", async ({ page }) => {
  const box = await page.locator("#board").boundingBox();
  const { width, height } = page.viewportSize();
  if (isLandscapeLayout(page)) expect(box.height).toBeGreaterThan(Math.min(height - 48, 700)); // height or panel width limit
  else expect(box.width).toBeGreaterThan(Math.min(width - 32, 640));            // limited by the width (or the 700 px cap)
});

test("number pad: one row in portrait, 3x3 in landscape", async ({ page }) => {
  const rects = await page.$$eval(".num", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  expect(rects).toHaveLength(9);
  const ys = new Set(rects.map((r) => Math.round(r.y))), xs = new Set(rects.map((r) => Math.round(r.x)));
  if (isLandscapeLayout(page)) { expect(ys.size).toBe(3); expect(xs.size).toBe(3); }
  else { expect(ys.size).toBe(1); expect(xs.size).toBe(9); }
});

test("landscape: the panel sits to the right of the board; portrait: below it", async ({ page }) => {
  const board = await page.locator("#board").boundingBox();
  const pad = await page.locator("#numpad").boundingBox();
  if (isLandscapeLayout(page)) expect(pad.x).toBeGreaterThanOrEqual(board.x + board.width);
  else expect(pad.y).toBeGreaterThanOrEqual(board.y + board.height);
});

test("touch targets are large enough", async ({ page }) => {
  for (const sel of ["#hint", "#new-game", "#level", "#scheme"]) {
    const b = await page.locator(sel).boundingBox();
    expect(b.height, sel + " height").toBeGreaterThanOrEqual(44);
    expect(b.width, sel + " width").toBeGreaterThanOrEqual(44);
  }
  for (const b of await page.locator(".num").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(36);
  }
});

test("all controls are visible: title, status, board, hint, pad, new game", async ({ page }) => {
  for (const sel of [".title", "#level", "#mistakes", "#scheme", "#board", "#hint", "#numpad", "#new-game"]) {
    await expect(page.locator(sel)).toBeVisible();
  }
  await expect(page.locator("#mistakes")).toHaveText("0/3");
});

test("form controls use at least 16px text so iOS does not zoom", async ({ page }) => {
  for (const sel of ["#level", "#scheme"]) {
    const px = await page.locator(sel).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
  }
});
