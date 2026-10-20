import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openGame, cell, values, peersOf } from "./helpers.js";
import { num, enter, hold, mistakes, puzzleFor, emptyIndices, wrongFor, keepWrong, ackMistake, threeMistakes } from "./play-helpers.js";

test.use({ reducedMotion: "reduce" });

const SCHEMES = ["bw", "blue", "sepia", "dark", "forest"];
const P = puzzleFor(12);

test.beforeEach(async ({ page }) => { await openGame(page); });

async function scan(page, label) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, label).toEqual([]);
}

// A busy board: selection, a note, a wrong digit that conflicts, a locked digit.
async function busyBoard(page) {
  const v = await values(page);
  const empties = emptyIndices(v);
  const i = empties.find((c) => peersOf(c).some((j) => v[j] !== "" && Number(v[j]) !== P.solution[c]));
  const peer = peersOf(i).find((j) => v[j] !== "" && Number(v[j]) !== P.solution[i]);
  const other = empties.find((c) => c !== i);
  const note = empties.find((c) => c !== i && c !== other);
  await enter(page, other, P.solution[other]);
  await cell(page, note).click();
  await hold(page, 4);
  await keepWrong(page, i, Number(v[peer])); // the wrong digit comes last: it blocks all other input
  return { wrong: i, peer };
}

test("accessibility scan (axe): main screen in every colour scheme", async ({ page }) => {
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    await scan(page, "scheme " + s + " (fresh)");
  }
});

test("accessibility scan (axe): a busy board in every colour scheme", async ({ page }) => {
  await busyBoard(page);
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    await scan(page, "scheme " + s + " (busy board)");
  }
});

test("accessibility scan (axe): the lost-game dialog", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  await page.selectOption("#scheme", "dark");
  await threeMistakes(page, P, await values(page));
  await expect(page.locator("#overlay")).toBeVisible();
  await scan(page, "game over dialog");
});

test("accessibility scan (axe): the confirmation question", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await page.locator("#new-game").click();
  await expect(page.locator("#dialog-title")).toHaveText("Abandon this game?");
  await scan(page, "confirm dialog");
});

test("errors are not marked by colour alone: bold and underlined digits, hatched conflict cells", async ({ page }) => {
  const { wrong, peer } = await busyBoard(page);
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    const st = (i, sel) => cell(page, i).locator(sel).evaluate((e) => {
      const c = getComputedStyle(e);
      return { weight: c.fontWeight, deco: c.textDecorationLine, image: c.backgroundImage };
    });
    const w = await st(wrong, ".digit");
    expect(Number(w.weight), s).toBeGreaterThanOrEqual(700);
    expect(w.deco, s).toContain("underline");
    const locked = emptyIndices(await values(page)).length > 0 ? await st(await page.$$eval('.cell[data-state="locked"]', (els) => Number(els[0].dataset.i)), ".digit") : null;
    expect(locked.deco, s).not.toContain("underline");
    expect(Number(locked.weight), s).toBeLessThan(700);
    const conflict = await cell(page, wrong).evaluate((e) => getComputedStyle(e).backgroundImage);
    const conflictPeer = await cell(page, peer).evaluate((e) => getComputedStyle(e).backgroundImage);
    const plain = await cell(page, emptyIndices(await values(page))[5]).evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(conflict, s).not.toBe("none");
    expect(conflictPeer, s).not.toBe("none");
    expect(plain, s).toBe("none");
  }
});

test("screen reader messages: correct, wrong, note", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await expect(page.locator("#live")).toContainText("Correct.");
  await cell(page, empties[2]).click();
  await hold(page, 6);
  await expect(page.locator("#live")).toContainText("Note added.");
  await hold(page, 6);
  await expect(page.locator("#live")).toContainText("Note removed.");
  await enter(page, empties[1], wrongFor(P, empties[1]));
  await expect(page.locator("#live")).toContainText("Wrong digit. 1 of 3 mistakes.");
  await ackMistake(page);
  await expect(page.locator("#live")).toHaveAttribute("aria-live", "polite");
  await expect(mistakes(page)).toHaveAttribute("aria-live", "polite");
});

test("keyboard: one tab stop on the board, arrow keys move the focus with the selection", async ({ page }) => {
  expect(await page.$$eval('.cell[tabindex="0"]', (e) => e.length)).toBe(1);
  await cell(page, 30).click();
  expect(await page.$$eval('.cell[tabindex="0"]', (els) => els.map((e) => e.dataset.i))).toEqual(["30"]);
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 31)).toBeFocused();
  await expect(cell(page, 31)).toHaveClass(/sel/);
  expect(await page.$$eval('.cell[tabindex="0"]', (els) => els.map((e) => e.dataset.i))).toEqual(["31"]);
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, 40)).toBeFocused();
});

test("keyboard focus is clearly visible", async ({ page }) => {
  await page.locator("#new-game").focus();
  for (let k = 0; k < 6; k++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const e = document.activeElement, c = getComputedStyle(e);
      return { cls: e.className, style: c.outlineStyle, width: parseFloat(c.outlineWidth) };
    });
    expect(info.style, info.cls).not.toBe("none");
    expect(info.width, info.cls).toBeGreaterThanOrEqual(2);
  }
});

test("typing in a dropdown does not play the game", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  await cell(page, empties[0]).click();
  await page.locator("#level").focus();
  await page.keyboard.press("Digit" + P.solution[empties[0]]);
  await page.keyboard.press("h");
  await expect(cell(page, empties[0])).toHaveAttribute("data-state", "empty");
  await expect(mistakes(page)).toHaveText("0/3");
});

test("dialogs: alertdialog role, labelled, focus moves in and returns", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await page.locator("#new-game").focus();
  await page.locator("#new-game").click();
  const dlg = page.locator('[role="alertdialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute("aria-modal", "true");
  await expect(dlg).toHaveAttribute("aria-labelledby", "dialog-title");
  await expect(page.locator("#dialog-new")).toBeFocused();
  // Tab stays inside the dialog
  for (let k = 0; k < 5; k++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest(".dialog"))).toBe(true);
  }
  await page.locator("#dialog-cancel").click();
  await expect(dlg).toBeHidden();
  await expect(page.locator("#new-game")).toBeFocused();
});

test("there is no timer, no score, and no Undo / Erase / Notes button", async ({ page }) => {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/\b(time|timer|score|points?|seconds?)\b/i);
  expect(await page.locator('[role="timer"]').count()).toBe(0);
  // and no Undo / Erase / Notes buttons: wrong digits are overwritten, correct ones are locked, notes need a long press
  await expect(page.getByRole("button", { name: /undo|erase|notes?/i })).toHaveCount(0);
});

test("a tap on a cell is handled quickly (render performance)", async ({ page }) => {
  const avg = await page.evaluate(async () => {
    const cells = [...document.querySelectorAll(".cell")];
    const t0 = performance.now();
    for (let k = 0; k < 120; k++) cells[(k * 7) % 81].click();
    await new Promise((r) => requestAnimationFrame(r));
    return (performance.now() - t0) / 120;
  });
  expect(avg).toBeLessThan(10);
});

test("a digit that is completely placed is dimmed and marked disabled", async ({ page }) => {
  const empties = emptyIndices(await values(page));
  for (const i of empties) await enter(page, i, P.solution[i]);
  await page.locator("#dialog-new").waitFor();
  for (let d = 1; d <= 9; d++) await expect(num(page, d)).toHaveAttribute("aria-disabled", "true");
});
