import { test, expect } from "@playwright/test";
import { openGame, contrast, cell, values } from "./helpers.js";
import { emptyIndices } from "./play-helpers.js";

const SCHEMES = ["starwars", "bw", "blue", "sepia", "dark", "forest", "rainbow"];

test.beforeEach(async ({ page }) => { await openGame(page); });

test("Star Wars is the default scheme (since 2026-11-16)", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "starwars");
  await expect(page.locator("#scheme")).toHaveValue("starwars");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(4, 5, 11)");
  expect(await page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#04050b");
});

test("the dropdown offers the seven schemes", async ({ page }) => {
  const values = await page.$$eval("#scheme option", (o) => o.map((x) => x.value));
  expect(values).toEqual(SCHEMES);
});

test("switching the scheme changes the colours live and the theme-color meta", async ({ page }) => {
  const seen = new Set();
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    await expect(page.locator("html")).toHaveAttribute("data-scheme", s);
    const look = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return [cs.getPropertyValue("--page-bg"), cs.getPropertyValue("--ink"), cs.getPropertyValue("--sel-bg")].join("|");
    });
    seen.add(look);
    const meta = await page.locator('meta[name="theme-color"]').getAttribute("content");
    const pageBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--page-bg").trim());
    expect(meta.toLowerCase()).toBe(pageBg.toLowerCase());
  }
  expect(seen.size).toBe(SCHEMES.length);
});

test("every scheme: digits are readable (contrast >= 4.5) on every cell background", async ({ page }) => {
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = (n) => cs.getPropertyValue(n).trim();
      return Object.fromEntries(["ink", "player", "wrong", "muted", "cell-bg", "peer-bg", "same-bg", "sel-bg", "conflict-bg",
        "page-bg", "btn-bg", "btn-ink", "primary-bg", "primary-ink"].map((n) => [n, get("--" + n)]));
    });
    const backgrounds = ["cell-bg", "peer-bg", "same-bg", "sel-bg", "conflict-bg"];
    for (const bg of backgrounds) {
      for (const fg of ["ink", "player", "wrong"]) {
        expect(contrast(v[fg], v[bg]), `${s}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(v.muted, v["cell-bg"]), s + ": notes on cell").toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.muted, v["page-bg"]), s + ": labels on page").toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["btn-ink"], v["btn-bg"]), s + ": buttons").toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["primary-ink"], v["primary-bg"]), s + ": primary button").toBeGreaterThanOrEqual(4.5);
  }
});

test("every scheme: the layers selected, same, peer, plain are visibly different", async ({ page }) => {
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ["cell-bg", "peer-bg", "same-bg", "sel-bg", "conflict-bg"].map((n) => cs.getPropertyValue("--" + n).trim());
    });
    expect(new Set(v).size, s).toBe(5);
  }
});

test("the red of wrong digits and conflicts is distinct from the digit colours in every scheme", async ({ page }) => {
  for (const s of SCHEMES) {
    await page.selectOption("#scheme", s);
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ["ink", "player", "wrong"].map((n) => cs.getPropertyValue("--" + n).trim());
    });
    expect(new Set(v).size, s).toBe(3);
  }
});

test("the layout does not change when the scheme changes", async ({ page }) => {
  const before = await page.locator("#board").boundingBox();
  await page.selectOption("#scheme", "dark");
  const after = await page.locator("#board").boundingBox();
  expect(after).toEqual(before);
});

// ---- Star Wars and Rainbow (change requests 2026-11-16) ------------------------------

const hex = (rgb) => "#" + rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
const rootVar = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test("Rainbow: every 3x3 box has its own tint, digits stay readable on every tint", async ({ page }) => {
  await page.selectOption("#scheme", "rainbow");
  // the tint is the cell's own --cell-bg (a highlighted cell shows its layer instead)
  const tints = await page.$$eval(".cell", (els) => {
    const out = {};
    for (const e of els) {
      const t = getComputedStyle(e).getPropertyValue("--cell-bg").trim();
      (out[e.dataset.box] ||= new Set()).add(t);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
  });
  expect(Object.keys(tints).length).toBe(9);
  for (const v of Object.values(tints)) expect(v.length).toBe(1);
  expect(new Set(Object.values(tints).map((v) => v[0])).size).toBe(9);
  // plain cells show their box tint (polled: the cell background fades over on a scheme switch)
  await expect.poll(async () => {
    const plain = await page.$$eval(".cell", (els) => els.filter((e) => !e.className.match(/peer|same|sel|conflict/))
      .map((e) => [e.dataset.box, getComputedStyle(e).backgroundColor]));
    return plain.filter(([box, bg]) => hex(bg) !== tints[box][0]).length;
  }).toBe(0);
  for (const fg of ["--ink", "--player", "--wrong", "--muted"]) {
    const c = await rootVar(page, fg);
    for (const [box, [bg]] of Object.entries(tints)) expect(contrast(c, bg), `${fg} on box ${box}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("Rainbow: highlighted cells use the highlight layers, not the box tint", async ({ page }) => {
  await page.selectOption("#scheme", "rainbow");
  const i = emptyIndices(await values(page))[0];
  await cell(page, i).click();
  const sel = await rootVar(page, "--sel-bg");
  // polled: the cell background fades over (transition)
  await expect.poll(async () => hex(await cell(page, i).evaluate((e) => getComputedStyle(e).backgroundColor))).toBe(sel);
});

test("Star Wars: first in the list, starfield page, glowing frame and digits, title in capitals", async ({ page }) => {
  expect(await page.$eval("#scheme option", (o) => o.value)).toBe("starwars");
  await page.selectOption("#scheme", "starwars");
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(bodyBg).toContain("radial-gradient");
  expect(await page.locator("#board").evaluate((e) => getComputedStyle(e).filter)).toContain("drop-shadow");
  expect(await page.$eval('.cell[data-state="given"] .digit', (e) => getComputedStyle(e).textShadow)).not.toBe("none");
  expect(await page.locator(".title").evaluate((e) => getComputedStyle(e).textTransform)).toBe("uppercase");
  await expect(page.locator(".title")).toHaveText("Sudoku"); // only the look changes, not the text
  // cells are opaque: highlights keep their layer colours
  const i = emptyIndices(await values(page))[0];
  await cell(page, i).click();
  const sel = await rootVar(page, "--sel-bg");
  await expect.poll(async () => hex(await cell(page, i).evaluate((e) => getComputedStyle(e).backgroundColor))).toBe(sel);
});

test("Neon is gone; the old Classic Blue is now called Blue", async ({ page }) => {
  expect(await page.$$eval("#scheme option", (os) => os.map((o) => o.value))).not.toContain("neon");
  expect(await page.$eval('#scheme option[value="blue"]', (o) => o.textContent)).toBe("Blue");
});

test("glow and tints stay in their schemes: Black & White has neither", async ({ page }) => {
  await page.selectOption("#scheme", "starwars");
  await page.selectOption("#scheme", "bw");
  expect(await page.$eval('.cell[data-state="given"] .digit', (e) => getComputedStyle(e).textShadow)).toBe("none");
  expect(await page.locator("#board").evaluate((e) => getComputedStyle(e).filter)).toBe("none");
  await expect.poll(() => page.$$eval(".cell", (els) => [...new Set(els.filter((e) => !e.className.match(/peer|same|sel|conflict/))
    .map((e) => getComputedStyle(e).backgroundColor))])).toEqual(["rgb(255, 255, 255)"]);
});
