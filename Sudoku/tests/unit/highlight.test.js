import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, ROW, COL, BOX, PEERS } from "../../js/grid.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { newGame, select, enterDigit, cellValue } from "../../js/game.js";
import { highlights } from "../../js/highlight.js";

const puzzle = generate("beginner", createRng(12));
const fresh = () => newGame(puzzle);
const emptyCells = (s) => s.givens.map((g, i) => (cellValue(s, i) === 0 ? i : -1)).filter((i) => i >= 0);
const sorted = (set) => [...set].sort((a, b) => a - b);

test("no selection: nothing selected, no peers, no same", () => {
  const h = highlights(fresh());
  assert.equal(h.sel.size + h.peer.size + h.same.size, 0);
});

test("empty cell: the cell plus its row, column and box - nothing else", () => {
  const s = fresh(), c = emptyCells(s)[0];
  select(s, c);
  const h = highlights(s);
  assert.deepEqual(sorted(h.sel), [c]);
  const expected = [];
  for (let j = 0; j < CELLS; j++) if (j !== c && (ROW[j] === ROW[c] || COL[j] === COL[c] || BOX[j] === BOX[c])) expected.push(j);
  assert.deepEqual(sorted(h.peer), expected);
  assert.equal(h.same.size, 0);
});

test("filled cell: identical digits plus row, column and box", () => {
  const s = fresh(), c = s.givens.findIndex((g) => g);
  select(s, c);
  const h = highlights(s);
  const d = cellValue(s, c);
  const expectedSame = [];
  for (let j = 0; j < CELLS; j++) if (j !== c && cellValue(s, j) === d) expectedSame.push(j);
  assert.ok(expectedSame.length > 0);
  assert.deepEqual(sorted(h.same), expectedSame);
  assert.deepEqual(sorted(h.peer), [...PEERS[c]].sort((a, b) => a - b));
  assert.ok(!h.same.has(c) && !h.peer.has(c));
});

test("a clean board has no conflicts and no wrong cells", () => {
  const h = highlights(fresh());
  assert.equal(h.conflict.size, 0);
  assert.equal(h.wrong.size, 0);
});

test("a wrong digit that duplicates a visible digit marks both cells as conflicts", () => {
  const s = fresh();
  // find an empty cell and a digit that already stands in one of its peers
  const c = emptyCells(s).find((i) => PEERS[i].some((j) => cellValue(s, j) && cellValue(s, j) !== s.solution[i]));
  const peer = PEERS[c].find((j) => cellValue(s, j) && cellValue(s, j) !== s.solution[c]);
  const d = cellValue(s, peer);
  assert.equal(enterDigit(s, c, d), "wrong");
  const h = highlights(s);
  assert.ok(h.conflict.has(c) && h.conflict.has(peer));
  assert.ok(h.wrong.has(c));
  assert.ok(!h.wrong.has(peer));
});

test("a wrong digit that clashes with nothing visible is wrong but not a conflict", () => {
  const s = fresh();
  // a digit that appears in none of the cell's peers, yet differs from the solution
  const c = emptyCells(s).find((i) => {
    const seen = new Set(PEERS[i].map((j) => cellValue(s, j)));
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].some((d) => d !== s.solution[i] && !seen.has(d));
  });
  const seen = new Set(PEERS[c].map((j) => cellValue(s, j)));
  const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => x !== s.solution[c] && !seen.has(x));
  assert.equal(enterDigit(s, c, d), "wrong");
  const h = highlights(s);
  assert.ok(h.wrong.has(c));
  assert.equal(h.conflict.size, 0);
});

test("selecting a wrong digit highlights the other cells with the same digit", () => {
  const s = fresh(), c = emptyCells(s)[0];
  const d = (s.solution[c] % 9) + 1;
  enterDigit(s, c, d);
  select(s, c);
  const h = highlights(s);
  for (const j of h.same) assert.equal(cellValue(s, j), d);
  assert.ok(h.sel.has(c));
});
