const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/layout.js");
require("../../js/rng.js");
require("../../js/graph.js");
const UM = globalThis.UM;
const { MIN_NODES, MAX_NODES } = UM.config;

const SEEDS = 15;

function raw(n, seed) {
  return UM.graph.planarGraph(n, UM.rng.mulberry32(seed), 1);
}

function lengthSpread(pos, edges) {
  const len = edges.map((e) => Math.hypot(pos[e[0]][0] - pos[e[1]][0], pos[e[0]][1] - pos[e[1]][1])),
        mean = len.reduce((a, b) => a + b, 0) / len.length,
        variance = len.reduce((a, b) => a + (b - mean) * (b - mean), 0) / len.length;
  return Math.sqrt(variance) / mean;
}

test("beautify never introduces a crossing and stays in the unit square (n = 6..30)", () => {
  for (let n = MIN_NODES; n <= MAX_NODES; n++) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = raw(n, seed), out = UM.layout.beautify(g.positions, g.edges);
      assert.equal(out.length, n);
      assert.equal(UM.geometry.countCrossings(out, g.edges).count, 0, "n=" + n + " seed=" + seed);
      out.forEach((p) => {
        assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1, "out of bounds n=" + n);
      });
    }
  }
});

test("beautify keeps the winding of every triangle (same embedding, no flips)", () => {
  const g = raw(20, 7), out = UM.layout.beautify(g.positions, g.edges),
        orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const has = new Set(g.edges.map((e) => e[0] + "-" + e[1]));
  let checked = 0;
  for (let a = 0; a < 20; a++) for (let b = a + 1; b < 20; b++) for (let c = b + 1; c < 20; c++) {
    if (!(has.has(a + "-" + b) && has.has(b + "-" + c) && has.has(a + "-" + c))) continue;
    assert.equal(Math.sign(orient(out[a], out[b], out[c])), Math.sign(orient(g.positions[a], g.positions[b], g.positions[c])));
    checked++;
  }
  assert.ok(checked > 0);
});

test("beautify evens out edge lengths on average", () => {
  for (const n of [10, 20, 30]) {
    let before = 0, after = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = raw(n, seed);
      before += lengthSpread(g.positions, g.edges);
      after += lengthSpread(UM.layout.beautify(g.positions, g.edges), g.edges);
    }
    assert.ok(after < before * 0.9, "n=" + n + " before=" + before / SEEDS + " after=" + after / SEEDS);
  }
});

test("beautify is deterministic and does not modify its input", () => {
  const g = raw(15, 3), snapshot = JSON.stringify(g.positions),
        a = UM.layout.beautify(g.positions, g.edges),
        b = UM.layout.beautify(g.positions, g.edges);
  assert.equal(JSON.stringify(g.positions), snapshot);
  assert.deepEqual(a, b);
});

test("beautify returns a copy of a drawing that already has crossings", () => {
  const pos = [[0, 0], [1, 1], [0, 1], [1, 0]], edges = [[0, 1], [2, 3]],
        out = UM.layout.beautify(pos, edges);
  assert.deepEqual(out, pos);
  assert.notEqual(out, pos);
});

test("beautify copes with degenerate input (collinear nodes, no edges)", () => {
  const line = [[0.1, 0.5], [0.4, 0.5], [0.9, 0.5]];
  assert.deepEqual(UM.layout.beautify(line, [[0, 1], [1, 2]]).length, 3);
  assert.equal(UM.layout.beautify([[0.2, 0.2], [0.8, 0.9], [0.5, 0.1]], []).length, 3);
});

test("fitToUnitSquare stretches the bounding box over [0,1]^2", () => {
  const out = UM.layout.fitToUnitSquare([[0.25, 0.25], [0.75, 0.75], [0.5, 0.5]]);
  assert.deepEqual(out, [[0, 0], [1, 1], [0.5, 0.5]]);
});
