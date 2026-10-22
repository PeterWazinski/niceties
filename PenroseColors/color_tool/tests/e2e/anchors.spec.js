import { test, expect } from "@playwright/test";
import { openTool, tile, fills, drag, tiles } from "./helpers.js";

/** Ids of the anchored tiles and the board centre, from the page. */
const anchoredIds = (page) => page.$$eval(".tile.anchored", (els) => els.map((e) => Number(e.dataset.id)).sort((a, b) => a - b));
const dotCentres = (page) => page.$$eval(".anchor-dot", (els) => els.map((e) => ({ x: Number(e.getAttribute("cx")), y: Number(e.getAttribute("cy")) })));

test("every tiling starts with default anchors: wheel and half wheel five, fan four", async ({ page }) => {
  /** @type {[string, number][]} */
  const expected = [["wheel", 5], ["half", 5], ["fan", 4]];
  for (const [seed, count] of expected) {
    for (const depth of [3, 4]) {
      await openTool(page, `?seed=${seed}&depth=${depth}`);
      await expect(page.locator(".tile.anchored"), `${seed} ${depth}`).toHaveCount(count);
      await expect(page.locator(".anchor-dot")).toHaveCount(count);
      await expect(page).not.toHaveURL(/anchors=/); // the defaults need no parameter
    }
  }
});

test("wheel: one anchor in the middle and four around the perimeter; fan: the most distant tiles", async ({ page }) => {
  await openTool(page, "?depth=4");
  const board = await page.locator("#board").boundingBox();
  const mid = { x: board.width / 2, y: board.height / 2 };
  const dots = await dotCentres(page);
  const radius = (d) => Math.hypot(d.x - mid.x, d.y - mid.y);
  const sorted = [...dots].sort((a, b) => radius(a) - radius(b));
  expect(radius(sorted[0])).toBeLessThan(0.1 * board.height);
  const outer = sorted.slice(1);
  for (const d of outer) expect(radius(d)).toBeGreaterThan(0.35 * Math.min(board.width, board.height));
  expect(outer.some((d) => d.x > mid.x + 0.3 * board.height), "one to the right").toBe(true);
  expect(outer.some((d) => d.x < mid.x - 0.3 * board.height), "one to the left").toBe(true);
  expect(outer.some((d) => d.y > mid.y + 0.3 * board.height), "one below").toBe(true);
  expect(outer.some((d) => d.y < mid.y - 0.3 * board.height), "one above").toBe(true);

  await openTool(page, "?seed=fan&depth=4");
  const fan = await dotCentres(page);
  const boxes = await page.$$eval(".tile", (els) => els.map((e) => { const b = e.getBoundingClientRect(), s = document.querySelector("#board").getBoundingClientRect(); return { l: b.left - s.left, r: b.right - s.left, t: b.top - s.top, b: b.bottom - s.top }; }));
  const left = Math.min(...boxes.map((b) => b.l)), right = Math.max(...boxes.map((b) => b.r));
  const top = Math.min(...boxes.map((b) => b.t)), bottom = Math.max(...boxes.map((b) => b.b));
  expect(Math.min(...fan.map((d) => d.x)) - left).toBeLessThan(0.15 * (right - left));
  expect(right - Math.max(...fan.map((d) => d.x))).toBeLessThan(0.15 * (right - left));
  expect(Math.min(...fan.map((d) => d.y)) - top).toBeLessThan(0.2 * (bottom - top));
  expect(bottom - Math.max(...fan.map((d) => d.y))).toBeLessThan(0.2 * (bottom - top));
});

test("default anchors can be removed and put back like manual ones; the URL only records the difference", async ({ page }) => {
  await openTool(page, "?depth=3");
  const defaults = await anchoredIds(page);
  expect(defaults).toHaveLength(5);
  await page.locator("#edit-anchors").click();
  await expect(page.locator("#unique-anchors")).toContainText("click or tap a tile");
  await tile(page, defaults[0]).click();
  await expect(page.locator(".tile.anchored")).toHaveCount(4);
  await expect(page.locator(".anchor-dot")).toHaveCount(4);
  await expect(tile(page, defaults[0])).not.toHaveClass(/anchored/);
  await expect(page).toHaveURL(new RegExp("anchors=" + defaults.slice(1).join("%2C")));
  await tile(page, defaults[0]).click(); // put it back: the set equals the default again
  await expect(page.locator(".tile.anchored")).toHaveCount(5);
  await expect(page).not.toHaveURL(/anchors=/);
  const extra = (await tiles(page)).find((t) => !defaults.includes(t.id)).id;
  await tile(page, extra).click();
  await expect(page.locator(".tile.anchored")).toHaveCount(6);
  await expect(page).toHaveURL(/anchors=/);
});

test("Clear anchors removes all, Default anchors restores them", async ({ page }) => {
  await openTool(page, "?depth=3");
  const defaults = await anchoredIds(page);
  await page.locator("#clear-anchors").click();
  await expect(page.locator(".anchor-dot")).toHaveCount(0);
  await expect(page).toHaveURL(/anchors=none/);
  await expect(page.locator("#unique-anchors")).toContainText("0 anchors");
  await page.reload();
  await expect(page.locator(".tile").first()).toBeVisible();
  await expect(page.locator(".anchor-dot")).toHaveCount(0); // "none" survives a reload
  await page.locator("#default-anchors").click();
  expect(await anchoredIds(page)).toEqual(defaults);
  await expect(page).not.toHaveURL(/anchors=/);
  await expect(page.locator("#message")).toContainText("Default anchors restored");
});

test("there is no Suggest button any more", async ({ page }) => {
  await openTool(page);
  await expect(page.locator("#suggest")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /suggest/i })).toHaveCount(0);
});

test("a new seed or depth brings the default anchors of that tiling", async ({ page }) => {
  await openTool(page, "?depth=3&anchors=none");
  await expect(page.locator(".anchor-dot")).toHaveCount(0);
  await page.selectOption("#seed", "fan");
  await expect(page.locator(".anchor-dot")).toHaveCount(4);
  await page.selectOption("#seed", "wheel");
  await expect(page.locator(".anchor-dot")).toHaveCount(5);
  await page.selectOption("#depth", "4");
  await expect(page.locator(".anchor-dot")).toHaveCount(5);
  await expect(page).not.toHaveURL(/anchors=/);
});

test("the default anchors make a symmetric patch unique; clearing them does not", async ({ page }) => {
  await openTool(page, "?depth=3");
  await expect(page.locator("#unique-state")).toContainText("Unique: the anchors rule out every symmetric copy");
  await expect(page.locator("#unique-anchors")).toContainText("5 anchors");
  await page.locator("#clear-anchors").click();
  await expect(page.locator("#unique-state")).toContainText("Not unique: 9 symmetric copies");
  await expect(page.locator("#unique-sym")).toContainText("10 symmetries of the patch");
  await openTool(page, "?seed=half&depth=3&anchors=none");
  await expect(page.locator("#unique-state")).toContainText("Unique: no symmetric copy");
  await expect(page.locator("#unique-sym")).toContainText("1 symmetries of the patch");
});

test("the uniqueness status follows the colouring", async ({ page }) => {
  await openTool(page, "?depth=3&anchors=none");
  await expect(page.locator("#unique-sym")).toContainText("9 change the colouring");
  await page.selectOption("#map", "radial");
  for (const key of ["ds", "dl"]) {
    await page.locator("#in-" + key).evaluate((el) => {
      const input = /** @type {HTMLInputElement} */ (el);
      input.value = "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await expect(page.locator("#unique-sym")).toContainText(/ · [1-9]\d* tiles share a colour$/);
});

test("a shuffle never moves the default anchors", async ({ page }) => {
  await openTool(page, "?depth=3");
  const sorted = await fills(page);
  const anchors = await anchoredIds(page);
  await openTool(page, "?depth=3&shuffle=5");
  const shuffled = await fills(page);
  expect(await anchoredIds(page)).toEqual(anchors);
  for (const a of anchors) expect(shuffled[a], "tile " + a).toBe(sorted[a]);
  expect(shuffled).not.toEqual(sorted);
  await openTool(page, "?depth=3&shuffle=5&sw=20");
  const partial = await fills(page);
  for (const a of anchors) expect(partial[a], "tile " + a).toBe(sorted[a]);
  await expect(page.locator("#puzzle-info")).toContainText("minimum swaps needed 20");
});

test("anchored tiles cannot be selected or dragged and show a message", async ({ page }) => {
  await openTool(page, "?depth=3&shuffle=3&sw=10");
  const [first] = await anchoredIds(page);
  const all = await tiles(page);
  const type = all[first].type;
  const other = all.find((t) => t.type === type && !(t.id === first) && !t.fill.startsWith("x")).id;
  const free = (await page.$$eval(".tile:not(.anchored)", (els) => els.map((e) => ({ id: Number(e.dataset.id), type: e.dataset.type })))).find((t) => t.type === type).id;
  const before = await fills(page);
  await tile(page, first).click();
  await expect(page.locator(".tile.selected")).toHaveCount(0);
  await expect(page.locator("#message")).toContainText("Anchored tiles cannot move");
  await drag(page, first, free);
  expect(await fills(page)).toEqual(before);
  await drag(page, free, first);
  expect(await fills(page)).toEqual(before);
  await expect(page.locator("#puzzle-info")).toContainText("swaps made 0");
  expect(other).toBeGreaterThanOrEqual(0);
});

test("while dragging, anchored tiles are not offered as targets", async ({ page }) => {
  await openTool(page, "?depth=3");
  const anchored = await anchoredIds(page);
  const all = await tiles(page);
  const type = "thick";
  const from = all.find((t) => t.type === type && !anchored.includes(t.id)).id;
  const b = await tile(page, from).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 30, { steps: 3 });
  const thickAnchored = anchored.filter((id) => all[id].type === type).length;
  const total = all.filter((t) => t.type === type).length;
  await expect(page.locator(".tile.target")).toHaveCount(total - 1 - thickAnchored);
  for (const id of anchored) await expect(tile(page, id)).not.toHaveClass(/target/);
  await page.mouse.up();
});

test("explicit anchors in the URL replace the defaults, ids outside the patch are dropped, the dot stays on its tile", async ({ page }) => {
  await openTool(page, "?depth=1&anchors=3,500");
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
  await openTool(page, "?depth=3&anchors=15");
  await expect(page.locator(".anchor-dot")).toHaveCount(1);
  const dotAt = async () => {
    const d = await page.locator(".anchor-dot").boundingBox(), t = await tile(page, 15).boundingBox();
    return Math.abs(d.x + d.width / 2 - (t.x + t.width / 2)) + Math.abs(d.y + d.height / 2 - (t.y + t.height / 2));
  };
  expect(await dotAt()).toBeLessThan(3);
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.8) });
  await expect.poll(dotAt).toBeLessThan(3);
});
