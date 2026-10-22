import test from "node:test";
import assert from "node:assert/strict";
import { parseParams, serializeParams, ignoredParams } from "../../js/params.js";
import { DEFAULTS, MAX_DEPTH, PHI, SLIDERS } from "../../js/config.js";

test("config: golden ratio and defaults", () => {
  assert.ok(Math.abs(PHI * PHI - PHI - 1) < 1e-12);
  assert.equal(DEFAULTS.seed, "wheel");
  assert.equal(DEFAULTS.map, "plane");
  assert.equal(DEFAULTS.shuffle, 0);
});

test("an empty query gives the defaults and the defaults give an empty query", () => {
  assert.deepEqual(parseParams(""), DEFAULTS);
  assert.deepEqual(parseParams("?"), DEFAULTS);
  assert.equal(serializeParams(DEFAULTS), "");
});

test("round trip of changed settings", () => {
  const st = { ...DEFAULTS, seed: "half", depth: 4, map: "radial", ctr: "dark", h0: 10, h1: 300, s: 33, l: 44, ds: -5, dl: 7, rot: 77, dt: -3, gap: 2.5, shuffle: 12345, sw: 30 };
  const q = serializeParams(st);
  assert.deepEqual(parseParams("?" + q), st);
  assert.ok(!q.includes("seed=wheel"));
});

test("only values that differ from the defaults are written", () => {
  assert.equal(serializeParams({ ...DEFAULTS, depth: 5 }), "depth=5");
});

test("invalid values fall back to the defaults, numbers are clamped", () => {
  assert.equal(parseParams("?seed=nope").seed, DEFAULTS.seed);
  assert.equal(parseParams("?map=nope").map, DEFAULTS.map);
  assert.equal(parseParams("?map=angular").map, DEFAULTS.map, "angular was dropped");
  assert.equal(parseParams("?ctr=dark").ctr, "dark");
  assert.equal(parseParams("?ctr=nope").ctr, "bright");
  assert.equal(parseParams("?depth=abc").depth, DEFAULTS.depth);
  assert.equal(parseParams("?depth=99").depth, MAX_DEPTH);
  assert.equal(parseParams("?depth=0").depth, 1);
  assert.equal(parseParams("?depth=2.6").depth, 3);
  assert.equal(parseParams("?h0=-5").h0, 0);
  assert.equal(parseParams("?h1=500").h1, 360);
  assert.equal(parseParams("?s=").s, DEFAULTS.s);
  assert.equal(parseParams("?shuffle=-3").shuffle, 0);
  assert.equal(parseParams("?sw=x").sw, DEFAULTS.sw);
  assert.deepEqual(parseParams("?unknown=1&foo=bar"), DEFAULTS);
});

test("every slider has a parameter and the ranges are sane", () => {
  for (const s of SLIDERS) {
    assert.ok(s.key in DEFAULTS, s.key);
    assert.ok(s.min < s.max && s.step > 0);
    assert.ok(DEFAULTS[s.key] >= s.min && DEFAULTS[s.key] <= s.max);
    const st = parseParams(`?${s.key}=${s.max}`);
    assert.equal(st[s.key], s.max);
  }
});

test("anchors: a comma separated list of tile ids", () => {
  assert.equal(parseParams("?anchors=3,17,40").anchors, "3,17,40");
  assert.equal(parseParams("?anchors=abc").anchors, "");
  assert.equal(parseParams("?anchors=none").anchors, "none");
  assert.equal(parseParams("").anchors, "", "no parameter: the default anchors");
  assert.equal(parseParams("?anchors=1,,2").anchors, "");
  assert.equal(parseParams("?anchors=-4").anchors, "");
  assert.equal(serializeParams({ ...DEFAULTS, anchors: "5,9" }), "anchors=5%2C9");
  assert.equal(parseParams("?" + serializeParams({ ...DEFAULTS, anchors: "5,9" })).anchors, "5,9");
});

test("ignoredParams names what was ignored or corrected", () => {
  assert.deepEqual(ignoredParams(""), []);
  assert.deepEqual(ignoredParams("?depth=3&h0=250&seed=wheel"), []);
  assert.deepEqual(ignoredParams("?depth=99"), ["depth"]);
  assert.deepEqual(ignoredParams("?seed=nope&foo=1"), ["seed", "foo"]);
  assert.deepEqual(ignoredParams("?h0=abc&anchors=x"), ["h0", "anchors"]);
  assert.deepEqual(ignoredParams("?map=angular"), ["map"]);
  assert.deepEqual(ignoredParams("?anchors=none&ctr=dark"), []);
  assert.deepEqual(ignoredParams("?depth=4&h1=70&gap=2.5&shuffle=9&sw=30&map=radial"), []);
});
