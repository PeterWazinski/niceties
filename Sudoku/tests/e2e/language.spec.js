// Language (PRD 3.8): device language at first start, globe toggle, German texts
// everywhere, Coach in German, layout with the longer German labels.
import { test, expect } from "@playwright/test";
import { openGame, cell, values } from "./helpers.js";
import { enter, num, keepWrong, threeMistakes, puzzleFor, emptyIndices, wrongFor, dialog, waitIdle } from "./play-helpers.js";
import { expertPosition, openPosition, panel } from "./coach-helpers.js";
import { explain, cellNamer } from "../../js/coach.js";
import { QUOTES } from "../../js/quotes.js";

test.use({ reducedMotion: "reduce" });

const optionTexts = (page, sel) => page.$$eval(`${sel} option`, (os) => os.map((o) => o.textContent));
const germanTexts = (chain) => { const n = cellNamer("de"); return chain.steps.map((s, i) => explain(s, n, { afterEliminations: i > 0, lang: "de" })); };

test.describe("German device", () => {
  test.use({ locale: "de-DE" });

  test("starts in German: header, status row, levels, schemes, tools, tip, <html lang>", async ({ page }) => {
    await openGame(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.locator("#new-game")).toHaveText("Neues Spiel");
    await expect(page.locator("#lang-code")).toHaveText("DE");
    await expect(page.locator("#lang")).toHaveAttribute("aria-label", "Sprache: Deutsch. Auf Englisch umschalten");
    await expect(page.locator(".field-label")).toHaveText(["Stufe", "Fehler", "Farben"]);
    expect(await optionTexts(page, "#level")).toEqual(["Jüngling", "Padawan", "Jedi"]);
    expect(await optionTexts(page, "#scheme")).toEqual(["Star Wars", "B/W", "Blau", "Sepia", "Nacht", "Wald", "Regenbogen"]);
    await expect(page.locator("#hint")).toHaveText("Hinweis");
    await expect(page.locator("#coach")).toHaveText("Coach");
    await expect(page.locator("#tip")).toHaveText("Tipp: Zahl lang drücken für eine Notiz");
    await expect(page.locator("#board")).toHaveAttribute("aria-label", "Sudoku-Spielfeld");
    await expect(page.locator("#help-text")).toHaveText("Hilfe: 0 von 4 genutzt");
    expect(await page.title()).toBe("Sudoku");
  });

  test("the globe toggles live both ways; the label is the current language", async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => { window.noReload = true; });
    await page.locator("#lang").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#lang-code")).toHaveText("EN");
    await expect(page.locator("#new-game")).toHaveText("New Game");
    expect(await optionTexts(page, "#level")).toEqual(["Youngling", "Padawan", "Jedi"]);
    await expect(page.locator("#live")).toContainText("English");
    await page.locator("#lang").click();
    await expect(page.locator("#lang-code")).toHaveText("DE");
    await expect(page.locator("#new-game")).toHaveText("Neues Spiel");
    await expect(page.locator("#live")).toContainText("Deutsch");
    expect(await page.evaluate(() => window.noReload)).toBe(true);
  });

  test("the choice survives a reload and wins over the device language", async ({ page }) => {
    await openGame(page);
    await page.locator("#lang").click();
    await page.reload();
    await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#new-game")).toHaveText("New Game");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await page.evaluate(() => localStorage.getItem("sudoku.lang"))).toBe("en");
  });

  test("the game is not touched by a switch", async ({ page }) => {
    await openGame(page);
    const P = puzzleFor(12);
    const i = emptyIndices(await values(page))[0];
    await enter(page, i, P.solution[i]);
    const before = await values(page);
    await page.locator("#lang").click();
    expect(await values(page)).toEqual(before);
    await expect(cell(page, i)).toHaveClass(/sel/);
  });

  test("dialogs and the notice in German", async ({ page }) => {
    await openGame(page);
    const P = puzzleFor(12);
    const empties = emptyIndices(await values(page));
    await enter(page, empties[0], wrongFor(P, empties[0]));
    await expect(page.locator("#dialog-title")).toHaveText("Fehler 1/3");
    expect(QUOTES.mistake1.map((q) => q.de)).toContain(await page.locator("#dialog-text").textContent());
    await expect(page.locator("#dialog-new")).toHaveText("OK");
    await page.locator("#dialog-new").click();
    await waitIdle(page);
    await page.locator("#new-game").click();
    await expect(page.locator("#dialog-title")).toHaveText("Spiel beenden?");
    await expect(page.locator("#dialog-text")).toHaveText("Der Fortschritt in diesem Spiel geht verloren.");
    await expect(page.locator("#dialog-new")).toHaveText("Neues Spiel");
    await expect(page.locator("#dialog-cancel")).toHaveText("Abbrechen");
    await page.locator("#dialog-cancel").click();
    await keepWrong(page, empties[1], wrongFor(P, empties[1]));
    await cell(page, empties[2]).click();
    await expect(page.locator("#notice")).toHaveText("Zuerst die rote Ziffer korrigieren oder löschen.");
  });

  test("the lost-game dialog in German", async ({ page }) => {
    await openGame(page);
    await threeMistakes(page, puzzleFor(12), await values(page));
    await expect(page.locator("#dialog-title")).toHaveText("Spiel verloren.");
    expect(QUOTES.lost.map((q) => q.de)).toContain(await page.locator("#dialog-text").textContent());
    await expect(page.locator("#dialog-new")).toHaveText("Neu spielen");
  });

  test("screen readers: cell labels and announcements in German", async ({ page }) => {
    await openGame(page);
    const P = puzzleFor(12);
    const given = P.givens.findIndex(Boolean);
    const r = Math.floor(given / 9) + 1, c = (given % 9) + 1;
    await expect(cell(page, given)).toHaveAttribute("aria-label", `Reihe ${r}, Spalte ${c}, ${P.givens[given]}, vorgegeben`);
    const i = emptyIndices(await values(page))[0];
    await cell(page, i).click();
    await expect(cell(page, i)).toHaveAttribute("aria-label", /^Reihe \d, Spalte \d, leer$/);
    await num(page, P.solution[i]).click();
    await expect(page.locator("#live")).toContainText("Richtig.");
    await expect(cell(page, i)).toHaveAttribute("aria-label", new RegExp(`, ${P.solution[i]}, richtig$`));
  });

  test("Coach in German; switching with the panel open redraws it, names long again", async ({ page }) => {
    const { state, chain } = expertPosition();
    await openPosition(page, state);
    await page.locator("#coach").click();
    const de = germanTexts(chain);
    const n = chain.steps.length;
    await expect(page.locator("#coach-title")).toHaveText(`Schritt 1 von ${n} · ${de[0].title} · ${de[0].level}`);
    await expect(page.locator("#coach-note")).toHaveText("Dieser Schritt entfernt Kandidaten; noch kann kein Feld gefüllt werden.");
    await expect(page.locator("#coach-body")).toHaveText(de[0].text);
    await expect(page.locator("#coach-next")).toHaveText("Weiter");
    await expect(page.locator("#coach-close")).toHaveText("Schließen");
    // switch to English while coaching
    await page.locator("#lang").click();
    const en = (() => { const nm = cellNamer("en"); return chain.steps.map((s, i) => explain(s, nm, { afterEliminations: i > 0 })); })();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator("#coach-title")).toHaveText(`Step 1 of ${n} · ${en[0].title} · ${en[0].level}`);
    await expect(page.locator("#coach-body")).toHaveText(en[0].text);
    await expect(page.locator("#coach-next")).toHaveText("Next");
    // back to German, through to Fill
    await page.locator("#lang").click();
    for (let k = 0; k < n; k++) {
      await expect(page.locator("#coach-body")).toHaveText(de[k].text);
      await expect(page.locator("#coach-next")).toHaveText(k === n - 1 ? "Eintragen" : "Weiter");
      await page.locator("#coach-next").click();
    }
    await expect(panel(page)).toBeHidden();
    await waitIdle(page);
    await expect(cell(page, chain.placement.cell)).toHaveAttribute("data-value", String(chain.placement.digit));
    await expect(page.locator("#live")).toContainText(`Coach: ${chain.placement.digit} in Reihe`);
  });

  test("German layout: the page never scrolls, also with the Coach open; buttons ≥ 44 px", async ({ page }) => {
    const { state } = expertPosition();
    await openPosition(page, state);
    const fits = () => page.evaluate(() => ({
      h: document.documentElement.scrollHeight <= innerHeight, w: document.documentElement.scrollWidth <= innerWidth
    }));
    expect(await fits()).toEqual({ h: true, w: true });
    for (const sel of ["#lang", "#new-game", "#hint", "#coach"]) {
      const b = await page.locator(sel).boundingBox();
      expect(b.height, sel).toBeGreaterThanOrEqual(44);
      expect(b.width, sel).toBeGreaterThanOrEqual(44);
      await expect(page.locator(sel)).toBeInViewport();
    }
    await page.locator("#coach").click();
    expect(await fits()).toEqual({ h: true, w: true });
    for (const sel of ["#coach-close", "#coach-next"]) await expect(page.locator(sel)).toBeInViewport();
  });

  test("German labels do not wrap or get cut off", async ({ page }) => {
    await openGame(page);
    for (const sel of ["#new-game", "#hint", "#coach", "#lang", "#tip"]) {
      const over = await page.locator(sel).evaluate((e) => e.scrollWidth > e.clientWidth + 1);
      expect(over, `${sel} cut off`).toBe(false);
    }
    // one line: less than two font sizes high
    const tip = await page.locator("#tip").evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).fontSize));
    expect(tip, "tip on one line").toBeLessThan(2);
    const ng = await page.locator("#new-game").evaluate((e) => ({ h: e.scrollHeight, f: parseFloat(getComputedStyle(e).fontSize) }));
    expect(ng.h / ng.f, "New Game on one line").toBeLessThan(3.2);
  });
});

test.describe("English device", () => {
  test.use({ locale: "en-US" });

  test("starts in English; the globe says EN", async ({ page }) => {
    await openGame(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#lang-code")).toHaveText("EN");
    await expect(page.locator("#lang")).toHaveAttribute("aria-label", "Language: English. Switch to German");
    await expect(page.locator("#new-game")).toHaveText("New Game");
  });

  test("an invalid saved language falls back to the device language", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sudoku.lang", "klingon"));
    await openGame(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
