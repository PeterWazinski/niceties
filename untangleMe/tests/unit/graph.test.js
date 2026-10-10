const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/puzzle.js");
const UM = globalThis.UM;
const { MIN_NODES, MAX_NODES } = UM.config;

const SEEDS = 40;

test("generated layouts are crossing free and respect edge bounds (n = 6..30)", () => {
  for (let n = MIN_NODES; n <= MAX_NODES; n++) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = UM.graph.planarGraph(n, UM.rng.mulberry32(seed), 1);
      assert.equal(UM.geometry.countCrossings(g.positions, g.edges).count, 0, "n=" + n + " seed=" + seed);
      // Maximal planar straight-line graph: 3n-3-h edges with 3 <= h <= n hull nodes.
      assert.ok(g.edges.length <= 3 * n - 6, "too many edges n=" + n);
      assert.ok(g.edges.length >= 2 * n - 3, "too few edges n=" + n);
    }
  }
});

test("edge list has no loops or duplicates", () => {
  const g = UM.graph.planarGraph(20, UM.rng.mulberry32(5), 1);
  const seen = new Set();
  g.edges.forEach((e) => {
    assert.notEqual(e[0], e[1]);
    const key = e.join("-");
    assert.ok(!seen.has(key));
    seen.add(key);
  });
});

test("density limits the number of edges", () => {
  for (const n of [6, 14, 30]) {
    const g = UM.graph.planarGraph(n, UM.rng.mulberry32(3), 0.5);
    assert.ok(g.edges.length <= Math.round(0.5 * (3 * n - 6)), "n=" + n);
  }
});

test("scramble produces at least one crossing for every size", () => {
  for (let n = MIN_NODES; n <= MAX_NODES; n++) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = UM.puzzle.createPuzzle(n, seed);
      assert.ok(UM.geometry.countCrossings(p.start, p.edges).count > 0, "n=" + n + " seed=" + seed);
    }
  }
});

test("puzzle: same (n, seed) gives a deep-equal puzzle, different seed differs", () => {
  const a = UM.puzzle.createPuzzle(12, 4821), b = UM.puzzle.createPuzzle(12, 4821),
        c = UM.puzzle.createPuzzle(12, 4822);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.start, c.start);
});

test("puzzle: shape and solution", () => {
  const p = UM.puzzle.createPuzzle(10, 7);
  assert.equal(p.n, 10);
  assert.equal(p.seed, 7);
  assert.equal(p.start.length, 10);
  assert.equal(p.solution.length, 10);
  p.start.concat(p.solution).forEach((pt) => {
    assert.ok(pt[0] >= 0 && pt[0] < 1 && pt[1] >= 0 && pt[1] < 1);
  });
  assert.equal(UM.geometry.countCrossings(p.solution, p.edges).count, 0);
});

test("puzzle: n outside the allowed range is rejected", () => {
  assert.throws(() => UM.puzzle.createPuzzle(MIN_NODES - 1, 1), RangeError);
  assert.throws(() => UM.puzzle.createPuzzle(MAX_NODES + 1, 1), RangeError);
  assert.throws(() => UM.puzzle.createPuzzle(8.5, 1), RangeError);
});

test("scramble throws when no crossing can exist (attempt cap)", () => {
  // Two disjoint-capable edges can cross, a single edge never can.
  assert.throws(() => UM.graph.scramble(2, [[0, 1]], UM.rng.mulberry32(1), 50), /scramble/);
});

test("creating a 30 node puzzle is fast", () => {
  UM.puzzle.createPuzzle(30, 1); // warm up
  const t0 = process.hrtime.bigint();
  UM.puzzle.createPuzzle(30, 123);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 200, "took " + ms + " ms");
});
