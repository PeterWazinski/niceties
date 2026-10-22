import test from "node:test";
import assert from "node:assert/strict";
import { findSymmetries, describe } from "../../js/symmetry.js";
import { generate } from "../../js/penrose.js";

const isPerm = (p) => [...p].sort((a, b) => a - b).every((v, i) => v === i);
const compose = (f, g) => f.map((_, i) => f[g[i]]);

test("the identity comes first", () => {
  for (const seed of ["wheel", "half", "fan"]) {
    const { tiles } = generate(seed, 3);
    const syms = findSymmetries(tiles);
    assert.equal(syms[0].kind, "rotation");
    assert.equal(syms[0].angle, 0);
    assert.deepEqual(syms[0].perm, tiles.map((_, i) => i));
  }
});

test("the wheel has the symmetry of a five-fold vertex: five rotations and five reflections, at every depth", () => {
  for (let d = 1; d <= 5; d++) {
    const syms = findSymmetries(generate("wheel", d).tiles);
    assert.equal(syms.length, 10, `depth ${d}`);
    assert.deepEqual(syms.filter((s) => s.kind === "rotation").map((s) => s.angle), [0, 72, 144, 216, 288]);
    assert.equal(syms.filter((s) => s.kind === "reflection").length, 5);
  }
});

test("half and fan are not symmetric: only the identity", () => {
  for (const seed of ["half", "fan"]) {
    for (let d = 1; d <= 4; d++) assert.equal(findSymmetries(generate(seed, d).tiles).length, 1, `${seed} ${d}`);
  }
});

test("every symmetry is a permutation that keeps types and neighbours", () => {
  const { tiles } = generate("wheel", 3);
  for (const s of findSymmetries(tiles)) {
    assert.ok(isPerm(s.perm));
    for (const t of tiles) {
      assert.equal(tiles[s.perm[t.id]].type, t.type);
      assert.equal(tiles[s.perm[t.id]].boundary, t.boundary);
      assert.deepEqual(t.neighbours.map((n) => s.perm[n]).sort((a, b) => a - b), tiles[s.perm[t.id]].neighbours);
    }
  }
});

test("the symmetries form a group: closed under composition, rotation by 72 degrees has order five", () => {
  const syms = findSymmetries(generate("wheel", 3).tiles);
  const known = new Set(syms.map((s) => s.perm.join(",")));
  for (const a of syms) for (const b of syms) assert.ok(known.has(compose(a.perm, b.perm).join(",")));
  const r = syms.find((s) => s.kind === "rotation" && s.angle === 72).perm;
  let p = r;
  for (let k = 1; k < 5; k++) { assert.notDeepEqual(p, syms[0].perm); p = compose(r, p); }
  assert.deepEqual(p, syms[0].perm);
});

test("no tile maps to itself under a rotation (the centre is a vertex, not a tile)", () => {
  const { tiles } = generate("wheel", 3);
  for (const s of findSymmetries(tiles).filter((x) => x.kind === "rotation" && x.angle !== 0)) {
    tiles.forEach((t) => assert.notEqual(s.perm[t.id], t.id));
  }
});

test("describe and an empty patch", () => {
  const syms = findSymmetries(generate("wheel", 2).tiles);
  assert.equal(describe(syms[0]), "identity");
  assert.equal(describe(syms[1]), "rotation by 72°");
  assert.match(describe(syms[5]), /^reflection across the axis at \d+°$/);
  const none = findSymmetries([]);
  assert.equal(none.length > 0, true);
  assert.deepEqual(none[0].perm, []);
});
