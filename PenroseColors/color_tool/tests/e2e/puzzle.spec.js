import { test, expect } from "@playwright/test";
import { openTool, tile, tiles, fills, drag, idOfType, solvingSwaps } from "./helpers.js";

test("a shuffle URL gives a scrambled picture that is reproducible; Reset sorts it again", async ({ page }) => {
  await openTool(page, "?depth=3");
  const sorted = await fills(page);
  await expect(page.locator("#puzzle-info")).toContainText("Sorted");
  await openTool(page, "?depth=3&shuffle=5");
  const shuffled = await fills(page);
  expect(shuffled).not.toEqual(sorted);
  expect([...shuffled].sort()).toEqual([...sorted].sort()); // the same colours, moved
  await expect(page.locator("#puzzle-info")).toContainText("Not solved");
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  expect(await fills(page)).toEqual(shuffled);
  await page.locator("#reset").click();
  expect(await fills(page)).toEqual(sorted);
  await expect(page).not.toHaveURL(/shuffle=/);
});

test("the Shuffle button shuffles and puts the shuffle in the URL", async ({ page }) => {
  await openTool(page, "?depth=3");
  const sorted = await fills(page);
  await page.locator("#shuffle").click();
  await expect(page).toHaveURL(/shuffle=\d+/);
  expect(await fills(page)).not.toEqual(sorted);
});

test("shuffle to a target number of swaps: the minimum swap count is that number", async ({ page }) => {
  for (const sw of [5, 30]) {
    await openTool(page, `?depth=4&shuffle=9&sw=${sw}`);
    await expect(page.locator("#puzzle-info")).toContainText(`minimum swaps needed ${sw}`);
    await expect(page.locator("#out-sw")).toHaveText(String(sw));
  }
  await openTool(page, "?depth=3&shuffle=9"); // full shuffle
  await expect(page.locator("#out-sw")).toHaveText("full");
  const info = await page.locator("#puzzle-info").textContent();
  expect(Number(/needed (\d+)/.exec(info)[1])).toBeGreaterThan(30);
});

test("the sorted preview shows the target while it is on", async ({ page }) => {
  await openTool(page, "?depth=3");
  const sorted = await fills(page);
  await openTool(page, "?depth=3&shuffle=5");
  const shuffled = await fills(page);
  await page.locator("#preview").click();
  await expect(page.locator("#preview")).toHaveAttribute("aria-pressed", "true");
  expect(await fills(page)).toEqual(sorted);
  await page.locator("#preview").click();
  expect(await fills(page)).toEqual(shuffled);
});

test("drag and drop swaps the colours of two tiles of the same type", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const a = await idOfType(page, "thick", 3), b = await idOfType(page, "thick", 9);
  const before = await fills(page);
  await drag(page, a, b);
  const after = await fills(page);
  expect(after[a]).toBe(before[b]);
  expect(after[b]).toBe(before[a]);
  expect(after.filter((f, i) => i !== a && i !== b)).toEqual(before.filter((f, i) => i !== a && i !== b));
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 1");
  // while dragging nothing stays highlighted afterwards
  await expect(page.locator(".tile.dragging, .tile.target")).toHaveCount(0);
});

test("a drop on a tile of the other type or on the background does nothing", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const thick = await idOfType(page, "thick", 3), thin = await idOfType(page, "thin", 3);
  const before = await fills(page);
  await drag(page, thick, thin);
  expect(await fills(page)).toEqual(before);
  await expect(page.locator("#message")).toContainText("same shape");
  // drop on the background
  const b = await tile(page, thick).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  expect(await fills(page)).toEqual(before);
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 0");
});

test("while dragging, only tiles of the same type are marked as targets", async ({ page }) => {
  await openTool(page, "?depth=3");
  const a = await idOfType(page, "thin", 0);
  const b = await tile(page, a).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 30, { steps: 3 });
  await expect(page.locator(".tile.dragging")).toHaveCount(1);
  expect(await page.$$eval(".tile.target", (els) => [...new Set(els.map((e) => e.dataset.type))])).toEqual(["thin"]);
  await expect(page.locator(".tile.target")).toHaveCount(24); // 25 thin tiles, minus the dragged one
  await page.mouse.up();
  await expect(page.locator(".tile.target")).toHaveCount(0);
});

test("two taps swap two tiles; tapping the selected tile again deselects it", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const a = await idOfType(page, "thin", 2), b = await idOfType(page, "thin", 7);
  const before = await fills(page);
  await tile(page, a).click();
  await expect(tile(page, a)).toHaveClass(/selected/);
  await tile(page, a).click();
  await expect(page.locator(".tile.selected")).toHaveCount(0);
  await tile(page, a).click();
  await tile(page, b).click();
  const after = await fills(page);
  expect(after[a]).toBe(before[b]);
  expect(after[b]).toBe(before[a]);
  await expect(page.locator(".tile.selected")).toHaveCount(0);
});

test("a second tap on a tile of the other type is refused and keeps the selection", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const thick = await idOfType(page, "thick", 0), thin = await idOfType(page, "thin", 0);
  const before = await fills(page);
  await tile(page, thick).click();
  await tile(page, thin).click();
  expect(await fills(page)).toEqual(before);
  await expect(tile(page, thick)).toHaveClass(/selected/);
  await expect(page.locator("#message")).toContainText("same shape");
});

test("Undo takes the last swap back and the counters follow", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const before = await fills(page);
  const minimum = await page.locator("#puzzle-info").textContent();
  const a = await idOfType(page, "thick", 1), b = await idOfType(page, "thick", 5);
  await tile(page, a).click();
  await tile(page, b).click();
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 1");
  await expect(page.locator("#undo")).toHaveAttribute("aria-disabled", "false");
  await page.locator("#undo").click();
  expect(await fills(page)).toEqual(before);
  await expect(page.locator("#puzzle-info")).toHaveText(minimum);
  await expect(page.locator("#undo")).toHaveAttribute("aria-disabled", "true");
});

test("solving a small shuffled patch shows Solved and the swap counts match the minimum", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=7&sw=6");
  const swaps = await solvingSwaps(page);
  expect(swaps).toHaveLength(6);
  await expect(page.locator("#puzzle-info")).toContainText("minimum swaps needed 6");
  for (let k = 0; k < swaps.length; k++) {
    await expect(page.locator("#puzzle-info")).toContainText("Not solved");
    await drag(page, swaps[k][0], swaps[k][1]);
    await expect(page.locator("#puzzle-info")).toContainText(`swaps made ${k + 1}`);
    await expect(page.locator("#puzzle-info")).toContainText(`minimum swaps needed ${5 - k}`);
  }
  await expect(page.locator("#puzzle-info")).toContainText("Solved!");
  await expect(page.locator("#live")).toContainText("Solved!");
});

test("keyboard: arrows move between neighbouring tiles, Enter selects and swaps", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  await page.locator("#board").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tile.cursor")).toHaveCount(1);
  const start = await page.locator(".tile.cursor").getAttribute("data-id");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".tile.cursor")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.locator(".tile.selected")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".tile.selected")).toHaveCount(0);
  expect(start).not.toBeNull();
});
