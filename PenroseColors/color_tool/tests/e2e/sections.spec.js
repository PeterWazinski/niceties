import { test, expect } from "@playwright/test";
import { openTool } from "./helpers.js";

const SECTIONS = ["tiling", "colour", "anchors", "puzzle"];
const toggle = (page, name) => page.locator(`.collapsible[data-section="${name}"] .section-toggle`);
const body = (page, name) => page.locator(`#body-${name}`);

test("the sections are Tiling, Colour, Anchors, Puzzle, in this order", async ({ page }) => {
  await openTool(page);
  expect(await page.$$eval(".collapsible h2", (els) => els.map((e) => e.textContent.trim()))).toEqual(["Tiling", "Colour", "Anchors", "Puzzle"]);
  // the controls of each section are in the right one
  await expect(body(page, "tiling").locator("#seed")).toHaveCount(1);
  await expect(body(page, "colour").locator("#map")).toHaveCount(1);
  await expect(body(page, "anchors").locator("#edit-anchors")).toHaveCount(1);
  await expect(body(page, "puzzle").locator("#shuffle")).toHaveCount(1);
  expect(await page.$$eval(".collapsible", (els) => els.map((e) => e.dataset.section))).toEqual(SECTIONS);
});

test("a click on the title folds the section; the arrow follows the title and turns", async ({ page }) => {
  await openTool(page);
  for (const name of SECTIONS) {
    await expect(body(page, name)).toBeVisible();
    await toggle(page, name).click();
    await expect(body(page, name)).toBeHidden();
    await expect(toggle(page, name)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`.collapsible[data-section="${name}"]`)).toHaveClass(/collapsed/);
    await toggle(page, name).click();
    await expect(body(page, name)).toBeVisible();
  }
  // the arrow sits directly after the title text, not at the far edge of the panel
  const r = await page.evaluate(() => {
    const button = document.querySelector('.collapsible[data-section="colour"] .section-toggle');
    const text = button.querySelector("span:not(.chevron)").getBoundingClientRect();
    const arrow = button.querySelector(".chevron").getBoundingClientRect();
    return { gap: arrow.left - text.right, panel: document.querySelector(".panel").getBoundingClientRect().width };
  });
  expect(r.gap).toBeGreaterThanOrEqual(0);
  expect(r.gap).toBeLessThan(30);
});

test("folding all sections makes the panel much shorter", async ({ page }) => {
  await openTool(page);
  // the height of the four sections together (the panel itself is at least as high as the window)
  const height = () => page.evaluate(() => [...document.querySelectorAll(".collapsible")].reduce((s, e) => s + e.getBoundingClientRect().height, 0));
  const full = await height();
  for (const name of SECTIONS) await toggle(page, name).click();
  const folded = await height();
  expect(folded).toBeLessThan(full * 0.5);
  // folded sections hide their controls but the copy-link section stays
  await expect(page.locator("#shuffle")).toBeHidden();
  await expect(page.locator("#copy")).toBeVisible();
});

test("the folded state is remembered after a reload", async ({ page }) => {
  await openTool(page);
  await toggle(page, "colour").click();
  await toggle(page, "tiling").click();
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  await expect(body(page, "colour")).toBeHidden();
  await expect(body(page, "tiling")).toBeHidden();
  await expect(body(page, "anchors")).toBeVisible();
  await expect(body(page, "puzzle")).toBeVisible();
  await toggle(page, "colour").click();
  await page.reload();
  await expect(body(page, "colour")).toBeVisible();
});

test("the tool works when the browser does not allow storing the folded state", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await openTool(page);
  await toggle(page, "puzzle").click();
  await expect(body(page, "puzzle")).toBeHidden();
  await toggle(page, "puzzle").click();
  await expect(body(page, "puzzle")).toBeVisible();
});

test("a folded section is reachable again with the keyboard", async ({ page }) => {
  await openTool(page);
  await toggle(page, "anchors").focus();
  await page.keyboard.press("Enter");
  await expect(body(page, "anchors")).toBeHidden();
  await page.keyboard.press("Space");
  await expect(body(page, "anchors")).toBeVisible();
});
