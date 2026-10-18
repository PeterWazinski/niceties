// Helpers for the gameplay tests.
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
