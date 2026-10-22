// Exploration (phase 6): prints the numbers behind design/exploration-results.md.
// Run: node tools/explore.mjs
import { generate } from "../js/penrose.js";
import { findSymmetries } from "../js/symmetry.js";
import { colourTiles, colourStats } from "../js/color.js";
import { analyse, minimalAnchors } from "../js/uniqueness.js";
import { createPuzzle } from "../js/puzzle.js";
import { createRng } from "../js/rng.js";
import { DEFAULTS } from "../js/config.js";

const SEEDS = ["wheel", "half", "fan"];
const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

console.log("## Patch sizes, symmetry and swap capacity");
console.log("seed | depth | tiles | thick | thin | symmetries | max swaps (capacity) | full shuffle needs on average");
for (const seed of SEEDS) {
  for (let depth = 1; depth <= 5; depth++) {
    const { tiles } = generate(seed, depth);
    const types = tiles.map((t) => t.type);
    const syms = findSymmetries(tiles);
    const p = createPuzzle(types);
    const needs = [];
    for (let k = 1; k <= 60; k++) { p.shuffleFull(createRng(k)); needs.push(p.minimumSwaps()); }
    const thick = types.filter((t) => t === "thick").length;
    console.log([seed, depth, tiles.length, thick, tiles.length - thick, syms.length, p.capacity(), Math.round(mean(needs))].join(" | "));
  }
}

console.log("\n## Which patches carry which swap budget (exact target swaps possible = capacity >= budget)");
for (const budget of [30, 80, 150, 200]) {
  const fits = [];
  for (const seed of SEEDS) for (let depth = 1; depth <= 5; depth++) {
    const n = generate(seed, depth).tiles.length;
    if (n - 2 >= budget) fits.push(`${seed}${depth}(${n})`);
  }
  console.log(`budget ${budget}: ${fits.join(" ")}`);
}

console.log("\n## Uniqueness: colour ties, symmetries, anchors needed, and how close colours are");
const COLOURINGS = {
  "plane (default)": {},
  "plane, hue only (ds=dl=0)": { ds: 0, dl: 0 },
  "plane rotated 7 deg": { rot: 7 },
  "plane warm (h0=20 h1=200 ds=30 dl=15 dt=6)": { h0: 20, h1: 200, ds: 30, dl: 15, dt: 6 },
  "radial (default)": { map: "radial" },
  "radial rainbow (h0=0 h1=360 ds=0 dl=-30)": { map: "radial", h0: 0, h1: 360, s: 75, ds: 0, dl: -30 },
  "radial, hue only (ds=dl=0)": { map: "radial", ds: 0, dl: 0 },
  "angular": { map: "angular", s: 80, l: 55, h0: 30, h1: 330 }
};
console.log("seed d | colouring | tiles | different colours | tied tiles | symmetries | change colouring | anchors needed (exact) | closest pair of tiles (RGB distance)");
/** @type {[string, number][]} */
const CASES = [["wheel", 3], ["wheel", 4], ["half", 4], ["fan", 4]];
for (const [seed, depth] of CASES) {
  const { tiles } = generate(seed, depth);
  const syms = findSymmetries(tiles);
  for (const [name, extra] of Object.entries(COLOURINGS)) {
    const colours = colourTiles(tiles, { ...DEFAULTS, ...extra });
    const stats = colourStats(colours);
    const a = analyse(colours, syms, []);
    const m = minimalAnchors(colours, syms);
    const rgbs = colours.map(rgb);
    let closest = Infinity;
    for (let i = 0; i < rgbs.length; i++) for (let j = i + 1; j < rgbs.length; j++) if (colours[i] !== colours[j]) closest = Math.min(closest, dist(rgbs[i], rgbs[j]));
    console.log([`${seed} ${depth}`, name, tiles.length, stats.distinct, a.tiedTiles, syms.length, a.relevant.length, `${m.anchors.length}${m.exact ? "" : "~"}`, closest.toFixed(1)].join(" | "));
  }
}
