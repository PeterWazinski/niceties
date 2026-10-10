const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/rng.js");
const { mulberry32, randomSeed } = globalThis.UM.rng;

test("same seed gives the same sequence", () => {
  const a = mulberry32(4821), b = mulberry32(4821);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test("different seeds give different sequences", () => {
  const a = mulberry32(1), b = mulberry32(2);
  const sa = Array.from({ length: 10 }, a), sb = Array.from({ length: 10 }, b);
  assert.notDeepEqual(sa, sb);
});

test("values are in [0, 1)", () => {
  const r = mulberry32(99);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, "out of range: " + v);
  }
});

test("values are roughly uniform", () => {
  const r = mulberry32(7);
  let sum = 0;
  for (let i = 0; i < 20000; i++) sum += r();
  assert.ok(Math.abs(sum / 20000 - 0.5) < 0.02);
});

test("randomSeed is an integer in 1..MAX_RANDOM_SEED", () => {
  const max = globalThis.UM.config.MAX_RANDOM_SEED;
  for (let i = 0; i < 1000; i++) {
    const s = randomSeed();
    assert.ok(Number.isInteger(s) && s >= 1 && s <= max);
  }
});
