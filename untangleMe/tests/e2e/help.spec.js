const { test, expect, openPuzzle, getState, dragNodeTo } = require("./helpers");

test("hint animates one node, counts the hint and leaves moves at zero", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  const before = await getState(page);
  await page.locator("#hint").click();
  await expect(page.locator("#board .node.hint")).toHaveCount(1);
  await expect(page.locator("#hint")).toBeDisabled();
  await expect(page.locator("#hint")).toBeEnabled({ timeout: 4000 });
  const after = await getState(page);
  expect(after.hints).toBe(1);
  expect(after.moves).toBe(0);
  expect(after.status).toBe("idle");
  await expect(page.locator("#hints")).toHaveText("1");
  const moved = after.positions.filter((p, i) => p[0] !== before.positions[i][0] || p[1] !== before.positions[i][1]);
  expect(moved).toHaveLength(1);
});

test("dragging is ignored while a hint animates", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await page.locator("#hint").click();
  const during = await getState(page);
  const other = during.assistNodes[0] === 0 ? 1 : 0;
  await dragNodeTo(page, other, [0.5, 0.5]);
  await expect(page.locator("#hint")).toBeEnabled({ timeout: 4000 });
  const after = await getState(page);
  expect(after.positions[other]).toEqual(during.positions[other]);
  expect(after.moves).toBe(0);
});

test("solve untangles the puzzle without confetti and disables help", async ({ page }) => {
  await openPuzzle(page, "#n=14&seed=5");
  await page.locator("#solve").click();
  await expect(page.locator("#crossings")).toHaveText("0", { timeout: 6000 });
  const s = await getState(page);
  expect(s.status).toBe("solved");
  expect(s.assisted).toBe(true);
  expect(s.moves).toBe(0);
  await expect(page).toHaveTitle("✓ Untangle Me");
  await expect(page.locator("#confetti")).toBeHidden();
  await expect(page.locator("#hint")).toBeDisabled();
  await expect(page.locator("#solve")).toBeDisabled();
});

test("reset and new puzzle clear hints and re-enable the buttons", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await page.locator("#hint").click();
  await expect(page.locator("#hint")).toBeEnabled({ timeout: 4000 });
  await expect(page.locator("#hints")).toHaveText("1");
  await page.locator("#reset").click();
  await expect(page.locator("#hints")).toHaveText("0");
  await page.locator("#solve").click();
  await page.locator("#new-puzzle").click();
  await expect(page.locator("#hint")).toBeEnabled();
  await expect(page.locator("#solve")).toBeEnabled();
  await expect(page.locator("#hints")).toHaveText("0");
});
