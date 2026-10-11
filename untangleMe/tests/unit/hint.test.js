const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/puzzle.js");
require("../../js/hint.js");
const UM = globalThis.UM;

const cross = (pos, edges) => UM.geometry.countCrossings(pos, edges).count;

test("alignSolution returns the solution itself when it already fits", () => {
  const puzzle = UM.puzzle.createPuzzle(8, 42);
  assert.deepEqual(UM.hint.alignSolution(puzzle.solution, puzzle.solution), puzzle.solution);
});

test("alignSolution follows a mirrored or rotated copy of the solution", () => {
  const puzzle = UM.puzzle.createPuzzle(10, 7);
  const mirrored = puzzle.solution.map((p) => [1 - p[0], p[1]]);
  const rotated = puzzle.solution.map((p) => [1 - p[1], p[0]]);
  [mirrored, rotated].forEach((layout) => {
    const aligned = UM.hint.alignSolution(puzzle.solution, layout);
    aligned.forEach((p, i) => {
      assert.ok(Math.abs(p[0] - layout[i][0]) < 1e-9 && Math.abs(p[1] - layout[i][1]) < 1e-9);
    });
    assert.equal(cross(aligned, puzzle.edges), 0, "alignment keeps the layout planar");
  });
});

test("chooseHintNodes picks a misplaced node and never one already in place", () => {
  const puzzle = UM.puzzle.createPuzzle(8, 42);
  const nodes = UM.hint.chooseHintNodes(puzzle.start, puzzle.edges, puzzle.solution, 1);
  assert.equal(nodes.length, 1);
  assert.notDeepEqual(puzzle.start[nodes[0]], puzzle.solution[nodes[0]]);

  // Only node 3 is away from its target: it is the only candidate, even when two are asked for.
  const target = puzzle.start.map((p) => [p[0], p[1]]);
  target[3] = puzzle.solution[3];
  assert.deepEqual(UM.hint.chooseHintNodes(puzzle.start, puzzle.edges, target, 2), [3]);
});

test("chooseHintNodes returns nothing for a solved layout", () => {
  const puzzle = UM.puzzle.createPuzzle(8, 42);
  assert.deepEqual(UM.hint.chooseHintNodes(puzzle.solution, puzzle.edges, puzzle.solution, 2), []);
});

test("chooseHintNodes can return two distinct nodes", () => {
  const puzzle = UM.puzzle.createPuzzle(14, 5);
  const nodes = UM.hint.chooseHintNodes(puzzle.start, puzzle.edges, puzzle.solution, 2);
  assert.equal(nodes.length, 2);
  assert.notEqual(nodes[0], nodes[1]);
});

test("the first pick has the best crossing gain of all single moves", () => {
  const puzzle = UM.puzzle.createPuzzle(14, 5);
  const before = cross(puzzle.start, puzzle.edges);
  const gains = puzzle.start.map((_, i) => {
    const w = puzzle.start.map((p) => [p[0], p[1]]);
    w[i] = puzzle.solution[i];
    return before - cross(w, puzzle.edges);
  });
  const pick = UM.hint.chooseHintNodes(puzzle.start, puzzle.edges, puzzle.solution, 1)[0];
  assert.equal(gains[pick], Math.max.apply(null, gains));
});

test("applying hints repeatedly solves the puzzle in at most n steps", () => {
  [[6, 1], [8, 42], [14, 5], [25, 99], [30, 7]].forEach(([n, seed]) => {
    const puzzle = UM.puzzle.createPuzzle(n, seed);
    const pos = puzzle.start.map((p) => [p[0], p[1]]);
    let steps = 0;
    while (cross(pos, puzzle.edges) > 0) {
      const target = UM.hint.alignSolution(puzzle.solution, pos);
      const picked = UM.hint.chooseHintNodes(pos, puzzle.edges, target, 1);
      assert.equal(picked.length, 1, "a hint is always available while crossings remain");
      pos[picked[0]] = target[picked[0]];
      assert.ok(++steps <= n, "n=" + n + " seed=" + seed + " needs more than n hints");
    }
  });
});
