import { test, expect } from "@playwright/test";
import { values, cell } from "./helpers.js";
import { enter, puzzleFor, emptyIndices, dialog, useHint } from "./play-helpers.js";

test.use({ reducedMotion: "reduce" });

const LEVEL_RANGE = { beginner: [38, 42], expert: [30, 34], master: [24, 28] };
const clues = (v) => v.filter((x) => x !== "").length;
const givensOf = (p) => p.givens.map((d) => (d ? String(d) : ""));

// Loads a page online and waits until the service worker has cached the app and controls the page.
async function loadOnline(page, url) {
  await page.goto(url);
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  // the worker installs, activates and takes control of this page (no single long-running evaluate)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 25000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const keys = await caches.keys();
    const key = keys.find((k) => k.startsWith("sudoku-"));
    return key ? (await (await caches.open(key)).keys()).length : 0;
  })).toBeGreaterThanOrEqual(25);
}

async function reloadOffline(page) {
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  await expect(page.locator(".cell")).toHaveCount(81);
}

test("offline: after one online load the game loads, can be solved and a new game can be started", async ({ page }) => {
  await loadOnline(page, "index.html?seed=12");
  await reloadOffline(page);
  const P = puzzleFor(12);
  expect(await values(page)).toEqual(givensOf(P));
  for (const i of emptyIndices(await values(page))) await enter(page, i, P.solution[i]);
  await expect(page.locator("#dialog-title")).toHaveText("Solved!");
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => values(page)).toEqual(givensOf(puzzleFor(12))); // the reload restarted the seed counter
});

test("offline: a new game at every level, hints, scheme change", async ({ page }) => {
  await loadOnline(page, "index.html");
  // wait for the background pool, then go offline
  await expect.poll(() => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("sudoku.pool") || "{}");
    return ["beginner", "expert", "master"].every((l) => p[l]);
  }), { timeout: 20000 }).toBe(true);
  await reloadOffline(page);
  for (const level of ["expert", "master", "beginner"]) {
    await page.selectOption("#level", level);
    const [lo, hi] = LEVEL_RANGE[level];
    await expect.poll(async () => { const n = clues(await values(page)); return n >= lo && n <= hi; }, { timeout: 10000 }).toBe(true);
  }
  const i = emptyIndices(await values(page))[0];
  await cell(page, i).click();
  await useHint(page);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await page.selectOption("#scheme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
});

test("a whole session talks only to the own origin", async ({ page, context }) => {
  const foreign = [];
  const origin = new URL(page.context()._options?.baseURL || "http://localhost:4174/").origin;
  context.on("request", (r) => {
    const u = r.url();
    if (/^https?:/.test(u) && new URL(u).origin !== origin) foreign.push(u);
  });
  await loadOnline(page, "index.html?seed=12");
  const P = puzzleFor(12);
  const empties = emptyIndices(await values(page));
  await enter(page, empties[0], P.solution[empties[0]]);
  await page.selectOption("#scheme", "forest");
  await useHint(page);
  await page.locator("#new-game").click();
  await page.locator("#dialog-new").click();
  await expect(dialog(page)).toBeHidden();
  expect(foreign).toEqual([]);
});

test("the app works from a sub-path like GitHub Pages: service worker scope and offline play", async ({ page }) => {
  await loadOnline(page, "/niceties/Sudoku/index.html?seed=12");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
  expect(scope).toBe(new URL("/niceties/Sudoku/", page.url()).href);
  await reloadOffline(page);
  const P = puzzleFor(12);
  expect(await values(page)).toEqual(givensOf(P));
  const i = emptyIndices(await values(page))[0];
  await enter(page, i, P.solution[i]);
  await expect(cell(page, i)).toHaveAttribute("data-state", "locked");
  await page.locator("#new-game").click();
  await page.locator("#dialog-new").click();
  await expect.poll(() => values(page)).toEqual(givensOf(puzzleFor(12)));
});

test("a new cache version replaces the old caches and leaves foreign caches alone", async ({ page }) => {
  await loadOnline(page, "index.html?seed=12");
  await page.evaluate(async () => { await caches.open("sudoku-v0-ancient"); await caches.open("other-site-cache"); });
  await page.evaluate(() => navigator.serviceWorker.register("sw.js?v=99"));
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).sort()), { timeout: 15000 })
    .toEqual(["other-site-cache", "sudoku-v99"]);
  // the new version has the whole app cached
  expect(await page.evaluate(async () => (await (await caches.open("sudoku-v99")).keys()).length)).toBeGreaterThanOrEqual(25);
});

test("manifest and icons can be loaded and are valid", async ({ page }) => {
  await page.goto("index.html?seed=12");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
  const result = await page.evaluate(async () => {
    const res = await fetch("manifest.webmanifest");
    const manifest = await res.json();
    const icons = [];
    for (const icon of manifest.icons) {
      const r = await fetch(icon.src);
      icons.push({ src: icon.src, ok: r.ok, type: r.headers.get("content-type") });
    }
    return { ok: res.ok, type: res.headers.get("content-type"), manifest, icons };
  });
  expect(result.ok).toBe(true);
  expect(result.type).toContain("manifest");
  expect(result.manifest.start_url).toBe("./");
  expect(result.icons).toHaveLength(3);
  for (const i of result.icons) { expect(i.ok, i.src).toBe(true); expect(i.type).toBe("image/png"); }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "icons/apple-touch-icon.png");
});

test("the page also works when the service worker is not available", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "serviceWorker", { value: undefined }); });
  await page.goto("index.html?seed=12");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  expect(await values(page)).toEqual(givensOf(puzzleFor(12)));
});
