import { test, expect } from "@playwright/test";
import { openTool } from "./helpers.js";

const CONTROLS = ["#seed", "#depth", "#map", "#in-h0", "#in-sw", "#shuffle", "#reset", "#undo", "#preview", "#edit-anchors", "#suggest", "#clear-anchors", "#copy"];

test("no horizontal scrolling, the board is on screen, every control can be reached", async ({ page }) => {
  for (const query of ["", "?depth=5", "?seed=half&depth=2"]) {
    await openTool(page, query);
    const r = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
      board: (() => { const b = document.querySelector("#board").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()
    }));
    expect(r.scrollW, query).toBeLessThanOrEqual(r.innerW);
    expect(r.board.w).toBeGreaterThan(200);
    expect(r.board.h).toBeGreaterThan(200);
    expect(r.board.x).toBeGreaterThanOrEqual(0);
    expect(r.board.x + r.board.w).toBeLessThanOrEqual(r.innerW + 1);
    for (const sel of CONTROLS) {
      const el = page.locator(sel);
      await el.scrollIntoViewIfNeeded();
      await expect(el, sel).toBeVisible();
      const box = await el.boundingBox();
      expect(box.x, sel).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, sel).toBeLessThanOrEqual(r.innerW + 1);
    }
  }
});

test("the layout follows the orientation: panel beside the board when wide and landscape, below it otherwise", async ({ page }) => {
  await openTool(page);
  const { w, h } = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const board = await page.locator("#board").boundingBox();
  const panel = await page.locator(".panel").boundingBox();
  if (w > h && w >= 700) {
    expect(panel.x).toBeGreaterThanOrEqual(board.x + board.width - 1);
  } else {
    expect(panel.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
  }
});

test("buttons and sliders are big enough to touch", async ({ page }) => {
  await openTool(page);
  for (const sel of ["#shuffle", "#reset", "#undo", "#preview", "#edit-anchors", "#suggest", "#clear-anchors", "#copy", "#seed", "#depth", "#map"]) {
    const box = await page.locator(sel).boundingBox();
    expect(box.height, sel).toBeGreaterThanOrEqual(40);
  }
  const slider = await page.locator("#in-h0").boundingBox();
  expect(slider.height).toBeGreaterThanOrEqual(24);
});

test("the stage resizes the picture with the window", async ({ page }) => {
  await openTool(page, "?depth=3");
  const size = page.viewportSize();
  const widthOf = async () => (await page.locator("#board").boundingBox()).width;
  const before = await widthOf();
  // a smaller shrink keeps the orientation (a landscape iPad 70% as wide would turn portrait-shaped and stack the panel)
  await page.setViewportSize({ width: Math.round(size.width * 0.85), height: size.height });
  await expect.poll(widthOf).toBeLessThan(before);
  const boxes = await page.$$eval(".tile", (els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.right]; }));
  const board = await page.locator("#board").boundingBox();
  expect(Math.min(...boxes.map((b) => b[0]))).toBeGreaterThanOrEqual(board.x - 1);
  expect(Math.max(...boxes.map((b) => b[1]))).toBeLessThanOrEqual(board.x + board.width + 1);
});
