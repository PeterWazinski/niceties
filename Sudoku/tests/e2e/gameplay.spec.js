import { test, expect } from "@playwright/test";
import { openGame, cell, cellsWith, values, peersOf } from "./helpers.js";
import { num, enter, hold, mistakes, dialog, puzzleFor, emptyIndices, wrongFor, useHint, threeMistakes as threeMistakesIn } from "./play-helpers.js";

// Animations are covered in animation.spec.js; here they are shortened.
test.use({ reducedMotion: "reduce" });

const P = puzzleFor(12);

test.beforeEach(async ({ page }) => { await openGame(page); });

async function firstEmpty(page, skip = 0) {
  return emptyIndices(await values(page))[skip];
}

test("tap a digit in a selected empty cell: the right digit is locked", async ({ page }) => {
  const i = await firstEmpty(page);
  await enter(page, i, P.solution[i]);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await expect(cell(page, i)).toHaveAttribute("data-value", String(P.solution[i]));
  await expect(mistakes(page)).toHaveText("0/3");
});

test("a locked digit cannot be changed", async ({ page }) => {
  const i = await firstEmpty(page);
  await enter(page, i, P.solution[i]);
  await num(page, wrongFor(P, i)).click();
  await expect(cell(page, i)).toHaveAttribute("data-value", String(P.solution[i]));
  await expect(mistakes(page)).toHaveText("0/3");
});

test("a wrong digit is red, counted once, and can be overwritten", async ({ page }) => {
  const i = await firstEmpty(page);
  await enter(page, i, wrongFor(P, i));
  await expect(cell(page, i)).toHaveAttribute("data-state", "wrong");
  await expect(mistakes(page)).toHaveText("1/3");
  const colour = await cell(page, i).locator(".digit").evaluate((e) => getComputedStyle(e).color);
  const wrong = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--wrong").trim());
  expect(colour).toBe(`rgb(${[1, 3, 5].map((k) => parseInt(wrong.slice(k, k + 2), 16)).join(", ")})`);
  await num(page, P.solution[i]).click(); // overwrite with the right one: free
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await expect(mistakes(page)).toHaveText("1/3");
});

test("tapping the same wrong digit again clears the cell, and the game can go on", async ({ page }) => {
  const [a, b] = emptyIndices(await values(page));
  await enter(page, a, wrongFor(P, a));
  await expect(cell(page, a)).toHaveAttribute("data-state", "wrong");
  await num(page, wrongFor(P, a)).click();
  await expect(cell(page, a)).toHaveAttribute("data-state", "empty");
  await expect(mistakes(page)).toHaveText("1/3"); // clearing costs nothing
  await enter(page, b, P.solution[b]);            // the game goes on
  await expect(cell(page, b)).toHaveAttribute("data-state", "locked");
});

test("Backspace and Delete clear a wrong digit", async ({ page }) => {
  const [a, b] = emptyIndices(await values(page));
  for (const key of ["Backspace", "Delete"]) {
    await enter(page, a, wrongFor(P, a));
    await expect(cell(page, a)).toHaveAttribute("data-state", "wrong");
    await page.keyboard.press(key);
    await expect(cell(page, a)).toHaveAttribute("data-state", "empty");
  }
  await expect(mistakes(page)).toHaveText("2/3");
  // they do nothing to correct or empty cells
  await enter(page, b, P.solution[b]);
  await page.keyboard.press("Backspace");
  await expect(cell(page, b)).toHaveAttribute("data-state", "locked");
});

test("a wrong digit stops the game until it is fixed: no digits, no notes, a warning", async ({ page }) => {
  const [a, b] = emptyIndices(await values(page));
  await enter(page, a, wrongFor(P, a));
  await expect(page.locator("#notice")).toBeHidden(); // the wrong cell itself is selected
  await cell(page, b).click();
  await expect(page.locator("#notice")).toBeVisible();
  await expect(page.locator("#notice")).toHaveText("Fix or clear the red digit first.");
  await expect(page.locator("#numpad")).toHaveClass(/inactive/);
  await num(page, P.solution[b]).click();
  await num(page, wrongFor(P, b)).click();
  await hold(page, 4);
  await expect(cell(page, b)).toHaveAttribute("data-state", "empty");
  await expect(cell(page, b).locator(".notes span:not(:empty)")).toHaveCount(0);
  await expect(mistakes(page)).toHaveText("1/3"); // blocked taps are not mistakes
  await expect(page.locator("#live")).toContainText("Fix or clear the red digit first.");
  // back to the wrong cell: fix it with the right digit, the warning is gone, the game goes on
  await cell(page, a).click();
  await expect(page.locator("#notice")).toBeHidden();
  await num(page, P.solution[a]).click();
  await expect(cell(page, a)).toHaveAttribute("data-state", "locked");
  await enter(page, b, P.solution[b]);
  await expect(cell(page, b)).toHaveAttribute("data-state", "locked");
});

test("changing the wrong digit to another wrong one is a new mistake and still blocks", async ({ page }) => {
  const [a, b] = emptyIndices(await values(page));
  const wrongs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== P.solution[a]);
  await enter(page, a, wrongs[0]);
  await num(page, wrongs[1]).click();
  await expect(mistakes(page)).toHaveText("2/3");
  await expect(cell(page, a)).toHaveAttribute("data-value", String(wrongs[1]));
  await cell(page, b).click();
  await num(page, P.solution[b]).click();
  await expect(cell(page, b)).toHaveAttribute("data-state", "empty");
});

test("Hint clears the wrong digit and unblocks the game", async ({ page }) => {
  const [a, b] = emptyIndices(await values(page));
  await enter(page, a, wrongFor(P, a));
  await cell(page, b).click();
  await useHint(page);
  await expect(cell(page, a)).toHaveAttribute("data-state", "empty");
  await expect(page.locator("#notice")).toBeHidden();
  await enter(page, b, P.solution[b]);
  await expect(cell(page, b)).toHaveAttribute("data-state", "locked");
});

test("a wrong digit that duplicates a visible digit marks the conflicting cells red", async ({ page }) => {
  const v = await values(page);
  const i = emptyIndices(v).find((c) => peersOf(c).some((j) => v[j] !== "" && Number(v[j]) !== P.solution[c]));
  const j = peersOf(i).find((c) => v[c] !== "" && Number(v[c]) !== P.solution[i]);
  await enter(page, i, Number(v[j]));
  const conflicts = await cellsWith(page, "conflict");
  expect(conflicts).toContain(i);
  expect(conflicts).toContain(j);
});

test("a number tap without a selected cell, or on a given cell, does nothing", async ({ page }) => {
  const before = await values(page);
  await expect(page.locator("#numpad")).toHaveClass(/inactive/);
  await num(page, 5).click();
  expect(await values(page)).toEqual(before);
  const g = before.findIndex((x) => x !== "");
  await cell(page, g).click();
  await expect(page.locator("#numpad")).toHaveClass(/inactive/);
  await num(page, 5).click();
  expect(await values(page)).toEqual(before);
  await expect(mistakes(page)).toHaveText("0/3");
});

test("the number buttons are active when an editable cell is selected", async ({ page }) => {
  const i = await firstEmpty(page);
  await cell(page, i).click();
  await expect(page.locator("#numpad")).not.toHaveClass(/inactive/);
});

test("long press creates a note and no digit; a second hold removes it", async ({ page }) => {
  const i = await firstEmpty(page);
  await cell(page, i).click();
  await hold(page, 3);
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  await expect(cell(page, i).locator(".notes")).toContainText("3");
  await expect(cell(page, i)).toHaveAttribute("aria-label", /notes 3/);
  await hold(page, 3);
  await expect(cell(page, i).locator(".notes")).not.toContainText("3");
});

test("notes of several digits can be set in one cell", async ({ page }) => {
  const i = await firstEmpty(page);
  await cell(page, i).click();
  for (const d of [2, 5, 9]) await hold(page, d);
  await expect(cell(page, i)).toHaveAttribute("aria-label", /notes 2 5 9/);
});

test("a short tap enters a digit, it does not make a note", async ({ page }) => {
  const i = await firstEmpty(page);
  await enter(page, i, P.solution[i]);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await expect(cell(page, i).locator(".notes span:not(:empty)")).toHaveCount(0);
});

test("a note can be set for a digit that already stands in the row, column or box", async ({ page }) => {
  const v = await values(page);
  const i = await firstEmpty(page);
  const peer = peersOf(i).find((j) => v[j] !== "");
  await cell(page, i).click();
  await hold(page, Number(v[peer]));
  await expect(cell(page, i).locator(".notes")).toContainText(v[peer]);
});

test("a correct digit removes its note from the row, column and box; a wrong digit does not", async ({ page }) => {
  const v = await values(page);
  const empties = emptyIndices(v);
  const i = empties[0];
  const peer = empties.find((j) => j !== i && peersOf(i).includes(j));
  const d = P.solution[i];
  await cell(page, peer).click();
  await hold(page, d);
  await expect(cell(page, peer).locator(".notes")).toContainText(String(d));
  // wrong digit in i: peer keeps its note
  await enter(page, i, wrongFor(P, i));
  await expect(cell(page, peer).locator(".notes")).toContainText(String(d));
  // the right digit: the note disappears
  await cell(page, i).click();
  await num(page, d).click();
  await expect(cell(page, peer).locator(".notes")).not.toContainText(String(d));
});

test("a long press with a filled cell selected does nothing", async ({ page }) => {
  const v = await values(page);
  const g = v.findIndex((x) => x !== "");
  await cell(page, g).click();
  await hold(page, 4);
  await expect(cell(page, g).locator(".notes span:not(:empty)")).toHaveCount(0);
});

test("moving the pointer off the button cancels the press", async ({ page }) => {
  const i = await firstEmpty(page);
  await cell(page, i).click();
  const b = await num(page, 6).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y - 120, { steps: 4 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  await expect(cell(page, i).locator(".notes span:not(:empty)")).toHaveCount(0);
  await expect(mistakes(page)).toHaveText("0/3");
});

test("the tip about holding a number goes away after the first note and stays away after a reload", async ({ page }) => {
  await expect(page.locator("#tip")).toBeVisible();
  await enter(page, await firstEmpty(page), 1); // entering a digit does not dismiss it
  await expect(page.locator("#tip")).toBeVisible();
  const i = await firstEmpty(page, 3);
  await cell(page, i).click();
  await hold(page, 8);
  await expect(page.locator("#tip")).toBeHidden();
  await openGame(page);
  await expect(page.locator("#tip")).toBeHidden();
});

async function threeMistakes(page) {
  return threeMistakesIn(page, P, await values(page));
}

test("three wrong digits open the dialog; the board is blocked behind it", async ({ page }) => {
  await threeMistakes(page);
  await expect(mistakes(page)).toHaveText("3/3");
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Three mistakes.");
  await expect(page.locator("#dialog-new")).toBeVisible();
  await expect(page.locator("#dialog-hint")).toBeVisible();
  await expect(page.locator(".app")).toHaveAttribute("inert", "");
  const before = await values(page);
  await page.keyboard.press("Digit5"); // keyboard input is ignored too
  expect(await values(page)).toEqual(before);
});

test("dialog Hint: wrong cell emptied, counter 2/3, the next wrong digit opens the dialog again", async ({ page }) => {
  const empties = await threeMistakes(page);
  await useHint(page, "#dialog-hint");
  await expect(dialog(page)).toBeHidden();
  await expect(mistakes(page)).toHaveText("2/3");
  const last = empties[0];
  await expect(cell(page, last)).toHaveAttribute("data-state", "empty");
  await expect(cell(page, last)).toHaveClass(/sel/);
  await num(page, wrongFor(P, last)).click(); // the cell is selected: guess wrong again
  await expect(mistakes(page)).toHaveText("3/3");
  await expect(dialog(page)).toBeVisible();
});

test("dialog New Game starts a fresh puzzle with 0/3", async ({ page }) => {
  await threeMistakes(page);
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect(mistakes(page)).toHaveText("0/3");
  const next = puzzleFor(13);
  await expect.poll(() => values(page)).toEqual(next.givens.map((d) => (d ? String(d) : "")));
});

test("header New Game starts a new puzzle too", async ({ page }) => {
  await page.locator("#new-game").click();
  const next = puzzleFor(13);
  await expect.poll(() => values(page)).toEqual(next.givens.map((d) => (d ? String(d) : "")));
});

test("Hint with a wrong digit empties it, a second press reveals the right digit", async ({ page }) => {
  const i = await firstEmpty(page);
  await enter(page, i, wrongFor(P, i));
  await expect(mistakes(page)).toHaveText("1/3");
  await useHint(page);
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  await expect(mistakes(page)).toHaveText("1/3");
  await useHint(page);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await expect(cell(page, i)).toHaveAttribute("data-value", String(P.solution[i]));
  await expect(mistakes(page)).toHaveText("1/3");
});

test("Hint reveals the selected empty cell", async ({ page }) => {
  const i = await firstEmpty(page, 4);
  await cell(page, i).click();
  await useHint(page);
  await expect(cell(page, i)).toHaveAttribute("data-value", String(P.solution[i]));
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
});

test("Hint without a selection fills one more cell", async ({ page }) => {
  const before = emptyIndices(await values(page)).length;
  await useHint(page);
  await expect.poll(async () => emptyIndices(await values(page)).length).toBe(before - 1);
  expect(await cellsWith(page, "sel")).toHaveLength(1);
});

test("solving the puzzle by tapping shows Solved!, greys out all digits, New Game continues", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  for (const i of empties) await enter(page, i, P.solution[i]);
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await expect(page.locator("#dialog-hint")).toBeHidden();
  await expect(mistakes(page)).toHaveText("0/3");
  await expect(page.locator(".num.done")).toHaveCount(9);
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator(".num.done")).toHaveCount(0);
});

test("keyboard: arrows move, digits enter, Shift+digit makes a note, H gives a hint", async ({ page }) => {
  await page.keyboard.press("ArrowRight"); // nothing selected: starts in the middle
  expect(await cellsWith(page, "sel")).toEqual([40]);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  expect(await cellsWith(page, "sel")).toEqual([30]);
  const i = await firstEmpty(page, 2);
  await cell(page, i).click();
  await page.keyboard.press("Shift+Digit4");
  await expect(cell(page, i).locator(".notes")).toContainText("4");
  await page.keyboard.press("Digit" + P.solution[i]);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  const j = await firstEmpty(page, 5);
  await cell(page, j).click();
  await page.keyboard.press("h");
  await expect(cell(page, j)).toHaveAttribute("data-value", String(P.solution[j]));
});

test("arrow keys stop at the edges of the board", async ({ page }) => {
  await cell(page, 0).click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  expect(await cellsWith(page, "sel")).toEqual([0]);
  await cell(page, 8).click();
  await page.keyboard.press("ArrowRight");
  expect(await cellsWith(page, "sel")).toEqual([8]);
});
