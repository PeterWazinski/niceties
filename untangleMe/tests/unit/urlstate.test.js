const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/urlstate.js");
const UM = globalThis.UM;
const { parse, serialise } = UM.urlstate;
const { MIN_NODES, MAX_NODES, DEFAULT_NODES } = UM.config;

const fixedSeed = () => 777;

test("parses a valid hash", () => {
  assert.deepEqual(parse("#n=8&seed=4821", { randomSeed: fixedSeed }),
    { n: 8, seed: 4821, seedFromUrl: true });
});

test("works without the leading #, and with reversed order", () => {
  const r = parse("seed=12&n=20", { randomSeed: fixedSeed });
  assert.equal(r.n, 20);
  assert.equal(r.seed, 12);
});

test("serialise and parse round trip", () => {
  const id = { n: 14, seed: 99999 };
  const r = parse(serialise(id), { randomSeed: fixedSeed });
  assert.equal(r.n, 14);
  assert.equal(r.seed, 99999);
  assert.equal(serialise(id), "#n=14&seed=99999");
});

test("n is clamped to the allowed range", () => {
  assert.equal(parse("#n=999&seed=1").n, MAX_NODES);
  assert.equal(parse("#n=0&seed=1").n, MIN_NODES);
  assert.equal(parse("#n=3&seed=1").n, MIN_NODES);
});

test("garbage values fall back to defaults", () => {
  const r = parse("#n=abc&seed=-3", { randomSeed: fixedSeed });
  assert.equal(r.n, DEFAULT_NODES);
  assert.equal(r.seed, 777);
  assert.equal(r.seedFromUrl, false);
});

test("fractional, empty and oversized numbers are rejected", () => {
  assert.equal(parse("#n=8.5&seed=1").n, DEFAULT_NODES);
  assert.equal(parse("#n=&seed=", { randomSeed: fixedSeed }).seed, 777);
  assert.equal(parse("#seed=99999999999", { randomSeed: fixedSeed }).seed, 777);
  assert.equal(parse("#seed=0", { randomSeed: fixedSeed }).seedFromUrl, false);
});

test("missing hash uses defaults and a random seed", () => {
  for (const h of ["", "#", undefined, null]) {
    const r = parse(h, { randomSeed: fixedSeed });
    assert.deepEqual(r, { n: DEFAULT_NODES, seed: 777, seedFromUrl: false });
  }
});

test("defaultN option (stored node count) is used when the hash has no n", () => {
  assert.equal(parse("#seed=5", { defaultN: 14 }).n, 14);
  assert.equal(parse("#n=10&seed=5", { defaultN: 14 }).n, 10);
});

test("unknown keys and malformed pairs are ignored", () => {
  const r = parse("#foo=bar&&n=12&junk&seed=5&x==", { randomSeed: fixedSeed });
  assert.equal(r.n, 12);
  assert.equal(r.seed, 5);
});

test("default random seed is a valid seed", () => {
  const r = parse("");
  assert.ok(Number.isInteger(r.seed) && r.seed >= 1 && r.seed <= UM.config.MAX_RANDOM_SEED);
});
