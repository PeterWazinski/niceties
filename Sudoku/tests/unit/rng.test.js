import test from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../js/rng.js";

test("same seed gives the same sequence, different seeds differ", () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  const sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test("next() is in [0,1) and int(n) in [0,n)", () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1);
    const k = r.int(9);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 9);
  }
});

test("int(n) reaches every value", () => {
  const r = createRng(1), seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(r.int(9));
  assert.equal(seen.size, 9);
});

test("shuffle is a permutation and reproducible", () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const x = createRng(5).shuffle(src.slice()), y = createRng(5).shuffle(src.slice());
  assert.deepEqual(x, y);
  assert.deepEqual([...x].sort(), src);
  assert.notDeepEqual(x, src);
});
