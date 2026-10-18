import { test, expect } from "@playwright/test";
import { openGame, cell, values } from "./helpers.js";
import { num, enter, puzzleFor, emptyIndices, wrongFor } from "./play-helpers.js";

// Default motion settings: the hint animations are slow (about 1.2 s).
test.use({ reducedMotion: "no-preference" });

const P = puzzleFor(12);

test.beforeEach(async ({ page }) => { await openGame(page); });

test("hint on a wrong digit: slow fade-out, input blocked meanwhile, then free again", async ({ page }) => {
  const i = emptyIndices(await values(page))[0];
  await enter(page, i, wrongFor(P, i));
  await page.locator("#hint").click();
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "true");
  await expect(cell(page, i).locator(".ghost")).toHaveCount(1);
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  // while the animation runs, a digit tap is ignored
  await num(page, P.solution[i]).click();
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "false", { timeout: 3000 });
  await expect(cell(page, i).locator(".ghost")).toHaveCount(0);
  await num(page, P.solution[i]).click();
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
});

test("hint reveal: the digit fades in with a pulse on its cell", async ({ page }) => {
  const i = emptyIndices(await values(page))[2];
  await cell(page, i).click();
  await page.locator("#hint").click();
  await expect(cell(page, i)).toHaveClass(/reveal/);
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "true");
  await expect(cell(page, i)).toHaveAttribute("data-value", String(P.solution[i]));
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "false", { timeout: 3000 });
  await expect(cell(page, i)).not.toHaveClass(/reveal/, { timeout: 3000 });
});

test("the animation takes noticeable time (at least 1 s) by default", async ({ page }) => {
  const i = emptyIndices(await values(page))[0];
  await enter(page, i, wrongFor(P, i));
  const t0 = Date.now();
  await page.locator("#hint").click();
  await expect(page.locator(".app")).toHaveAttribute("data-busy", "false", { timeout: 3000 });
  expect(Date.now() - t0).toBeGreaterThanOrEqual(1000);
});
