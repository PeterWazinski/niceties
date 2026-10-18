import { expect } from "@playwright/test";

// Opens the game with a fixed seed (deterministic puzzle) and waits until it is rendered.
export async function openGame(page, query = "") {
  await page.goto("index.html?seed=12" + (query ? "&" + query : ""));
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".cell")).toHaveCount(81);
  // layout depends on the stylesheets: wait until both are parsed
  await page.waitForFunction(() => document.styleSheets.length >= 2 &&
    [...document.styleSheets].every((s) => { try { return s.cssRules.length > 0; } catch (e) { return false; } }));
}

export const cell = (page, i) => page.locator(`.cell[data-i="${i}"]`);

// Indices of the cells that carry a CSS class.
export const cellsWith = (page, cls) =>
  page.$$eval(".cell." + cls, (els) => els.map((e) => Number(e.dataset.i)).sort((a, b) => a - b));

// Digit shown in each cell ("" = empty), as an array of 81 strings.
export const values = (page) => page.$$eval(".cell", (els) => els.map((e) => e.dataset.value));

export const row = (i) => Math.floor(i / 9);
export const col = (i) => i % 9;
export const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
export const peersOf = (i) => {
  const out = [];
  for (let j = 0; j < 81; j++) if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) out.push(j);
  return out;
};

// True for the layouts with the side panel (iPad landscape, desktop).
export function isLandscapeLayout(page) {
  const { width, height } = page.viewportSize();
  return width > height && width >= 700;
}

// WCAG contrast ratio of two "#rrggbb" colours.
export function contrast(a, b) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
