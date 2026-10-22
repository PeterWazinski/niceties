import test from "node:test";
import assert from "node:assert/strict";
import { analyse, minimalAnchors } from "../../js/uniqueness.js";
import { findSymmetries } from "../../js/symmetry.js";
import { colourTiles } from "../../js/color.js";
import { generate } from "../../js/penrose.js";
import { createRng } from "../../js/rng.js";
import { DEFAULTS } from "../../js/config.js";

const wheel3 = generate("wheel", 3).tiles;
const sym3 = findSymmetries(wheel3);
const plane3 = colourTiles(wheel3, DEFAULTS);

test("an asymmetric patch is unique without any anchor", () => {
  const { tiles } = generate("half", 3);
  const r = analyse(colourTiles(tiles, DEFAULTS), findSymmetries(tiles), []);
  assert.equal(r.relevant.length, 0);
  assert.equal(r.unique, true);
  assert.equal(r.anchors, 0);
  assert.deepEqual(minimalAnchors(colourTiles(tiles, DEFAULTS), findSymmetries(tiles)), { anchors: [], exact: true });
});

test("a symmetric patch with a plane colouring is not unique without anchors: nine other pictures", () => {
  const r = analyse(plane3, sym3, []);
  assert.equal(r.relevant.length, 9);
  assert.deepEqual(r.open, r.relevant);
  assert.equal(r.unique, false);
  assert.equal(r.ties.length, 0);
});

test("one anchor on a tile that no symmetry fixes rules out every symmetric copy", () => {
  const free = wheel3.find((t) => sym3.every((s) => s.perm[t.id] !== t.id || s.angle === 0 && s.kind === "rotation"));
  const r = analyse(plane3, sym3, [free.id]);
  assert.equal(r.unique, true);
  assert.equal(r.open.length, 0);
  assert.equal(r.anchors, 1);
});

test("an anchor on a tile that a reflection fixes does not rule that reflection out", () => {
  const sym = sym3.findIndex((s) => s.kind === "reflection");
  const fixedTile = wheel3.find((t) => sym3[sym].perm[t.id] === t.id);
  assert.ok(fixedTile, "a reflection axis passes through some tile");
  const r = analyse(plane3, sym3, [fixedTile.id]);
  assert.ok(r.open.includes(sym));
  assert.equal(r.unique, false);
});

test("tied colours are reported", () => {
  const r = analyse(colourTiles(wheel3, { ...DEFAULTS, map: "radial", ds: 0, dl: 0 }), sym3, []);
  assert.ok(r.ties.length > 0);
  assert.equal(r.tiedTiles, r.ties.reduce((s, g) => s + g.length, 0));
});

test("duplicate anchors count once", () => {
  assert.equal(analyse(plane3, sym3, [3, 3, 3]).anchors, 1);
});

test("the minimal anchor set for a generic colouring is a single tile, and it makes the patch unique", () => {
  const m = minimalAnchors(plane3, sym3);
  assert.equal(m.anchors.length, 1);
  assert.equal(m.exact, true);
  assert.equal(analyse(plane3, sym3, m.anchors).unique, true);
});

// The smallest k such that some k tiles make the patch unique, by trying every subset.
function bruteForceMinimum(colours, syms, maxK) {
  const n = colours.length;
  const pick = (start, left, chosen) => {
    if (left === 0) return analyse(colours, syms, chosen).unique;
    for (let t = start; t < n; t++) { chosen.push(t); if (pick(t + 1, left - 1, chosen)) return true; chosen.pop(); }
    return false;
  };
  for (let k = 0; k <= maxK; k++) if (pick(0, k, [])) return k;
  return -1;
}

test("the minimal anchor set is as small as the best set found by brute force (colourings that need several anchors)", () => {
  const { tiles } = generate("wheel", 2); // 20 tiles
  const syms = findSymmetries(tiles);
  const rng = createRng(21);
  let needed = 0;
  for (let trial = 0; trial < 25; trial++) {
    // mostly one colour, a few special tiles: many symmetries leave most tiles unchanged
    const colours = tiles.map(() => "#000000");
    const specials = 1 + rng.int(3);
    for (let k = 0; k < specials; k++) colours[rng.int(tiles.length)] = "#" + (16 + rng.int(200)).toString(16).padStart(2, "0") + "0000";
    const m = minimalAnchors(colours, syms);
    const best = bruteForceMinimum(colours, syms, 4);
    assert.equal(m.anchors.length, best, `trial ${trial}`);
    assert.equal(m.exact, true);
    assert.equal(analyse(colours, syms, m.anchors).unique, true, `trial ${trial}: the set works`);
    needed = Math.max(needed, m.anchors.length);
  }
  assert.ok(needed >= 2, "some colourings need more than one anchor");
});

test("beyond twenty symmetries the search is greedy but still rules out everything", () => {
  const n = 30;
  const colours = Array.from({ length: n }, (_, i) => "#" + (i * 7).toString(16).padStart(6, "0"));
  /** @type {any[]} */
  const syms = Array.from({ length: 24 }, (_, j) => ({ kind: "rotation", angle: j, perm: Array.from({ length: n }, (_, t) => (t + j) % n) }));
  const m = minimalAnchors(colours, syms);
  assert.equal(m.exact, false);
  assert.equal(analyse(colours, syms, m.anchors).unique, true);
  assert.ok(m.anchors.length >= 1);
});
