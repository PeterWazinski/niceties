import test from "node:test";
import assert from "node:assert/strict";
import { hslToRgb, rgbToHsl, toHex, colourTiles, colourStats } from "../../js/color.js";
import { generate } from "../../js/penrose.js";
import { DEFAULTS } from "../../js/config.js";

test("HSL to sRGB: known values", () => {
  assert.deepEqual(hslToRgb(0, 100, 50), [255, 0, 0]);
  assert.deepEqual(hslToRgb(60, 100, 50), [255, 255, 0]);
  assert.deepEqual(hslToRgb(120, 100, 50), [0, 255, 0]);
  assert.deepEqual(hslToRgb(180, 100, 50), [0, 255, 255]);
  assert.deepEqual(hslToRgb(240, 100, 50), [0, 0, 255]);
  assert.deepEqual(hslToRgb(300, 100, 50), [255, 0, 255]);
  assert.deepEqual(hslToRgb(0, 0, 100), [255, 255, 255]);
  assert.deepEqual(hslToRgb(0, 0, 0), [0, 0, 0]);
  assert.deepEqual(hslToRgb(123, 0, 50), [128, 128, 128]);
  assert.deepEqual(hslToRgb(210, 50, 50), [64, 128, 191]);
});

test("hue wraps and saturation / lightness are clamped", () => {
  assert.deepEqual(hslToRgb(360, 100, 50), hslToRgb(0, 100, 50));
  assert.deepEqual(hslToRgb(-120, 100, 50), hslToRgb(240, 100, 50));
  assert.deepEqual(hslToRgb(720 + 60, 100, 50), hslToRgb(60, 100, 50));
  assert.deepEqual(hslToRgb(10, 150, 50), hslToRgb(10, 100, 50));
  assert.deepEqual(hslToRgb(10, 50, 130), [255, 255, 255]);
  assert.deepEqual(hslToRgb(10, 50, -20), [0, 0, 0]);
});

test("toHex", () => {
  assert.equal(toHex([255, 0, 128]), "#ff0080");
  assert.equal(toHex([0, 0, 0]), "#000000");
  assert.equal(toHex([1, 2, 3]), "#010203");
});

test("HSL -> RGB -> HSL round trip", () => {
  for (const [h, s, l] of [[0, 100, 50], [37, 60, 40], [250, 55, 70], [300, 20, 30], [180, 90, 85], [90, 40, 20]]) {
    const [r, g, b] = hslToRgb(h, s, l);
    const [h2, s2, l2] = rgbToHsl(r, g, b);
    assert.ok(Math.abs(h - h2) < 2.5 && Math.abs(s - s2) < 2.5 && Math.abs(l - l2) < 1, `${h},${s},${l} -> ${h2},${s2},${l2}`);
  }
  assert.deepEqual(rgbToHsl(128, 128, 128).map((v) => Math.round(v)), [0, 0, 50]);
});

const wheel3 = generate("wheel", 3).tiles;

test("plane: hue runs from hue start on one side to hue end on the other", () => {
  const st = { ...DEFAULTS, ds: 0, dl: 0, h0: 0, h1: 120 };
  const colours = colourTiles(wheel3, st);
  let left = 0, right = 0;
  wheel3.forEach((t, i) => { if (t.cx < wheel3[left].cx) left = i; if (t.cx > wheel3[right].cx) right = i; });
  const hue = (hex) => rgbToHsl(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16))[0];
  assert.ok(hue(colours[left]) < 15, "left tile near hue start");
  assert.ok(hue(colours[right]) > 105, "right tile near hue end");
  // monotonic: sorted by x, the hue never decreases
  const order = wheel3.map((_, i) => i).sort((a, b) => wheel3[a].cx - wheel3[b].cx);
  for (let k = 1; k < order.length; k++) assert.ok(hue(colours[order[k]]) >= hue(colours[order[k - 1]]) - 1.5);
});

test("plane: neighbouring tiles get similar colours (continuous)", () => {
  const colours = colourTiles(wheel3, DEFAULTS);
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  for (const t of wheel3) for (const n of t.neighbours) {
    const a = rgb(colours[t.id]), b = rgb(colours[n]);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 90, `tiles ${t.id} and ${n}`);
  }
});

test("plane with generic parameters: every tile has its own colour", () => {
  for (const seed of ["wheel", "half", "fan"]) {
    for (let d = 1; d <= 5; d++) {
      const tiles = generate(seed, d).tiles;
      const stats = colourStats(colourTiles(tiles, DEFAULTS));
      assert.equal(stats.ties.length, 0, `${seed} depth ${d}`);
      assert.equal(stats.distinct, tiles.length);
    }
  }
});

test("angular: tiles on the same ray of a symmetric patch share a colour", () => {
  const st = { ...DEFAULTS, map: "angular" };
  const stats = colourStats(colourTiles(wheel3, st));
  assert.ok(stats.ties.length > 0);
  assert.ok(stats.distinct < wheel3.length);
});

test("radial uses the distance: with zero slopes it equals angular", () => {
  const radial = colourTiles(wheel3, { ...DEFAULTS, map: "radial", ds: 0, dl: 0 });
  const angular = colourTiles(wheel3, { ...DEFAULTS, map: "angular", ds: 0, dl: 0 });
  assert.deepEqual(radial, angular);
  assert.notDeepEqual(colourTiles(wheel3, { ...DEFAULTS, map: "radial", ds: 0, dl: 40 }), angular);
});

test("the thin tile shift changes the lightness of thin tiles only", () => {
  const a = colourTiles(wheel3, { ...DEFAULTS, dt: 0 });
  const b = colourTiles(wheel3, { ...DEFAULTS, dt: 12 });
  wheel3.forEach((t, i) => {
    if (t.type === "thick") assert.equal(a[i], b[i]);
    else assert.notEqual(a[i], b[i]);
  });
});

test("rotation changes the colours; the same settings give the same colours", () => {
  assert.deepEqual(colourTiles(wheel3, DEFAULTS), colourTiles(wheel3, { ...DEFAULTS }));
  assert.notDeepEqual(colourTiles(wheel3, DEFAULTS), colourTiles(wheel3, { ...DEFAULTS, rot: 90 }));
  assert.deepEqual(colourTiles([], DEFAULTS), []);
});

test("colourStats: distinct colours and tied groups", () => {
  assert.deepEqual(colourStats(["#000000", "#111111", "#000000", "#222222", "#111111", "#000000"]),
    { distinct: 3, ties: [[0, 2, 5], [1, 4]] });
  assert.deepEqual(colourStats([]), { distinct: 0, ties: [] });
});
