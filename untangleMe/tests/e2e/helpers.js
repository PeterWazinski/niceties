const base = require("@playwright/test");
const expect = base.expect;

// Drop-in replacement for Playwright's `test`: every test fails on page errors
// and console.error output.
const test = base.test.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on("pageerror", (e) => problems.push("pageerror: " + e));
    page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });
    await use(page);
    expect(problems, "browser errors during the test").toEqual([]);
  }
});

// Opens a puzzle by URL hash and fails the test on any page error.
async function openPuzzle(page, hash) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("index.html" + (hash || ""));
  await page.waitForSelector("#board .node");
  page.__errors = errors;
  return errors;
}

// Pixel position (page coordinates) of a unit position on the board.
async function unitToPixel(page, unit) {
  const rect = await page.locator("#board").boundingBox();
  const b = await page.evaluate(() => UM.config.BOARD);
  const bx = b.padding + unit[0] * (b.width - 2 * b.padding),
        by = b.padding + unit[1] * (b.height - 2 * b.padding);
  return { x: rect.x + (bx / b.width) * rect.width, y: rect.y + (by / b.height) * rect.height };
}

// Drags node `index` with the real mouse to a unit position, in several steps.
async function dragNodeTo(page, index, unit) {
  const node = page.locator("#board .node").nth(index);
  const box = await node.boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = await unitToPixel(page, unit);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
}

async function getState(page) {
  return page.evaluate(() => UM.app.getGame().getState());
}

// Drags every node onto its solution position.
async function solveByDragging(page) {
  const solution = await page.evaluate(() => UM.app.getGame().puzzle.solution);
  for (let i = 0; i < solution.length; i++) {
    await dragNodeTo(page, i, solution[i]);
    if ((await getState(page)).status === "solved") break;
  }
}

module.exports = { test, expect, openPuzzle, unitToPixel, dragNodeTo, getState, solveByDragging };
