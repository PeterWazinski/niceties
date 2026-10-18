import { test, expect } from "@playwright/test";

const LEVELS = ["beginner", "expert", "master"];

async function open(page) {
  await page.goto("tests/e2e/fixtures/worker.html");
  await page.waitForFunction(() => window.fixtureReady === true);
}

test("the worker generates a valid puzzle per level", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.fixture.usesWorker())).toBe(true);
  for (const level of LEVELS) {
    const r = await page.evaluate(([l]) => window.fixture.generate(l, 4711), [level]);
    expect(r.level).toBe(level);
    expect(r.unique).toBe(true);
    expect(r.graded).toBe(level);
    expect(r.fallback).toBe(false);
  }
});

test("generation in the worker keeps the main thread responsive", async ({ page }) => {
  await open(page);
  const worst = await page.evaluate(() => window.fixture.longestGap(5));
  expect(worst).toBeLessThan(250);
});

test("without Worker support the generator falls back to the main thread", async ({ page }) => {
  await page.addInitScript(() => { delete window.Worker; });
  await open(page);
  expect(await page.evaluate(() => window.fixture.usesWorker())).toBe(false);
  const r = await page.evaluate(() => window.fixture.generate("expert", 99));
  expect(r.unique).toBe(true);
  expect(r.graded).toBe("expert");
});
