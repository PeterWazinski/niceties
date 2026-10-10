const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect, solveByDragging, getState, unitToPixel } = require("./helpers");

const fileUrl = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;

// Dispatches a pointer drag (touch or mouse) straight onto a node element.
async function syntheticDrag(page, index, unit, pointerType, moves) {
  const to = await unitToPixel(page, unit);
  return page.evaluate(({ index, to, pointerType, moves }) => {
    const el = document.querySelectorAll("#board .node")[index];
    const r = el.getBoundingClientRect();
    const from = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: pointerType,
      isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y
    }));
    const t0 = performance.now();
    fire("pointerdown", from.x, from.y);
    for (let i = 1; i <= moves; i++) {
      fire("pointermove", from.x + (to.x - from.x) * i / moves, from.y + (to.y - from.y) * i / moves);
    }
    fire("pointerup", to.x, to.y);
    return performance.now() - t0;
  }, { index, to, pointerType, moves });
}

test("works when opened straight from disk (file://, no server)", async ({ page }) => {
  await page.goto(fileUrl + "#n=8&seed=42");
  await page.waitForSelector("#board .node");
  await expect(page.locator("#board .node")).toHaveCount(8);
  await solveByDragging(page);
  expect((await getState(page)).status).toBe("solved");
});

test("touch pointer events drag a node and the board blocks page scrolling", async ({ page }) => {
  await page.goto("index.html#n=8&seed=42");
  await page.waitForSelector("#board .node");
  expect(await page.locator("#board").evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");

  const before = await getState(page);
  const target = [before.positions[0][0] > 0.5 ? 0.2 : 0.8, 0.5];
  await syntheticDrag(page, 0, target, "touch", 10);
  const after = await getState(page);
  expect(after.moves).toBe(1);
  expect(Math.abs(after.positions[0][0] - target[0])).toBeLessThan(0.02);
  expect(Math.abs(after.positions[0][1] - target[1])).toBeLessThan(0.02);
});

test("a 30 node puzzle stays responsive while dragging", async ({ page }) => {
  await page.goto("index.html#n=30&seed=11");
  await page.waitForSelector("#board .node");
  await expect(page.locator("#board .node")).toHaveCount(30);
  const ms = await syntheticDrag(page, 0, [0.5, 0.5], "mouse", 50);
  expect(ms).toBeLessThan(1000);
  expect((await getState(page)).moves).toBe(1);
});

test("the whole control panel is reachable without horizontal scrolling", async ({ page }) => {
  await page.goto("index.html#n=8&seed=1");
  await page.waitForSelector("#board .node");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const sel of ["#new-puzzle", "#reset", "#copy-link", "#theme", "#nodes"]) {
    await expect(page.locator(sel)).toBeVisible();
  }
});
