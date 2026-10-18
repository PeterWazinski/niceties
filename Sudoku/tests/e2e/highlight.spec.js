import { test, expect } from "@playwright/test";
import { openGame, cell, cellsWith, values, peersOf } from "./helpers.js";

// no colour transitions while the computed colours are compared
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => { await openGame(page); });

test("nothing is highlighted before a cell is tapped", async ({ page }) => {
  for (const cls of ["sel", "peer", "same", "conflict"]) expect(await cellsWith(page, cls)).toEqual([]);
});

test("tap an empty cell: the cell plus its row, column and box - nothing else", async ({ page }) => {
  const v = await values(page);
  const i = v.findIndex((x) => x === "");
  await cell(page, i).click();
  expect(await cellsWith(page, "sel")).toEqual([i]);
  expect(await cellsWith(page, "peer")).toEqual(peersOf(i));
  expect(await cellsWith(page, "same")).toEqual([]);
});

test("tap a filled cell: identical digits plus row, column and box", async ({ page }) => {
  const v = await values(page);
  const i = v.findIndex((x) => x !== "");
  await cell(page, i).click();
  const same = v.map((x, j) => (j !== i && x === v[i] ? j : -1)).filter((j) => j >= 0);
  expect(same.length).toBeGreaterThan(0);
  expect(await cellsWith(page, "sel")).toEqual([i]);
  expect(await cellsWith(page, "same")).toEqual(same);
  expect(await cellsWith(page, "peer")).toEqual(peersOf(i));
});

test("tapping another cell moves the highlight", async ({ page }) => {
  const v = await values(page);
  const empties = v.map((x, j) => (x === "" ? j : -1)).filter((j) => j >= 0);
  await cell(page, empties[0]).click();
  await cell(page, empties[5]).click();
  expect(await cellsWith(page, "sel")).toEqual([empties[5]]);
  expect(await cellsWith(page, "peer")).toEqual(peersOf(empties[5]));
});

test("the highlight layers look different (selected, same, peer, plain)", async ({ page }) => {
  const v = await values(page);
  const i = v.findIndex((x) => x !== "");
  await cell(page, i).click();
  const bg = (j) => cell(page, j).evaluate((e) => getComputedStyle(e).backgroundColor);
  const same = (await cellsWith(page, "same"))[0];
  const peer = (await cellsWith(page, "peer"))[0];
  const plain = v.map((_, j) => j).find((j) => j !== i && !peersOf(i).includes(j) && v[j] !== v[i]);
  const colours = new Set([await bg(i), await bg(same), await bg(peer), await bg(plain)]);
  expect(colours.size).toBe(4);
});

test("a given digit shows up in the cell and in its accessible name", async ({ page }) => {
  const v = await values(page);
  const i = v.findIndex((x) => x !== "");
  await expect(cell(page, i)).toHaveAttribute("aria-label", new RegExp(`${v[i]}, given`));
  await expect(cell(page, i)).toHaveAttribute("data-state", "given");
});
