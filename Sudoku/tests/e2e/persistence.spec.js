import { test, expect } from "@playwright/test";
import { openGame, cell, values } from "./helpers.js";
import { num, enter, hold, mistakes, dialog, puzzleFor, emptyIndices, wrongFor, useHint } from "./play-helpers.js";

test.use({ reducedMotion: "reduce" });

const P = puzzleFor(12);
const clues = (v) => v.filter((x) => x !== "").length;
const snapshot = (page) => page.$$eval(".cell", (els) => els.map((e) => [e.dataset.state, e.dataset.value, e.getAttribute("aria-label"), [...e.classList].sort().join(" ")].join("|")));
const LEVEL_RANGE = { beginner: [38, 42], expert: [30, 34], master: [24, 28] };

// Opens the game without the test seed (the real flow with pool and worker) and waits until it is ready.
async function openReal(page) {
  await page.goto("index.html");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".cell")).toHaveCount(81);
}

test("a clean profile starts with Black & White and Beginner", async ({ page }) => {
  await openReal(page);
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "bw");
  await expect(page.locator("#scheme")).toHaveValue("bw");
  await expect(page.locator("#level")).toHaveValue("beginner");
  const [lo, hi] = LEVEL_RANGE.beginner;
  expect(clues(await values(page))).toBeGreaterThanOrEqual(lo);
  expect(clues(await values(page))).toBeLessThanOrEqual(hi);
});

test("scheme and level survive a reload", async ({ page }) => {
  await openReal(page);
  await page.selectOption("#scheme", "sepia");
  await page.selectOption("#level", "expert"); // untouched board: starts at once, no question
  await expect(dialog(page)).toBeHidden();
  await expect.poll(async () => clues(await values(page))).toBeLessThanOrEqual(34);
  await page.evaluate(() => localStorage.removeItem("sudoku.game")); // so the reload starts a new game at the saved level
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "sepia");
  await expect(page.locator("#scheme")).toHaveValue("sepia");
  await expect(page.locator("#level")).toHaveValue("expert");
  const n = clues(await values(page));
  expect(n).toBeGreaterThanOrEqual(30);
  expect(n).toBeLessThanOrEqual(34);
});

for (const level of ["beginner", "expert", "master"]) {
  test("level " + level + " starts a game with the clue count of the PRD", async ({ page }) => {
    await openReal(page);
    await page.selectOption("#level", level);
    const [lo, hi] = LEVEL_RANGE[level];
    await expect.poll(async () => { const n = clues(await values(page)); return n >= lo && n <= hi; }, { timeout: 10000 }).toBe(true);
    await expect(page.locator("#level")).toHaveValue(level);
  });
}

test("the game is saved after every move: reload shows the identical board, notes and mistakes", async ({ page }) => {
  await openGame(page);
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await enter(page, empties[1], wrongFor(P, empties[1]));
  await cell(page, empties[2]).click();
  await hold(page, 3);
  await hold(page, 7);
  await expect(mistakes(page)).toHaveText("1/3");
  const before = await snapshot(page);
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  expect(await snapshot(page)).toEqual(before);
  await expect(mistakes(page)).toHaveText("1/3");
  await expect(cell(page, empties[2])).toHaveAttribute("aria-label", /notes 3 7/);
  await expect(cell(page, empties[2])).toHaveClass(/sel/);
  // and the game goes on from there
  await num(page, P.solution[empties[2]]).click();
  await expect(cell(page, empties[2])).toHaveAttribute("data-state", "locked");
});

test("reloading while the three-mistakes dialog is open shows the dialog again", async ({ page }) => {
  await openGame(page);
  const empties = emptyIndices(await values(page));
  for (let k = 0; k < 3; k++) await enter(page, empties[k], wrongFor(P, empties[k]));
  await expect(dialog(page)).toBeVisible();
  await page.reload();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Three mistakes.");
  await expect(mistakes(page)).toHaveText("3/3");
  await useHint(page, "#dialog-hint");
  await expect(mistakes(page)).toHaveText("2/3");
});

test("a solved game is not restored: the next load starts a new game", async ({ page }) => {
  await openGame(page);
  for (const i of emptyIndices(await values(page))) await enter(page, i, P.solution[i]);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  expect(await page.evaluate(() => localStorage.getItem("sudoku.game"))).toBeNull();
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(dialog(page)).toBeHidden();
  expect(emptyIndices(await values(page)).length).toBeGreaterThan(0);
  await expect(mistakes(page)).toHaveText("0/3");
});

test("New Game asks first when the game has progress; Cancel keeps the game", async ({ page }) => {
  await openGame(page);
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  const before = await snapshot(page);
  await page.locator("#new-game").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Abandon this game?");
  await expect(page.locator("#dialog-cancel")).toBeVisible();
  await expect(page.locator("#dialog-hint")).toBeHidden();
  await page.locator("#dialog-cancel").click();
  await expect(dialog(page)).toBeHidden();
  expect(await snapshot(page)).toEqual(before);
  // Escape cancels as well
  await page.locator("#new-game").click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  // confirming starts the next puzzle
  await page.locator("#new-game").click();
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => values(page)).toEqual(puzzleFor(13).givens.map((d) => (d ? String(d) : "")));
});

test("New Game needs no question on an untouched board", async ({ page }) => {
  await openGame(page);
  await page.locator("#new-game").click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => values(page)).toEqual(puzzleFor(13).givens.map((d) => (d ? String(d) : "")));
});

test("a note or a mistake counts as progress for the question", async ({ page }) => {
  await openGame(page);
  const empties = emptyIndices(await values(page));
  await cell(page, empties[0]).click();
  await hold(page, 5);
  await page.locator("#new-game").click();
  await expect(page.locator("#dialog-title")).toHaveText("Abandon this game?");
  await page.locator("#dialog-cancel").click();
  await page.keyboard.press("Digit" + wrongFor(P, empties[0]));
  await page.locator("#new-game").click();
  await expect(page.locator("#dialog-title")).toHaveText("Abandon this game?");
});

test("changing the level with progress asks first; Cancel puts the dropdown back", async ({ page }) => {
  await openGame(page);
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await page.selectOption("#level", "master");
  await expect(page.locator("#dialog-title")).toHaveText("Abandon this game?");
  await page.locator("#dialog-cancel").click();
  await expect(page.locator("#level")).toHaveValue("beginner");
  await page.selectOption("#level", "master");
  await page.locator("#dialog-new").click();
  await expect(page.locator("#level")).toHaveValue("master");
  await expect.poll(async () => clues(await values(page))).toBeLessThanOrEqual(28);
  expect(await page.evaluate(() => localStorage.getItem("sudoku.level"))).toBe("master");
});

test("New Game is instant when the pool is filled", async ({ page }) => {
  await openReal(page);
  await expect.poll(() => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("sudoku.pool") || "{}");
    return ["beginner", "expert", "master"].every((l) => p[l]);
  }), { timeout: 20000 }).toBe(true);
  const ms = await page.evaluate(() => new Promise((resolve) => {
    const read = () => [...document.querySelectorAll(".cell")].map((c) => c.dataset.value).join("");
    const before = read(), t0 = performance.now();
    document.querySelector("#new-game").click();
    const check = () => { if (read() !== before) resolve(performance.now() - t0); else requestAnimationFrame(check); };
    check();
  }));
  expect(ms).toBeLessThan(300);
});

test("New Game also works with an empty pool", async ({ page }) => {
  await openReal(page);
  await page.evaluate(() => localStorage.removeItem("sudoku.pool"));
  const before = (await values(page)).join("");
  await page.locator("#new-game").click();
  await expect.poll(async () => (await values(page)).join(""), { timeout: 10000 }).not.toBe(before);
  await expect(page.locator("#preparing")).toBeHidden();
});

test("the game works when localStorage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("denied"); } });
  });
  await openReal(page);
  const empties = emptyIndices(await values(page));
  const i = empties[0];
  await cell(page, i).click();
  await num(page, 9).click();
  await expect(mistakes(page)).toHaveText(/^[01]\/3$/);
  await page.selectOption("#scheme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "bw"); // nothing remembered
});

test("every localStorage key of the game starts with sudoku.", async ({ page }) => {
  await openReal(page);
  await page.selectOption("#scheme", "forest");
  const empties = emptyIndices(await values(page));
  await cell(page, empties[0]).click();
  await hold(page, 2);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sudoku.pool") !== null), { timeout: 20000 }).toBe(true);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.length).toBeGreaterThanOrEqual(4);
  for (const k of keys) expect(k.startsWith("sudoku."), k).toBe(true);
});
