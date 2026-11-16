// Coach (PRD 3.4.1): explanation step by step, board marks, Fill, Close, shared help limit.
import { test, expect } from "@playwright/test";
import { openGame, cell, values, contrast } from "./helpers.js";
import { num, waitIdle, useHint, keepWrong, mistakes, wrongFor, puzzleFor, emptyIndices, hold } from "./play-helpers.js";
import { positionWhere, beginnerPosition, expertPosition, masterPosition, openPosition, panel, helpsUsed } from "./coach-helpers.js";
import { explain, cellNamer } from "../../js/coach.js";
import { techniqueLevel } from "../../js/techniques.js";

test.use({ reducedMotion: "reduce" });

const BEGINNER = beginnerPosition();
const EXPERT = expertPosition();
const MASTER = masterPosition();

// The texts the page must show for a chain (same functions, same order).
const textsOf = (chain) => { const n = cellNamer(); return chain.steps.map((s, i) => explain(s, n, { afterEliminations: i > 0 })); };

// Steps through the whole chain with Next and finishes with Fill; returns the titles seen.
async function runThrough(page, chain) {
  const texts = textsOf(chain);
  const titles = [];
  for (let k = 0; k < chain.steps.length; k++) {
    const last = k === chain.steps.length - 1;
    // several steps: "Step k of n" in front; elimination steps carry the note (PRD 3.4.1)
    const counter = chain.steps.length > 1 ? `Step ${k + 1} of ${chain.steps.length} · ` : "";
    await expect(page.locator("#coach-title")).toHaveText(`${counter}${texts[k].title} · ${texts[k].level}`);
    await expect(page.locator("#coach-body")).toHaveText(texts[k].text);
    if (last) await expect(page.locator("#coach-note")).toBeHidden();
    else await expect(page.locator("#coach-note")).toHaveText("This step removes candidates; no cell can be filled yet.");
    await expect(page.locator("#coach-next")).toHaveText(last ? "Fill" : "Next");
    titles.push(texts[k].title);
    await page.locator("#coach-next").click();
  }
  await expect(panel(page)).toBeHidden();
  await waitIdle(page);
  return titles;
}

const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");

test("beginner position: one step, the key cell is marked, Fill places the digit and uses one help", async ({ page }) => {
  const { state, chain } = BEGINNER;
  await openPosition(page, state);
  await expect(page.locator("#coach")).toBeVisible();
  await page.locator("#coach").click();
  await expect(panel(page)).toBeVisible();
  await expect(page.locator("#numpad")).toBeHidden();
  await expect(page.locator("#hint")).toBeHidden();
  const { cell: target, digit } = chain.placement;
  await expect(cell(page, target)).toHaveClass(/coach-key/);
  await expect(cell(page, target).locator(".cands .key")).toHaveText(String(digit));
  expect(await helpsUsed(page)).toBe("0");
  await runThrough(page, chain);
  await expect(cell(page, target)).toHaveAttribute("data-value", String(digit));
  await expect(cell(page, target)).toHaveAttribute("data-state", "locked");
  await expect(cell(page, target)).toHaveClass(/sel/);
  expect(await helpsUsed(page)).toBe("1");
  await expect(page.locator("#numpad")).toBeVisible();
  await expect(page.locator("#coach")).toBeVisible();
  await expect(page.locator(".coach-key, .coach-unit")).toHaveCount(0);
});

test("expert position: eliminations with Next (red, struck through), then Fill", async ({ page }) => {
  const { state, chain } = EXPERT;
  await openPosition(page, state);
  await page.locator("#coach").click();
  const first = chain.steps[0];
  expect(first.eliminations && first.removed.length).toBeTruthy();
  await expect(page.locator("#coach-next")).toHaveText("Next");
  const removed = page.locator(".cands .removed");
  await expect(removed).toHaveCount(first.removed.length);
  const style = await removed.first().evaluate((e) => {
    const cs = getComputedStyle(e);
    return { deco: cs.textDecorationLine, color: cs.color, wrong: getComputedStyle(document.documentElement).getPropertyValue("--wrong").trim() };
  });
  expect(style.deco).toContain("line-through");
  expect(hex(style.color)).toBe(style.wrong);
  const keyWeight = await page.locator(".cands .key").first().evaluate((e) => Number(getComputedStyle(e).fontWeight));
  expect(keyWeight).toBeGreaterThanOrEqual(700);
  // the cells of the step's key and removed candidates are the only ones showing candidates
  const shownCells = await page.$$eval(".cell", (els) => els.filter((e) => [...e.querySelectorAll(".cands span")].some((s) => s.textContent)).map((e) => Number(e.dataset.i)));
  expect(shownCells.sort((a, b) => a - b)).toEqual(Object.keys(first.shown).map(Number).sort((a, b) => a - b));
  await page.locator("#coach-close").click();
  await page.locator("#coach").click();
  await runThrough(page, chain);
  await expect(cell(page, chain.placement.cell)).toHaveAttribute("data-value", String(chain.placement.digit));
  expect(await helpsUsed(page)).toBe("1");
});

test("several steps: the step counter and the note make clear that no cell is filled yet", async ({ page }) => {
  const { state, chain } = positionWhere((steps) => steps.length >= 3, ["master"]);
  await openPosition(page, state);
  await page.locator("#coach").click();
  const n = chain.steps.length;
  await expect(page.locator("#coach-title")).toHaveText(new RegExp(`^Step 1 of ${n} · `));
  await expect(page.locator("#coach-note")).toBeVisible();
  await expect(page.locator("#live")).toContainText(`Step 1 of ${n}. `);
  await expect(page.locator("#live")).toContainText("no cell can be filled yet");
  for (let k = 1; k < n; k++) await page.locator("#coach-next").click();
  await expect(page.locator("#coach-title")).toHaveText(new RegExp(`^Step ${n} of ${n} · (Hidden|Naked) Single · Youngling$`));
  await expect(page.locator("#coach-note")).toBeHidden();
  await expect(page.locator("#coach-next")).toHaveText("Fill");
});

test("one step: no counter, no note", async ({ page }) => {
  await openPosition(page, BEGINNER.state);
  await page.locator("#coach").click();
  await expect(page.locator("#coach-title")).toHaveText(/^(Hidden|Naked) Single · Youngling$/);
  await expect(page.locator("#coach-note")).toBeHidden();
});

test("master position: the chain runs through a master technique to Fill", async ({ page }) => {
  const { state, chain } = MASTER;
  await openPosition(page, state);
  await page.locator("#coach").click();
  const titles = await runThrough(page, chain);
  expect(chain.steps.some((s) => techniqueLevel(s.technique) === "master")).toBe(true);
  expect(titles.length).toBe(chain.steps.length);
  await expect(cell(page, chain.placement.cell)).toHaveAttribute("data-value", String(chain.placement.digit));
});

test("cell names: long on first mention, short afterwards (texts as computed by the engine)", async ({ page }) => {
  const { state, chain } = positionWhere((steps) => {
    const n = cellNamer();
    return steps.map((s, i) => explain(s, n, { afterEliminations: i > 0 }).text).join(" ").match(/\br\dc\d\b/) !== null;
  }, ["master", "expert"]);
  await openPosition(page, state);
  await page.locator("#coach").click();
  // every short name "r4c6" comes after the long "row 4, column 6" of the same cell
  const texts = textsOf(chain).map((t) => t.text).join(" ");
  for (const m of texts.matchAll(/\br(\d)c(\d)\b/g)) {
    const long = texts.indexOf(`row ${m[1]}, column ${m[2]}`);
    expect(long).toBeGreaterThanOrEqual(0);
    expect(long).toBeLessThan(m.index);
  }
  await runThrough(page, chain); // the page shows exactly these texts
});

test("Close at any step: nothing used, board unchanged, notes back exactly as before", async ({ page }) => {
  const { state, chain } = EXPERT;
  await openPosition(page, state);
  const empties = emptyIndices(await values(page));
  await cell(page, empties[0]).click();
  await hold(page, 3);
  await hold(page, 7);
  const label = await cell(page, empties[0]).getAttribute("aria-label");
  const before = await values(page);
  await page.locator("#coach").click();
  await expect(cell(page, empties[0]).locator(".notes")).toBeHidden();
  if (chain.steps.length > 1) await page.locator("#coach-next").click(); // close in the middle
  await page.locator("#coach-close").click();
  await expect(panel(page)).toBeHidden();
  expect(await values(page)).toEqual(before);
  expect(await helpsUsed(page)).toBe("0");
  await expect(cell(page, empties[0]).locator(".notes")).toBeVisible();
  await expect(cell(page, empties[0])).toHaveAttribute("aria-label", label);
  await expect(page.locator(".cands span.key, .cands span.removed")).toHaveCount(0);
  await expect(page.locator("#coach")).toBeFocused();
});

test("taps on the board and the number pad do nothing while the Coach is open", async ({ page }) => {
  const { state, chain } = BEGINNER;
  await openPosition(page, state);
  await page.locator("#coach").click();
  const before = await values(page);
  const other = emptyIndices(before).find((i) => i !== chain.placement.cell);
  await cell(page, other).click();
  await expect(cell(page, other)).not.toHaveClass(/sel/);
  await page.keyboard.press("Digit" + state.solution[other]);
  await page.keyboard.press("h");
  expect(await values(page)).toEqual(before);
  await expect(panel(page)).toBeVisible();
});

test("shared limit: 2 hints + 2 coach fills use all four helps; then Hint and Coach are refused", async ({ page }) => {
  await openGame(page);
  await useHint(page);
  await useHint(page);
  for (let n = 0; n < 2; n++) {
    await page.locator("#coach").click();
    while (await page.locator("#coach-next").textContent() === "Next") await page.locator("#coach-next").click();
    await page.locator("#coach-next").click();
    await expect(panel(page)).toBeHidden();
    await waitIdle(page);
  }
  expect(await helpsUsed(page)).toBe("4");
  await expect(page.locator("#help-dots > span.used")).toHaveCount(4);
  await expect(page.locator("#help-text")).toHaveText("Help: 4 of 4 used");
  await expect(page.locator("#hint")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#coach")).toHaveAttribute("aria-disabled", "true");
  const before = await values(page);
  await page.locator("#coach").click({ force: true });
  await page.keyboard.press("c");
  await page.keyboard.press("h");
  await expect(panel(page)).toBeHidden();
  expect(await values(page)).toEqual(before);
});

test("a wrong digit kept over a reload is cleared for free before coaching", async ({ page }) => {
  await openGame(page);
  const P = puzzleFor(12);
  const i = emptyIndices(await values(page))[0];
  await keepWrong(page, i, wrongFor(P, i));
  await page.locator("#coach").click();
  await expect(panel(page)).toBeVisible();
  await expect(cell(page, i)).toHaveAttribute("data-state", "empty");
  await expect(mistakes(page)).toHaveText("1/3");
  expect(await helpsUsed(page)).toBe("0");
});

test("keyboard: C opens, Escape closes, Enter steps and fills", async ({ page }) => {
  const { state, chain } = EXPERT;
  await openPosition(page, state);
  await page.keyboard.press("c");
  await expect(panel(page)).toBeVisible();
  await expect(page.locator("#coach-next")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await page.keyboard.press("c");
  for (let k = 0; k < chain.steps.length; k++) await page.keyboard.press("Enter");
  await expect(panel(page)).toBeHidden();
  await waitIdle(page);
  await expect(cell(page, chain.placement.cell)).toHaveAttribute("data-value", String(chain.placement.digit));
});

test("screen readers: the step text is announced, coaching candidates are in the cell labels", async ({ page }) => {
  const { state, chain } = EXPERT;
  await openPosition(page, state);
  await page.locator("#coach").click();
  const t = textsOf(chain)[0];
  await expect(page.locator("#live")).toContainText(t.text);
  const e = chain.steps[0].removed[0];
  await expect(cell(page, e.cell)).toHaveAttribute("aria-label", new RegExp(`candidates [\\d ]+, (\\d )*${e.digit}( \\d)* removed`));
});

test("short landscape screens: the text scrolls, the buttons stay visible and large enough", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const { state } = positionWhere((s) => s.some((x) => x.technique === "xyWing") || s.length >= 3, ["master"]);
  await openPosition(page, state);
  await page.locator("#coach").click();
  const box = await page.locator("#coach-text").evaluate((e) => ({ ch: e.clientHeight, sh: e.scrollHeight, oy: getComputedStyle(e).overflowY }));
  expect(box.oy).toBe("auto");
  expect(box.ch).toBeLessThanOrEqual(box.sh);
  for (const sel of ["#coach-next", "#coach-close"]) {
    await expect(page.locator(sel)).toBeInViewport();
    const b = await page.locator(sel).boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});

test("the page never scrolls while coaching", async ({ page }) => {
  await openPosition(page, MASTER.state);
  await page.locator("#coach").click();
  const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  expect(m.sh).toBeLessThanOrEqual(m.ih);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  for (const sel of ["#coach-next", "#coach-close", "#coach-panel"]) await expect(page.locator(sel)).toBeInViewport();
});

test("coaching colours: key and removed candidates reach 4.5:1 in every scheme", async ({ page }) => {
  const { state } = EXPERT;
  await openPosition(page, state);
  await page.locator("#coach").click();
  for (const s of ["bw", "blue", "sepia", "dark", "forest"]) {
    await page.evaluate((id) => { document.documentElement.dataset.scheme = id; }, s);
    const pairs = await page.evaluate(() => {
      const out = [];
      for (const span of document.querySelectorAll(".cands span")) {
        if (!span.textContent) continue;
        const c = span.closest(".cell");
        out.push([getComputedStyle(span).color, getComputedStyle(c).backgroundColor, span.className]);
      }
      return out;
    });
    expect(pairs.length).toBeGreaterThan(0);
    for (const [fg, bg, cls] of pairs) expect(contrast(hex(fg), hex(bg)), `${s} ${cls}`).toBeGreaterThanOrEqual(4.5);
  }
});
