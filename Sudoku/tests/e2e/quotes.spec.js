// Star Wars quotes in the popups (PRD 3.9): the right list per dialog, the speaker
// line for real film lines, both languages, no quote twice in a row.
import { test, expect } from "@playwright/test";
import { openGame, values } from "./helpers.js";
import { enter, ackMistake, threeMistakes, puzzleFor, emptyIndices, wrongFor, dialog } from "./play-helpers.js";
import { openPosition } from "./coach-helpers.js";
import { newGame } from "../../js/game.js";
import { QUOTES } from "../../js/quotes.js";

test.use({ reducedMotion: "reduce" });

const P = puzzleFor(12);

// The shown quote as the index into `list`, checked against the speaker line.
async function shownQuote(page, list, lang = "en") {
  const text = await page.locator("#dialog-text").textContent();
  const i = QUOTES[list].findIndex((q) => q[lang] === text);
  expect(i, `"${text}" is in the list ${list}`).toBeGreaterThanOrEqual(0);
  const q = QUOTES[list][i];
  await expect(page.locator("#dialog-text")).toHaveClass(/quote/);
  if (q.by) {
    await expect(page.locator("#dialog-by")).toBeVisible();
    await expect(page.locator("#dialog-by")).toHaveText(`— ${q.by[lang]}`);
  } else {
    await expect(page.locator("#dialog-by")).toBeHidden();
  }
  return i;
}

// A game with every cell filled but one, loaded as the saved game.
function almostSolved(level = "beginner") {
  const s = newGame({ ...P, level });
  const empties = s.givens.map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
  for (const i of empties.slice(0, -1)) s.entries[i] = s.solution[i];
  return { state: s, last: empties[empties.length - 1] };
}

test("mistake 1: an encouraging quote, mistake 2: a warning; the hint sentence is gone", async ({ page }) => {
  await openGame(page);
  const [a, b] = emptyIndices(await values(page));
  await enter(page, a, wrongFor(P, a));
  await expect(page.locator("#dialog-title")).toHaveText("Mistake 1/3");
  await shownQuote(page, "mistake1");
  await expect(page.locator("#dialog-text")).not.toContainText("taking a hint next time");
  await ackMistake(page);
  await enter(page, b, wrongFor(P, b));
  await expect(page.locator("#dialog-title")).toHaveText("Mistake 2/3");
  await shownQuote(page, "mistake2");
});

test("lost: a quote from the lost list, also after a reload", async ({ page }) => {
  await openGame(page);
  await threeMistakes(page, P, await values(page));
  await expect(page.locator("#dialog-title")).toHaveText("You lost the game.");
  await shownQuote(page, "lost");
  await page.reload();
  await expect(dialog(page)).toBeVisible();
  await shownQuote(page, "lost");
});

test("solved: a quote from the won list, for every level", async ({ page }) => {
  const { state, last } = almostSolved("master");
  await openPosition(page, state);
  await enter(page, last, P.solution[last]);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await shownQuote(page, "won");
});

test("the confirm dialog keeps its sentence, no quote", async ({ page }) => {
  await openGame(page);
  const i = emptyIndices(await values(page))[0];
  await enter(page, i, P.solution[i]);
  await page.locator("#new-game").click();
  await expect(page.locator("#dialog-text")).toHaveText("Your progress in this game will be lost.");
  await expect(page.locator("#dialog-text")).not.toHaveClass(/quote/);
  await expect(page.locator("#dialog-by")).toBeHidden();
});

test("screen readers: the quote and the speaker describe the dialog", async ({ page }) => {
  await openGame(page);
  const i = emptyIndices(await values(page))[0];
  await enter(page, i, wrongFor(P, i));
  await expect(page.locator(".dialog")).toHaveAttribute("aria-describedby", "dialog-text dialog-by");
});

test("no quote twice in a row: two mistake-1 popups in two games differ", async ({ page }) => {
  await openGame(page);
  const seen = [];
  for (let g = 0; g < 2; g++) {
    const i = emptyIndices(await values(page))[0];
    await enter(page, i, wrongFor(P, i));
    seen.push(await shownQuote(page, "mistake1"));
    await ackMistake(page);
    if (g === 0) {
      await page.locator("#new-game").click();
      await page.locator("#dialog-new").click();
      await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
      await expect(dialog(page)).toBeHidden();
    }
  }
  expect(seen[0]).not.toBe(seen[1]);
});

test.describe("German (PRD 3.8)", () => {
  test.use({ locale: "de-DE" });

  test("the popups show the German quote and speaker", async ({ page }) => {
    await openGame(page);
    const [a] = emptyIndices(await values(page));
    await enter(page, a, wrongFor(P, a));
    await expect(page.locator("#dialog-title")).toHaveText("Fehler 1/3");
    await shownQuote(page, "mistake1", "de");
  });

  test("solved in German: a German quote from the won list", async ({ page }) => {
    const { state, last } = almostSolved();
    await openPosition(page, state);
    await enter(page, last, P.solution[last]);
    await expect(page.locator("#dialog-title")).toHaveText("Gelöst!");
    await shownQuote(page, "won", "de");
  });
});
