const { test, expect, openPuzzle, solveByDragging, dragNodeTo, getState } = require("./helpers");

test("page has a favicon and the title is the game name", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await expect(page).toHaveTitle("Untangle Me");
  const href = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(href).toBe("assets/favicon.svg");
  const res = await page.request.get(new URL(href, page.url()).toString());
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
});

test("solving fires confetti once, shows a check in the title and clears afterwards", async ({ page }) => {
  const errors = await openPuzzle(page, "#n=8&seed=42");
  await expect(page.locator("#confetti")).toBeHidden();
  await solveByDragging(page);
  await expect(page.locator("#confetti")).toBeVisible();
  await expect(page.locator("#confetti")).toHaveAttribute("data-fired", "1");
  await expect(page).toHaveTitle("✓ Untangle Me");

  // Fiddling around after solving must not fire it again.
  const s = await getState(page);
  await dragNodeTo(page, 0, [s.positions[0][0] > 0.5 ? 0.1 : 0.9, 0.1]);
  await dragNodeTo(page, 0, s.positions[0]);
  await expect(page.locator("#confetti")).toHaveAttribute("data-fired", "1");

  await expect(page.locator("#confetti")).toBeHidden({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test("confetti never appears with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  expect((await getState(page)).status).toBe("solved");
  await expect(page).toHaveTitle("✓ Untangle Me");
  await expect(page.locator("#confetti")).toBeHidden();
  expect(await page.locator("#confetti").getAttribute("data-fired")).toBeNull();
});

test("new puzzle and reset restore the plain title", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  await expect(page).toHaveTitle("✓ Untangle Me");
  await page.click("#reset");
  await expect(page).toHaveTitle("Untangle Me");
  await solveByDragging(page);
  await expect(page).toHaveTitle("✓ Untangle Me");
  await page.click("#new-puzzle");
  await expect(page).toHaveTitle("Untangle Me");
  await expect(page.locator("#confetti")).toBeHidden();
});

test("confetti really draws pixels, at full resolution and over the whole viewport", async ({ page }) => {
  await openPuzzle(page, "#n=8&seed=42");
  await solveByDragging(page);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const c = document.getElementById("confetti");
    const r = c.getBoundingClientRect();
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return { painted, bufW: c.width, bufH: c.height, w: r.width, h: r.height,
             vw: window.innerWidth, vh: window.innerHeight, top: r.top, left: r.left };
  });
  expect(info.painted).toBeGreaterThan(200);
  expect(Math.round(info.w)).toBe(info.vw);
  expect(Math.round(info.h)).toBe(info.vh);
  expect(info.top).toBe(0);
  expect(info.left).toBe(0);
  // buffer matches the displayed size (not the 300x150 default of a hidden canvas)
  expect(info.bufW).toBeGreaterThanOrEqual(info.vw);
  expect(info.bufH).toBeGreaterThanOrEqual(info.vh);
});
