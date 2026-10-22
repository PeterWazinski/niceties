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

const num = async (page, sel) => Number(await page.locator(sel).inputValue());
const out = (page, key) => page.locator("#out-" + key);

test("the colour step slider shows the average step between tiles for the current slopes", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#in-step")).toBeVisible();
  const step = Number(await out(page, "step").textContent());
  expect(step).toBeGreaterThan(3);
  expect(step).toBeLessThan(7);
  expect(await num(page, "#in-step")).toBeCloseTo(step, 1);
  // a bigger patch has smaller steps for the same slopes
  await openTool(page, "?depth=5");
  expect(Number(await out(page, "step").textContent())).toBeLessThan(step);
});

test("moving the step slider scales both slope sliders and keeps their proportion", async ({ page }) => {
  await openTool(page, "?depth=3");
  const ds0 = await num(page, "#in-ds"), dl0 = await num(page, "#in-dl");
  expect(ds0).toBe(-20);
  expect(dl0).toBe(-25);
  const before = Number(await out(page, "step").textContent());
  await setSlider(page, "step", before / 2);
  await expect.poll(() => num(page, "#in-ds")).toBeGreaterThan(-12);
  const ds = await num(page, "#in-ds"), dl = await num(page, "#in-dl");
  expect(Math.abs(ds)).toBeLessThan(Math.abs(ds0));
  expect(Math.abs(dl)).toBeLessThan(Math.abs(dl0));
  expect(ds / dl).toBeGreaterThan(0.6);
  expect(ds / dl).toBeLessThan(1);
  await expect(page.locator("#out-ds")).toHaveText(String(ds));
  await expect(page.locator("#out-dl")).toHaveText(String(dl));
  await expect(page).toHaveURL(/ds=/);
  await expect(page).toHaveURL(/dl=/);
  await expect(out(page, "step")).toHaveText((before / 2).toFixed(1));
});

test("moving a slope slider updates the step slider", async ({ page }) => {
  await openTool(page, "?depth=3");
  const before = Number(await out(page, "step").textContent());
  await setSlider(page, "ds", 0);
  await expect.poll(async () => Number(await out(page, "step").textContent())).toBeLessThan(before);
  const afterDs = Number(await out(page, "step").textContent());
  expect(afterDs).toBeGreaterThan(0);
  expect(await num(page, "#in-step")).toBeCloseTo(afterDs, 1);
  await setSlider(page, "dl", 0);
  await expect(out(page, "step")).toHaveText("0.0");
  expect(await num(page, "#in-step")).toBe(0);
  await setSlider(page, "ds", 40);
  await expect.poll(async () => Number(await out(page, "step").textContent())).toBeGreaterThan(before);
});

test("from zero slopes the step slider brings the default proportion back; it never pushes a slope past 100", async ({ page }) => {
  await openTool(page, "?depth=3&ds=0&dl=0");
  await expect(out(page, "step")).toHaveText("0.0");
  await setSlider(page, "step", 3);
  await expect.poll(() => num(page, "#in-ds")).toBeLessThan(0);
  expect(await num(page, "#in-dl")).toBeLessThan(0);
  const max = await page.locator("#in-step").getAttribute("max");
  await setSlider(page, "step", Number(max));
  await expect.poll(async () => Math.max(Math.abs(await num(page, "#in-ds")), Math.abs(await num(page, "#in-dl")))).toBeLessThanOrEqual(100);
  expect(Math.max(Math.abs(await num(page, "#in-ds")), Math.abs(await num(page, "#in-dl")))).toBeGreaterThan(90);
});

test("the step slider changes the colours; the radial mapping gives another step for the same slopes", async ({ page }) => {
  await openTool(page, "?depth=3");
  const before = await fills(page);
  const plane = Number(await out(page, "step").textContent());
  await setSlider(page, "step", 1);
  await expect.poll(async () => JSON.stringify(await fills(page))).not.toBe(JSON.stringify(before));
  await openTool(page, "?depth=3&map=radial");
  expect(Number(await out(page, "step").textContent())).toBeGreaterThan(plane);
  await page.selectOption("#map", "plane");
  await expect(out(page, "step")).toHaveText(plane.toFixed(1));
});

test("the step is not a URL parameter of its own", async ({ page }) => {
  await openTool(page, "?depth=3");
  await setSlider(page, "step", 2);
  await expect(page).toHaveURL(/ds=/);
  expect(page.url()).not.toContain("step=");
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  await expect(out(page, "step")).toHaveText("2.0");
});
