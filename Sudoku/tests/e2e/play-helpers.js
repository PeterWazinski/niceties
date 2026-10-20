// Helpers for the gameplay tests.
import { expect } from "@playwright/test";
import { cell } from "./helpers.js";
import { generate } from "../../js/generator.js";
import { createRng } from "../../js/rng.js";

// The puzzle the page generates for ?seed=N (same generator, same seed).
export const puzzleFor = (seed = 12, level = "beginner") => generate(level, createRng(seed));

export const num = (page, d) => page.locator(`.num[data-digit="${d}"]`);
export const emptyIndices = (vals) => vals.map((x, j) => (x === "" ? j : -1)).filter((j) => j >= 0);

// Selects a cell, then taps a digit (short tap).
export async function enter(page, i, d) {
  await cell(page, i).click();
  await num(page, d).click();
}

// Holds a number button longer than the long-press threshold.
export async function hold(page, d, ms = 600) {
  const b = await num(page, d).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

// Waits until no animation blocks the input.
export async function waitIdle(page) {
  await page.waitForFunction(() => document.querySelector(".app").dataset.busy !== "true");
}

// Confirms the "Mistake i/3" popup; the wrong digit then fades out and the cell is empty again.
export async function ackMistake(page) {
  await expect(page.locator("#dialog-title")).toHaveText(/^Mistake \d\/3$/);
  await page.locator("#dialog-new").click();
  await expect(page.locator("#overlay")).toBeHidden();
  await waitIdle(page);
}

// A wrong digit that stays on the board: the mistake is made, then the page is reloaded before the
// popup is confirmed (the popup is not saved, the wrong digit is).
export async function keepWrong(page, i, d) {
  await enter(page, i, d);
  await expect(page.locator("#dialog-title")).toHaveText(/^Mistake/);
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(cell(page, i)).toHaveAttribute("data-state", "wrong");
}

// Three different wrong digits in the first empty cell: the first two are confirmed, the third loses the game.
export async function threeMistakes(page, p, vals) {
  const empties = emptyIndices(vals);
  const cellIndex = empties[0];
  const wrongs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== p.solution[cellIndex]).slice(0, 3);
  await cell(page, cellIndex).click();
  for (const d of wrongs.slice(0, 2)) { await num(page, d).click(); await ackMistake(page); }
  await num(page, wrongs[2]).click();
  return empties;
}

export const mistakes = (page) => page.locator("#mistakes");
export const dialog = (page) => page.locator("#overlay");
// A digit that is wrong for the cell.
export const wrongFor = (p, i) => (p.solution[i] % 9) + 1;

// Presses a Hint button and waits until the hint animation is over (input is blocked meanwhile).
export async function useHint(page, selector = "#hint") {
  await page.locator(selector).click();
  await page.locator(".app").waitFor();
  await page.waitForFunction(() => document.querySelector(".app").dataset.busy !== "true");
}
