// Helpers for the Coach tests (PRD 3.4.1): game positions where the Coach's next
// move uses a given technique, loaded through the saved game.
import { expect } from "@playwright/test";
import { generate } from "../../js/generator.js";
import { createRng } from "../../js/rng.js";
import { newGame, serialize } from "../../js/game.js";
import { coachChain } from "../../js/coach.js";
import { techniqueLevel } from "../../js/techniques.js";

// Plays generated games forward with the Coach until a chain matches `want(steps)`.
// Returns { state, chain }; state is a fresh game with the digits so far entered.
export function positionWhere(want, levels = ["beginner", "expert", "master"], seeds = 40) {
  for (const level of levels) {
    for (let seed = 1; seed <= seeds; seed++) {
      const puzzle = { ...generate(level, createRng(seed)), level };
      const grid = puzzle.givens.slice();
      while (grid.includes(0)) {
        const chain = coachChain(grid);
        if (!chain.placement) break;
        if (want(chain.steps)) {
          const state = newGame(puzzle);
          for (let i = 0; i < 81; i++) if (!puzzle.givens[i] && grid[i]) state.entries[i] = grid[i];
          return { state, chain };
        }
        grid[chain.placement.cell] = chain.placement.digit;
      }
    }
  }
  throw new Error("no position found");
}

export const beginnerPosition = () => positionWhere((s) => s.length === 1 && s[0].technique === "hiddenSingle", ["beginner"]);
export const expertPosition = () => positionWhere((s) => s.length >= 2 && techniqueLevel(s[0].technique) === "expert", ["expert"]);
export const masterPosition = () => positionWhere((s) => s.some((x) => techniqueLevel(x.technique) === "master"), ["master"]);

// Opens the page with a prepared game (instead of a new one).
export async function openPosition(page, state) {
  await page.addInitScript((text) => {
    if (!sessionStorage.getItem("coach-test-loaded")) {
      localStorage.setItem("sudoku.game", text);
      sessionStorage.setItem("coach-test-loaded", "1");
    }
  }, serialize(state));
  await page.goto("index.html?seed=12");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await page.waitForFunction(() => document.styleSheets.length >= 2 &&
    [...document.styleSheets].every((s) => { try { return s.cssRules.length > 0; } catch (e) { return false; } }));
}

export const panel = (page) => page.locator("#coach-panel");
export const helpsUsed = (page) => page.locator("#help-dots").getAttribute("data-used");
