import { test, expect } from "@playwright/test";
import { openTool, tile, idOfType } from "./helpers.js";

test("bad or unknown URL parameters are named in a short note and the defaults are used", async ({ page }) => {
  await openTool(page, "?depth=99&foo=1&map=angular&anchors=x");
  const note = page.locator("#message");
  await expect(note).toContainText("Ignored or corrected URL parameters");
  for (const name of ["depth", "foo", "map", "anchors"]) await expect(note).toContainText(name);
  await expect(page.locator("#map")).toHaveValue("plane");
});

test("good URL parameters give no note", async ({ page }) => {
  await openTool(page, "?depth=4&map=radial&ctr=dark&h0=30&shuffle=9&sw=12&anchors=3,5");
  await expect(page.locator("#message")).toHaveText("");
});

test("a failing clipboard is handled with a message that shows the link", async ({ page }) => {
  await openTool(page, "?depth=2");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    document.execCommand = () => false;
  });
  await page.locator("#copy").click();
  await expect(page.locator("#message")).toContainText("Could not copy");
  await expect(page.locator("#message")).toContainText("depth=2");
});

test("without the clipboard API the fallback copies the link", async ({ page }) => {
  await openTool(page, "?depth=2");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    window["__copied"] = false;
    document.execCommand = (cmd) => { window["__copied"] = cmd === "copy"; return true; };
  });
  await page.locator("#copy").click();
  await expect(page.locator("#message")).toHaveText("Link copied.");
  expect(await page.evaluate(() => window["__copied"])).toBe(true);
});

test("the shuffle, slider and swap stay fast on the largest patch", async ({ page }) => {
  await openTool(page, "?depth=5&shuffle=3&sw=100");
  const result = await page.evaluate(async () => {
    // the work itself: run the handler and force style and layout; frame scheduling is left out so a busy test machine does not matter
    const time = async (fn) => { const t0 = performance.now(); fn(); document.body.getBoundingClientRect(); return performance.now() - t0; };
    const slider = /** @type {HTMLInputElement} */ (document.querySelector("#in-h0"));
    let sliderTotal = 0;
    for (let k = 0; k < 20; k++) {
      sliderTotal += await time(() => { slider.value = String(100 + k * 5); slider.dispatchEvent(new Event("input", { bubbles: true })); });
    }
    const shuffle = await time(() => /** @type {HTMLElement} */ (document.querySelector("#shuffle")).click());
    const reset = await time(() => /** @type {HTMLElement} */ (document.querySelector("#reset")).click());
    return { slider: sliderTotal / 20, shuffle, reset };
  });
  // generous limits: the point is to catch a rebuild of the whole picture on every slider step
  expect(result.slider, "slider step").toBeLessThan(150);
  expect(result.shuffle, "shuffle").toBeLessThan(500);
  expect(result.reset, "reset").toBeLessThan(500);
});

test("a swap on the largest patch is immediate", async ({ page }) => {
  await openTool(page, "?depth=5&shuffle=3&sw=100");
  const a = await idOfType(page, "thick", 10), b = await idOfType(page, "thick", 50);
  await tile(page, a).click();
  const ms = await page.evaluate(async (target) => {
    const el = document.querySelector(`.tile[data-id="${target}"]`);
    const t0 = performance.now();
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    document.body.getBoundingClientRect();
    return performance.now() - t0;
  }, b);
  expect(ms).toBeLessThan(300);
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 1");
});
