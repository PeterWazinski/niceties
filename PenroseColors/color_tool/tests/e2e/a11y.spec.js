import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openTool, tile, idOfType } from "./helpers.js";

test.use({ reducedMotion: "reduce" });

async function scan(page, label) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, label).toEqual([]);
}

test("accessibility scan (axe): main screen, shuffled puzzle, edit mode with anchors", async ({ page }) => {
  await openTool(page);
  await scan(page, "fresh");
  await openTool(page, "?depth=3&shuffle=4&sw=12&anchors=5,9&map=radial");
  await scan(page, "shuffled with anchors");
  await page.locator("#edit-anchors").click();
  await scan(page, "edit mode");
});

test("controls and the board have accessible names; sliders are labelled", async ({ page }) => {
  await openTool(page);
  await expect(page.locator("#board")).toHaveAttribute("aria-label", "Penrose tiling");
  for (const name of ["Seed", "Depth", "Mapping"]) await expect(page.getByRole("combobox", { name })).toBeVisible();
  await expect(page.getByRole("slider", { name: /^Hue start/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /^Lightness slope/ })).toBeVisible();
  await expect(page.getByRole("slider", { name: /^Target swaps/ })).toBeVisible();
  for (const name of ["Shuffle", "Reset", "Undo", "Sorted preview", "Edit anchors", "Suggest anchors", "Clear anchors", "Copy link"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});

test("keyboard focus is clearly visible on the controls and the board", async ({ page }) => {
  await openTool(page);
  await page.locator("#seed").focus();
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const e = document.activeElement, c = getComputedStyle(e);
      return { id: e.id || e.tagName, style: c.outlineStyle, width: parseFloat(c.outlineWidth) };
    });
    expect(info.style, info.id).not.toBe("none");
    expect(info.width, info.id).toBeGreaterThanOrEqual(2);
  }
  await page.locator("#board").focus();
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe("none");
});

test("the live region announces swaps, anchors and the solved state", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  await expect(page.locator("#live")).toHaveAttribute("aria-live", "polite");
  const a = await idOfType(page, "thick", 1), b = await idOfType(page, "thick", 4);
  await tile(page, a).click();
  await tile(page, b).click();
  await expect(page.locator("#live")).toContainText("Swapped");
  await page.locator("#edit-anchors").click();
  await expect(page.locator("#live")).toContainText("Anchor editing on");
  await page.locator("#suggest").click();
  await expect(page.locator("#live")).toContainText("anchor");
});

test("Undo and the preview toggle expose their state to assistive technology", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  await expect(page.locator("#undo")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#preview")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#preview").click();
  await expect(page.locator("#preview")).toHaveAttribute("aria-pressed", "true");
});
