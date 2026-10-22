import test from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../js/rng.js";

test("the same seed gives the same numbers, another seed other numbers", () => {
  const a = createRng(7), b = createRng(7), c = createRng(8);
  const xs = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()));
  assert.notDeepEqual(xs, Array.from({ length: 20 }, () => c.next()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test("int stays in range and shuffle is a permutation", () => {
  const r = createRng(1);
  for (let i = 0; i < 200; i++) { const v = r.int(5); assert.ok(Number.isInteger(v) && v >= 0 && v < 5); }
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.deepEqual([...r.shuffle(arr.slice())].sort((a, b) => a - b), arr);
});
