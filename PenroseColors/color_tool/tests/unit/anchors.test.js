import test from "node:test";
import assert from "node:assert/strict";
import { defaultAnchors } from "../../js/anchors.js";
import { generate } from "../../js/penrose.js";
import { findSymmetries } from "../../js/symmetry.js";
import { colourTiles } from "../../js/color.js";
import { analyse } from "../../js/uniqueness.js";
import { DEFAULTS } from "../../js/config.js";

const centroid = (tiles) => ({
  x: tiles.reduce((s, t) => s + t.cx, 0) / tiles.length,
  y: tiles.reduce((s, t) => s + t.cy, 0) / tiles.length
});

test("wheel and half wheel: five anchors, all different, ascending", () => {
  for (const seed of ["wheel", "half"]) {
    for (let d = 2; d <= 5; d++) {
      const { tiles } = generate(seed, d);
      const a = defaultAnchors(tiles, seed);
      assert.equal(a.length, 5, `${seed} depth ${d}`);
      assert.equal(new Set(a).size, 5);
      assert.deepEqual(a, [...a].sort((p, q) => p - q));
    }
  }
});

test("wheel and half wheel: one anchor near the middle, four towards right, bottom, left and top", () => {
  for (const seed of ["wheel", "half"]) {
    for (let d = 3; d <= 5; d++) {
      const { tiles } = generate(seed, d);
      const c = centroid(tiles);
      const anchors = defaultAnchors(tiles, seed).map((id) => tiles[id]);
      const radius = (t) => Math.hypot(t.cx - c.x, t.cy - c.y);
      const nearest = anchors.reduce((best, t) => (radius(t) < radius(best) ? t : best));
      const minRadius = Math.min(...tiles.map(radius));
      assert.ok(radius(nearest) <= minRadius + 1e-9, `${seed} d${d}: the middle anchor is the tile nearest the middle`);
      const others = anchors.filter((t) => t !== nearest);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const proj = (t) => (t.cx - c.x) * dx + (t.cy - c.y) * dy;
        const best = Math.max(...tiles.map(proj));
        assert.ok(others.some((t) => proj(t) >= 0.9 * best), `${seed} d${d}: an anchor reaches 90% of the extent towards (${dx},${dy})`);
      }
    }
  }
});

test("fan: four anchors, the most distant tiles to the right, bottom, left and top", () => {
  for (let d = 2; d <= 5; d++) {
    const { tiles } = generate("fan", d);
    const a = defaultAnchors(tiles, "fan").map((id) => tiles[id]);
    assert.equal(a.length, 4, `depth ${d}`);
    assert.equal(new Set(a).size, 4);
    const c = { x: tiles.reduce((s, t) => s + t.cx, 0) / tiles.length, y: tiles.reduce((s, t) => s + t.cy, 0) / tiles.length };
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const proj = (t) => (t.cx - c.x) * dx + (t.cy - c.y) * dy;
      const best = Math.max(...tiles.map(proj));
      assert.ok(a.some((t) => proj(t) >= 0.95 * best), `depth ${d}: an anchor at the extreme towards (${dx},${dy})`);
    }
    // no anchor in the middle: the nearest anchor is far from the centroid compared with the nearest tile
    const dist = (t) => Math.hypot(t.cx - c.x, t.cy - c.y);
    assert.ok(Math.min(...a.map(dist)) > Math.min(...tiles.map(dist)) || tiles.length < 8);
  }
});

test("the default anchors are the same every time and never pick a tile twice, even in tiny patches", () => {
  const { tiles } = generate("wheel", 1);
  assert.deepEqual(defaultAnchors(tiles, "wheel"), defaultAnchors(tiles, "wheel"));
  const tiny = generate("fan", 1).tiles; // two tiles
  const a = defaultAnchors(tiny, "fan");
  assert.equal(new Set(a).size, a.length);
  assert.ok(a.length <= tiny.length);
  assert.deepEqual(defaultAnchors([], "wheel"), []);
});

test("on the wheel the default anchors alone make the solution unique, for every colouring tried", () => {
  for (let d = 2; d <= 5; d++) {
    const { tiles } = generate("wheel", d);
    const syms = findSymmetries(tiles);
    const anchors = defaultAnchors(tiles, "wheel");
    for (const extra of [{}, { ctr: "dark", map: "radial" }, { map: "radial" }, { rot: 33 }, { h0: 0, h1: 360, map: "radial", ds: 0, dl: -30 }]) {
      const r = analyse(colourTiles(tiles, { ...DEFAULTS, ...extra }), syms, anchors);
      assert.equal(r.unique, true, `depth ${d} ${JSON.stringify(extra)}`);
      assert.equal(r.anchors, 5);
    }
  }
});
