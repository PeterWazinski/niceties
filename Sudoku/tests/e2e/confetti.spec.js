import { test, expect } from "@playwright/test";
import { openGame, cell, values } from "./helpers.js";
import { enter, puzzleFor, emptyIndices, dialog } from "./play-helpers.js";

// Default motion settings: confetti is only shown when the user does not ask for reduced motion.
test.use({ reducedMotion: "no-preference" });

const P = puzzleFor(12);
const confetti = (page) => page.locator("#confetti");

async function solve(page, p, skipLast = false) {
  const empties = emptyIndices(await values(page));
  const todo = skipLast ? empties.slice(0, -1) : empties;
  for (const i of todo) await enter(page, i, p.solution[i]);
  return empties[empties.length - 1];
}

test("no confetti while playing", async ({ page }) => {
  await openGame(page);
  await expect(confetti(page)).toBeHidden();
  await solve(page, P, true);
  await expect(confetti(page)).toBeHidden();
  expect(await confetti(page).getAttribute("data-fired")).toBeNull();
});

test("solving the game rains confetti once, over the Solved! message, and it clears by itself", async ({ page }) => {
  await openGame(page);
  await solve(page, P);
  await expect(dialog(page)).toBeVisible();
  await expect(confetti(page)).toBeVisible();
  await expect(confetti(page)).toHaveAttribute("data-fired", "1");
  // above the dialog, and it never blocks a tap
  const z = await page.evaluate(() => ({
    c: Number(getComputedStyle(document.getElementById("confetti")).zIndex),
    o: Number(getComputedStyle(document.getElementById("overlay")).zIndex),
    pe: getComputedStyle(document.getElementById("confetti")).pointerEvents
  }));
  expect(z.c).toBeGreaterThan(z.o);
  expect(z.pe).toBe("none");
  // it stops on its own after a few seconds
  await expect(confetti(page)).toBeHidden({ timeout: 9000 });
  await expect(confetti(page)).toHaveAttribute("data-fired", "1");
});

test("confetti really draws pixels, at full resolution and over the whole viewport", async ({ page }) => {
  await openGame(page);
  await solve(page, P);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const c = document.getElementById("confetti");
    const r = c.getBoundingClientRect();
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return { painted, bufW: c.width, bufH: c.height, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight, top: r.top, left: r.left };
  });
  expect(info.painted).toBeGreaterThan(200);
  expect(Math.round(info.w)).toBe(info.vw);
  expect(Math.round(info.h)).toBe(info.vh);
  expect(info.top).toBe(0);
  expect(info.left).toBe(0);
  expect(info.bufW).toBeGreaterThanOrEqual(info.vw);
  expect(info.bufH).toBeGreaterThanOrEqual(info.vh);
});

test("New Game stops the confetti at once; the next solved game rains again", async ({ page }) => {
  await openGame(page);
  await solve(page, P);
  await expect(confetti(page)).toBeVisible();
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect(confetti(page)).toBeHidden();
  await expect(confetti(page)).toHaveAttribute("data-fired", "1");
  await expect.poll(() => values(page)).toEqual(puzzleFor(13).givens.map((d) => (d ? String(d) : "")));
  await solve(page, puzzleFor(13));
  await expect(confetti(page)).toBeVisible();
  await expect(confetti(page)).toHaveAttribute("data-fired", "2");
});

test("a game solved with the last cell from a hint rains confetti too", async ({ page }) => {
  await openGame(page);
  const last = await solve(page, P, true);
  await cell(page, last).click();
  await page.locator("#hint").click();
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await expect(confetti(page)).toBeVisible();
  await expect(confetti(page)).toHaveAttribute("data-fired", "1");
});

test("after a reload there is no confetti and a new game starts", async ({ page }) => {
  await openGame(page);
  await solve(page, P);
  await expect(confetti(page)).toBeVisible();
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(confetti(page)).toBeHidden();
  expect(await confetti(page).getAttribute("data-fired")).toBeNull();
  await expect(dialog(page)).toBeHidden();
});

test("confetti never appears with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGame(page);
  await solve(page, P);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await expect(confetti(page)).toBeHidden();
  expect(await confetti(page).getAttribute("data-fired")).toBeNull();
});
