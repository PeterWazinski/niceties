import test from "node:test";
import assert from "node:assert/strict";
import { orbits, GENERATORS, SYMMETRY_TYPES } from "../../js/symmetry.js";

test("all eight symmetry types are defined", () => {
  assert.deepEqual(SYMMETRY_TYPES, ["rot180", "rot90", "mirrorH", "mirrorV", "diagonal", "antiDiagonal", "bothDiagonals", "bothAxes"]);
  for (const t of SYMMETRY_TYPES) assert.ok(GENERATORS[t], t);
  assert.throws(() => orbits("nope"));
});

test("orbits partition the 81 cells for every type", () => {
  for (const t of SYMMETRY_TYPES) {
    const all = orbits(t).flat();
    assert.equal(all.length, 81, t);
    assert.equal(new Set(all).size, 81, t);
  }
});

test("each orbit is closed under the generators of its symmetry", () => {
  for (const t of SYMMETRY_TYPES) {
    for (const orbit of orbits(t)) {
      for (const f of GENERATORS[t]) for (const i of orbit) assert.ok(orbit.includes(f(i)), t);
    }
  }
});

test("applying a mirror or a 180 degree rotation twice returns to the start", () => {
  for (const t of ["rot180", "mirrorH", "mirrorV", "diagonal", "antiDiagonal"]) {
    const f = GENERATORS[t][0];
    for (let i = 0; i < 81; i++) assert.equal(f(f(i)), i, t);
  }
  const r = GENERATORS.rot90[0];
  for (let i = 0; i < 81; i++) assert.equal(r(r(r(r(i)))), i);
});

test("rot180: 40 pairs and the centre cell", () => {
  const o = orbits("rot180");
  assert.equal(o.length, 41);
  assert.equal(o.filter((x) => x.length === 2).length, 40);
  assert.deepEqual(o.find((x) => x.length === 1), [40]);
});

test("rot90 and both-axes orbits have up to 4 cells", () => {
  assert.equal(orbits("rot90").filter((x) => x.length === 4).length, 20);
  assert.deepEqual(orbits("rot90").find((x) => x.length === 1), [40]);
  assert.equal(Math.max(...orbits("bothAxes").map((x) => x.length)), 4);
  assert.equal(Math.max(...orbits("bothDiagonals").map((x) => x.length)), 4);
});

test("mirrors fix their axis cells, diagonals fix the diagonal", () => {
  for (const t of ["diagonal", "antiDiagonal", "mirrorH", "mirrorV"]) {
    assert.equal(orbits(t).filter((x) => x.length === 1).length, 9, t);
  }
});
