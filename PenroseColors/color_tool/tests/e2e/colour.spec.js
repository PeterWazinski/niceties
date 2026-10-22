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

test("the mapping selector shows only the sliders that apply", async ({ page }) => {
  await openTool(page);
  await expect(page.locator('.slider[data-key="ds"]')).toBeVisible();
  await page.selectOption("#map", "angular");
  await expect(page.locator('.slider[data-key="ds"]')).toBeHidden();
  await expect(page.locator('.slider[data-key="dl"]')).toBeHidden();
  await expect(page.locator('.slider[data-key="h0"]')).toBeVisible();
  await expect(page).toHaveURL(/map=angular/);
  await page.selectOption("#map", "radial");
  await expect(page.locator('.slider[data-key="ds"]')).toBeVisible();
});

test("radial and angular colourings differ from the plane colouring", async ({ page }) => {
  await openTool(page, "?depth=3");
  const plane = await fills(page);
  await page.selectOption("#map", "radial");
  await expect.poll(async () => JSON.stringify(await fills(page))).not.toBe(JSON.stringify(plane));
  const radial = await fills(page);
  await page.selectOption("#map", "angular");
  await expect.poll(async () => JSON.stringify(await fills(page))).not.toBe(JSON.stringify(radial));
});

test("the colour statistics show different colours and tied tiles", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#colour-info")).toHaveText("60 different colours · 0 tiles share a colour");
  await page.selectOption("#map", "angular");
  await expect(page.locator("#colour-info")).not.toHaveText(/ · 0 tiles share a colour$/);
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
