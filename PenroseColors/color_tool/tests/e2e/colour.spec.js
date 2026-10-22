import { test, expect } from "@playwright/test";
import { openTool, fills } from "./helpers.js";

const SLIDERS = ["h0", "h1", "s", "l", "ds", "dl", "rot", "dt"];

// sets a range input and fires the input event, like a user moving the slider
const setSlider = (page, key, value) => page.locator("#in-" + key).evaluate((el, v) => {
  el.value = String(v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, value);

test("URL parameters change the colours; the same URL gives the same colours after a reload", async ({ page }) => {
  await openTool(page, "?depth=2");
  const a = await fills(page);
  await openTool(page, "?depth=2&h0=10&h1=120");
  const b = await fills(page);
  expect(b).not.toEqual(a);
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  expect(await fills(page)).toEqual(b);
  await expect(page.locator("#in-h0")).toHaveValue("10");
});

test("every colour slider changes the picture and the URL", async ({ page }) => {
  await openTool(page, "?depth=2");
  // saturation and lightness need room to change: start from a mid value for the slope sliders
  const targets = { h0: 100, h1: 200, s: 20, l: 40, ds: 50, dl: 50, rot: 90, dt: 20 };
  for (const key of SLIDERS) {
    const before = await fills(page);
    await setSlider(page, key, targets[key]);
    await expect.poll(async () => JSON.stringify(await fills(page)), { message: key }).not.toBe(JSON.stringify(before));
    await expect(page).toHaveURL(new RegExp(`[?&]${key}=${targets[key]}`));
    await expect(page.locator("#out-" + key)).toHaveText(String(targets[key]));
  }
});

test("the gap slider sets the width of the lines between tiles", async ({ page }) => {
  await openTool(page, "?depth=2");
  const stroke = () => page.locator(".tile").first().evaluate((e) => getComputedStyle(e).strokeWidth);
  expect(await stroke()).toBe("1px");
  await setSlider(page, "gap", 4);
  await expect.poll(stroke).toBe("4px");
  await expect(page).toHaveURL(/gap=4/);
});

test("changing a slider recolours the tiles without rebuilding them", async ({ page }) => {
  await openTool(page, "?depth=3");
  await page.locator(".tile").first().evaluate((e) => { e.dataset.marker = "kept"; });
  await setSlider(page, "h0", 30);
  await expect.poll(() => page.locator(".tile").first().getAttribute("data-marker")).toBe("kept");
});

test("the mapping selector offers plane and radial; the centre option belongs to radial", async ({ page }) => {
  await openTool(page);
  expect(await page.$$eval("#map option", (o) => o.map((x) => /** @type {HTMLOptionElement} */ (x).value))).toEqual(["plane", "radial"]);
  await expect(page.locator("#ctr-field")).toBeHidden();
  await expect(page.locator('.slider[data-key="ds"]')).toBeVisible();
  await page.selectOption("#map", "radial");
  await expect(page.locator("#ctr-field")).toBeVisible();
  await expect(page.locator('.slider[data-key="ds"]')).toBeVisible();
  await expect(page).toHaveURL(/map=radial/);
  await page.selectOption("#map", "plane");
  await expect(page.locator("#ctr-field")).toBeHidden();
});

test("radial: a bright and a dark centre are two different colourings, the centre option is in the URL", async ({ page }) => {
  await openTool(page, "?depth=3&map=radial");
  const bright = await fills(page);
  await expect(page.locator("#ctr")).toHaveValue("bright");
  await page.selectOption("#ctr", "dark");
  await expect(page).toHaveURL(/ctr=dark/);
  await expect.poll(async () => JSON.stringify(await fills(page))).not.toBe(JSON.stringify(bright));
  const dark = await fills(page);
  // the tiles near the middle are lighter with a bright centre and darker with a dark centre
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; };
  const order = await page.$$eval(".tile", (els) => els.map((e) => { const b = e.getBoundingClientRect(), s = document.querySelector("#board").getBoundingClientRect(); return Math.hypot(b.x + b.width / 2 - (s.x + s.width / 2), b.y + b.height / 2 - (s.y + s.height / 2)); }));
  const ids = order.map((d, i) => [d, i]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  const mean = (list, colours) => list.reduce((s, i) => s + lum(colours[i]), 0) / list.length;
  expect(mean(ids.slice(0, 8), bright)).toBeGreaterThan(mean(ids.slice(-8), bright));
  expect(mean(ids.slice(0, 8), dark)).toBeLessThan(mean(ids.slice(-8), dark));
  await page.reload();
  await expect(page.locator("#ctr")).toHaveValue("dark");
});

test("radial and plane colourings differ", async ({ page }) => {
  await openTool(page, "?depth=3");
  const plane = await fills(page);
  await page.selectOption("#map", "radial");
  await expect.poll(async () => JSON.stringify(await fills(page))).not.toBe(JSON.stringify(plane));
});

test("the colour statistics show different colours and tied tiles", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#colour-info")).toHaveText("60 different colours · 0 tiles share a colour");
  await page.selectOption("#map", "radial");
  await setSlider(page, "ds", 0);
  await setSlider(page, "dl", 0);
  await expect(page.locator("#colour-info")).toHaveText(/^\d+ different colours · [1-9]\d* tiles share a colour$/);
});

test("Copy link puts the current URL on the clipboard", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTool(page, "?depth=2&h0=33");
  await page.locator("#copy").click();
  await expect(page.locator("#message")).not.toHaveText("");
  if (browserName === "chromium") {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    await expect(page.locator("#message")).toHaveText("Link copied.");
  }
});
