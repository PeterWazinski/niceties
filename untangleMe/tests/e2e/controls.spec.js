const { test, expect, openPuzzle, dragNodeTo, getState } = require("./helpers");

// Moves node 0 somewhere else so the game leaves "idle".
async function touchGame(page) {
  const s = await getState(page);
  await dragNodeTo(page, 0, [s.positions[0][0] > 0.5 ? 0.15 : 0.85, 0.5]);
}

test("presets create puzzles of the preset size and update the URL", async ({ page }) => {
  const errors = await openPuzzle(page, "#n=8&seed=1");
  const presets = [["Easy", 6], ["Hard", 14], ["Insane", 25], ["Normal", 8]];
  for (const [label, n] of presets) {
    await page.locator("#presets button", { hasText: label }).click();
    await expect(page.locator("#board .node")).toHaveCount(n);
    expect(page.url()).toMatch(new RegExp("#n=" + n + "&seed=\\d+$"));
    await expect(page.locator("#nodes")).toHaveValue(String(n));
    await expect(page.locator("#presets button", { hasText: label })).toHaveAttribute("aria-pressed", "true");
  }
  expect(errors).toEqual([]);
});

test("slider has bounds 6..30 and applies on release", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=1");
  await expect(page.locator("#nodes")).toHaveAttribute("min", "6");
  await expect(page.locator("#nodes")).toHaveAttribute("max", "30");
  // Keyboard changes fire `input` and `change` for each step.
  await page.locator("#nodes").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#board .node")).toHaveCount(10);
  await expect(page.locator("#nodes-value")).toHaveText("10");
  await page.locator("#nodes").evaluate((el) => { el.value = 999; el.dispatchEvent(new Event("change")); });
  await expect(page.locator("#board .node")).toHaveCount(30);
});

test("reset restores the exact starting layout and zeroes the counters", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  const start = await getState(page);
  await touchGame(page);
  const moved = await getState(page);
  expect(moved.moves).toBe(1);
  expect(moved.positions[0]).not.toEqual(start.positions[0]);
  await page.click("#reset");
  const after = await getState(page);
  expect(after.positions).toEqual(start.positions);
  expect(after.moves).toBe(0);
  expect(after.status).toBe("idle");
  expect(await page.locator("#moves").textContent()).toBe("0");
  expect(await page.locator("#timer").textContent()).toBe("0.0");
  expect(page.url()).toMatch(/#n=8&seed=42$/);
});

test("copy link reports success or offers the link", async ({ page, context, browserName }) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await openPuzzle(page, "#n=9&seed=123");
  await page.click("#copy-link");
  const status = page.locator("#copy-status");
  await expect(status).not.toHaveText("");
  const copied = (await status.textContent()) === "Copied";
  if (copied) {
    if (browserName === "chromium") {
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    }
  } else {
    await expect(page.locator("#link-field")).toBeVisible();
    await expect(page.locator("#link-field")).toHaveValue(page.url());
  }
  expect(page.url()).toMatch(/#n=9&seed=123$/);
});

test("crossing markers toggle", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  expect(await page.locator("#board .mark").count()).toBeGreaterThan(0);
  await page.uncheck("#toggle-markers");
  await expect(page.locator("#board .mark")).toHaveCount(0);
  await page.check("#toggle-markers");
  expect(await page.locator("#board .mark").count()).toBeGreaterThan(0);
});

test("timer toggle hides only the timer", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await expect(page.locator("#time-row")).toBeVisible();
  await page.uncheck("#toggle-timer");
  await expect(page.locator("#time-row")).toBeHidden();
  await expect(page.locator("#moves")).toBeVisible();
  await expect(page.locator("#crossings")).toBeVisible();
});

test("settings persist across reload; hash overrides the stored node count", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=1");
  await page.selectOption("#theme", "neon");
  await page.uncheck("#toggle-markers");
  await page.uncheck("#toggle-timer");
  await page.locator("#presets button", { hasText: "Hard" }).click();

  await page.goto("index.html"); // no hash: stored node count and settings apply
  await page.waitForSelector("#board .node");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
  await expect(page.locator("#board .node")).toHaveCount(14);
  await expect(page.locator("#toggle-markers")).not.toBeChecked();
  await expect(page.locator("#toggle-timer")).not.toBeChecked();
  await expect(page.locator("#board .mark")).toHaveCount(0);

  await page.goto("index.html#n=7&seed=3"); // hash wins
  await page.waitForSelector("#board .node");
  await expect(page.locator("#board .node")).toHaveCount(7);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
});

test("broken stored settings do not break the game", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("untangleMe.settings", "{{{ nope"));
  const errors = await openPuzzle(page, "#n=8&seed=1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
  await expect(page.locator("#board .node")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("timer pauses while the tab is hidden and resumes afterwards", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await touchGame(page);
  const setHidden = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

  await page.waitForTimeout(300);
  await setHidden(true);
  const frozenAt = await page.evaluate(() => UM.app.getGame().elapsed());
  expect(frozenAt).toBeGreaterThan(100);
  await page.waitForTimeout(600);
  const stillFrozen = await page.evaluate(() => UM.app.getGame().elapsed());
  expect(stillFrozen).toBe(frozenAt);

  await setHidden(false);
  await page.waitForTimeout(400);
  const resumed = await page.evaluate(() => UM.app.getGame().elapsed());
  expect(resumed).toBeGreaterThan(frozenAt + 200);
  expect(resumed).toBeLessThan(frozenAt + 1500);
});
