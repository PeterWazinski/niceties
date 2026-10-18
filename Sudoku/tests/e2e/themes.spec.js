import { test, expect } from "@playwright/test";
import { openGame, contrast } from "./helpers.js";

const SCHEMES = ["bw", "blue", "sepia", "dark", "forest"];

test.beforeEach(async ({ page }) => { await openGame(page); });

test("Black & White is the default scheme", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "bw");
  await expect(page.locator("#scheme")).toHaveValue("bw");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(255, 255, 255)");
});

test("the dropdown offers the five schemes", async ({ page }) => {
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
