// Winning in the Star Wars scheme: a shockwave instead of confetti (PRD 3.6).
// Every other scheme keeps the confetti (confetti.spec.js).
import { test, expect } from "@playwright/test";
import { cell } from "./helpers.js";
import { enter, puzzleFor, dialog } from "./play-helpers.js";
import { openPosition } from "./coach-helpers.js";
import { newGame } from "../../js/game.js";

test.use({ reducedMotion: "no-preference" });

const P = puzzleFor(12);
const shockwave = (page) => page.locator("#shockwave");
const confetti = (page) => page.locator("#confetti");

// Every cell filled but one, loaded as the saved game; returns the last cell.
async function almostSolved(page, scheme) {
  const s = newGame({ ...P, level: "beginner" });
  const empties = s.givens.map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
  for (const i of empties.slice(0, -1)) s.entries[i] = s.solution[i];
  if (scheme) await page.addInitScript((id) => localStorage.setItem("sudoku.scheme", id), scheme);
  await openPosition(page, s);
  return empties[empties.length - 1];
}

test("Star Wars: solving fires the shockwave, no confetti; above the dialog, never blocks a tap; it clears by itself", async ({ page }) => {
  const last = await almostSolved(page);
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "starwars");
  await enter(page, last, P.solution[last]);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await expect(shockwave(page)).toBeVisible();
  await expect(shockwave(page)).toHaveAttribute("data-fired", "1");
  await expect(confetti(page)).toBeHidden();
  expect(await confetti(page).getAttribute("data-fired")).toBeNull();
  const z = await page.evaluate(() => ({
    s: Number(getComputedStyle(document.getElementById("shockwave")).zIndex),
    o: Number(getComputedStyle(document.getElementById("overlay")).zIndex),
    pe: getComputedStyle(document.getElementById("shockwave")).pointerEvents
  }));
  expect(z.s).toBeGreaterThan(z.o);
  expect(z.pe).toBe("none");
  await expect(shockwave(page)).toBeHidden({ timeout: 4000 });
});

test("the shockwave really draws, over the whole viewport, and starts at the last filled cell", async ({ page }) => {
  const last = await almostSolved(page);
  await enter(page, last, P.solution[last]);
  await page.waitForTimeout(150);
  const info = await page.evaluate((i) => {
    const c = document.getElementById("shockwave"), r = c.getBoundingClientRect();
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 0) painted++;
    const cr = document.querySelectorAll(".cell")[i].getBoundingClientRect();
    const cell = [Math.round(cr.left + cr.width / 2), Math.round(cr.top + cr.height / 2)];
    return { painted, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, cell, origin: c.dataset.origin.split(",").map(Number) };
  }, last);
  expect(info.painted).toBeGreaterThan(1000);
  expect(Math.round(info.w)).toBe(info.vw);
  expect(Math.round(info.h)).toBe(info.vh);
  // the burst starts at the last filled cell (not a timing-dependent pixel check)
  expect(Math.abs(info.origin[0] - info.cell[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(info.origin[1] - info.cell[1])).toBeLessThanOrEqual(1);
});

test("other schemes keep the confetti, no shockwave", async ({ page }) => {
  const last = await almostSolved(page, "sepia");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "sepia");
  await enter(page, last, P.solution[last]);
  await expect(confetti(page)).toBeVisible();
  await expect(shockwave(page)).toBeHidden();
  expect(await shockwave(page).getAttribute("data-fired")).toBeNull();
});

test("the scheme chosen during the game decides the celebration", async ({ page }) => {
  const last = await almostSolved(page, "bw");
  await page.selectOption("#scheme", "starwars");
  await enter(page, last, P.solution[last]);
  await expect(shockwave(page)).toHaveAttribute("data-fired", "1");
  expect(await confetti(page).getAttribute("data-fired")).toBeNull();
});

test("New Game stops the shockwave at once", async ({ page }) => {
  const last = await almostSolved(page);
  await enter(page, last, P.solution[last]);
  await expect(shockwave(page)).toBeVisible();
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect(shockwave(page)).toBeHidden();
});

test("reduced motion: no shockwave", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const last = await almostSolved(page);
  await enter(page, last, P.solution[last]);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await expect(shockwave(page)).toBeHidden();
  expect(await shockwave(page).getAttribute("data-fired")).toBeNull();
  await expect(cell(page, last)).toHaveAttribute("data-value", String(P.solution[last]));
});
