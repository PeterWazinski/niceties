import { expect } from "@playwright/test";

/** Opens the tool (optionally with a URL query like "?depth=2") and waits until it is drawn. */
export async function openTool(page, query = "") {
  await page.goto("index.html" + query);
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".tile").first()).toBeVisible();
  // the stylesheet decides the layout: wait until it is parsed
  await page.waitForFunction(() => document.styleSheets.length >= 1 &&
    [...document.styleSheets].every((s) => { try { return s.cssRules.length > 0; } catch (e) { return false; } }));
}

export const tile = (page, id) => page.locator(`.tile[data-id="${id}"]`);

/** [{ id, type, fill }] of all tiles, by id. */
export const tiles = (page) => page.$$eval(".tile", (els) =>
  els.map((e) => ({ id: Number(e.dataset.id), type: e.dataset.type, fill: e.getAttribute("fill") }))
    .sort((a, b) => a.id - b.id));

export const fills = async (page) => (await tiles(page)).map((t) => t.fill);

/** Centre of a tile in page coordinates. */
export async function centre(page, id) {
  const b = await tile(page, id).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Drags the colour of tile `from` onto tile `to` with the mouse. */
export async function drag(page, from, to) {
  const a = await centre(page, from), b = await centre(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

/** Index of the first tile of a type (skipping `skip` tiles of that type). */
export async function idOfType(page, type, skip = 0) {
  const all = await tiles(page);
  return all.filter((t) => t.type === type)[skip].id;
}

/** The tile ids in the order they need swapping to reach the sorted picture: pairs [a, b] (same type). */
export async function solvingSwaps(page) {
  const sorted = await page.evaluate(async () => {
    // the sorted colours: switch the preview on and read them
    const button = /** @type {HTMLElement} */ (document.querySelector("#preview"));
    button.click();
    await new Promise((r) => requestAnimationFrame(r));
    /** @type {[number, string][]} */
    const out = [...document.querySelectorAll(".tile")].map((e) => [Number(/** @type {HTMLElement} */ (e).dataset.id), e.getAttribute("fill") || ""]);
    button.click();
    await new Promise((r) => requestAnimationFrame(r));
    return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  });
  const current = (await tiles(page)).map((t) => t.fill);
  const swaps = [];
  for (let i = 0; i < current.length; i++) {
    if (current[i] === sorted[i]) continue;
    const j = current.findIndex((c, k) => k > i && c === sorted[i] && current[k] !== sorted[k]);
    swaps.push([i, j]);
    [current[i], current[j]] = [current[j], current[i]];
  }
  return swaps;
}
