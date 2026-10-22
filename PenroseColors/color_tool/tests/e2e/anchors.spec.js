import { test, expect } from "@playwright/test";
import { openTool, tile, fills, drag, tiles } from "./helpers.js";

test("edit mode: a tap sets an anchor (dot, URL, count), a second tap removes it", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#unique-anchors")).toHaveText("0 anchors");
  await page.locator("#edit-anchors").click();
  await expect(page.locator("#edit-anchors")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#unique-anchors")).toContainText("click or tap a tile");
  await tile(page, 12).click();
  await expect(tile(page, 12)).toHaveClass(/anchored/);
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
  await expect(page).toHaveURL(/anchors=12/);
  await expect(page.locator("#unique-anchors")).toContainText("1 anchor");
  await tile(page, 30).click();
  await expect(page).toHaveURL(/anchors=12%2C30/);
  await expect(page.locator(".anchor-dot")).toHaveCount(2);
  await tile(page, 12).click();
  await expect(tile(page, 12)).not.toHaveClass(/anchored/);
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
  await expect(page).toHaveURL(/anchors=30(&|$)/);
});

test("Suggest turns 'not unique' into 'unique' with the fewest anchors, Clear removes them", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#unique-state")).toContainText("Not unique: 9 symmetric copies");
  await expect(page.locator("#unique-sym")).toContainText("10 symmetries of the patch");
  await page.locator("#suggest").click();
  await expect(page.locator("#unique-state")).toContainText("Unique: the anchors rule out every symmetric copy");
  await expect(page.locator("#unique-anchors")).toContainText("1 anchor");
  await expect(page.locator("#message")).toContainText("1 anchor suggested (the fewest possible)");
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
  await expect(page).toHaveURL(/anchors=\d+/);
  await page.locator("#clear-anchors").click();
  await expect(page.locator(".anchor-dot")).toHaveCount(0);
  await expect(page.locator("#unique-state")).toContainText("Not unique");
  await expect(page).not.toHaveURL(/anchors=/);
});

test("an asymmetric patch is unique with no anchor, and Suggest says so", async ({ page }) => {
  await openTool(page, "?seed=half&depth=3");
  await expect(page.locator("#unique-state")).toContainText("Unique: no symmetric copy");
  await expect(page.locator("#unique-sym")).toContainText("1 symmetries of the patch");
  await page.locator("#suggest").click();
  await expect(page.locator("#message")).toContainText("No anchor needed");
  await expect(page.locator(".anchor-dot")).toHaveCount(0);
});

test("the uniqueness status follows the colouring", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#unique-sym")).toContainText("9 change the colouring");
  await page.selectOption("#map", "angular");
  await expect(page.locator("#unique-sym")).toContainText(/ · [1-9]\d* tiles share a colour$/);
});

test("anchored tiles cannot be selected or dragged and show a message", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10&anchors=10");
  const all = await tiles(page);
  const anchoredType = all[10].type;
  const other = all.find((t) => t.type === anchoredType && t.id !== 10 && t.id !== 11).id;
  const before = await fills(page);
  await tile(page, 10).click();
  await expect(page.locator(".tile.selected")).toHaveCount(0);
  await expect(page.locator("#message")).toContainText("Anchored tiles cannot move");
  await drag(page, 10, other);
  expect(await fills(page)).toEqual(before);
  await drag(page, other, 10);
  expect(await fills(page)).toEqual(before);
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 0");
});

test("while dragging, anchored tiles are not offered as targets", async ({ page }) => {
  await openTool(page, "?depth=3&anchors=10");
  const all = await tiles(page);
  const type = all[10].type;
  const from = all.find((t) => t.type === type && t.id !== 10).id;
  const b = await tile(page, from).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 30, { steps: 3 });
  const total = all.filter((t) => t.type === type).length;
  await expect(page.locator(".tile.target")).toHaveCount(total - 2); // not itself, not the anchored one
  await expect(tile(page, 10)).not.toHaveClass(/target/);
  await page.mouse.up();
});

test("a shuffle never moves anchored tiles", async ({ page }) => {
  await openTool(page, "?depth=3");
  const sorted = await fills(page);
  const anchors = [0, 7, 8, 21, 40, 55];
  await openTool(page, `?depth=3&shuffle=5&anchors=${anchors.join(",")}`);
  const shuffled = await fills(page);
  for (const a of anchors) expect(shuffled[a], "tile " + a).toBe(sorted[a]);
  expect(shuffled).not.toEqual(sorted);
  await openTool(page, `?depth=3&shuffle=5&sw=20&anchors=${anchors.join(",")}`);
  const partial = await fills(page);
  for (const a of anchors) expect(partial[a], "tile " + a).toBe(sorted[a]);
  await expect(page.locator("#puzzle-info")).toContainText("minimum swaps needed 20");
});

test("anchors survive a reload; a new tiling clears them; ids outside the patch are dropped", async ({ page }) => {
  await openTool(page, "?depth=3&anchors=4,9");
  await expect(page.locator(".anchor-dot")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  await expect(page.locator(".anchor-dot")).toHaveCount(2);
  await page.selectOption("#depth", "4");
  await expect(page.locator(".tile")).toHaveCount(160);
  await expect(page.locator(".anchor-dot")).toHaveCount(0);
  await expect(page).not.toHaveURL(/anchors=/);
  await openTool(page, "?depth=1&anchors=3,500");
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
});

test("the dot stays on its tile when the window is resized", async ({ page }) => {
  await openTool(page, "?depth=3&anchors=15");
  const dotAt = async () => {
    const d = await page.locator(".anchor-dot").boundingBox(), t = await tile(page, 15).boundingBox();
    return { dx: d.x + d.width / 2 - (t.x + t.width / 2), dy: d.y + d.height / 2 - (t.y + t.height / 2) };
  };
  let off = await dotAt();
  expect(Math.abs(off.dx)).toBeLessThan(2);
  expect(Math.abs(off.dy)).toBeLessThan(2);
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.8) });
  await expect.poll(async () => Math.abs((await dotAt()).dx) + Math.abs((await dotAt()).dy)).toBeLessThan(3);
});
