import test from "node:test";
import assert from "node:assert/strict";
import { createPuzzle } from "../../js/puzzle.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/penrose.js";

const types = generate("wheel", 3).tiles.map((t) => t.type);
const idOfType = (ty, skip = 0) => types.findIndex((x, i) => x === ty && types.slice(0, i).filter((y) => y === ty).length === skip);
const isPerm = (p) => [...p].sort((a, b) => a - b).every((v, i) => v === i);

// shortest sequence of swaps (BFS over all same-type swaps), for small puzzles
function bfsMinimum(typeList, perm) {
  const n = typeList.length;
  const goal = perm.map((_, i) => i).join(",");
  const seen = new Set([perm.join(",")]);
  let frontier = [perm.slice()], steps = 0;
  while (frontier.length) {
    if (frontier.some((p) => p.join(",") === goal)) return steps;
    const next = [];
    for (const p of frontier) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (typeList[a] !== typeList[b]) continue;
        const q = p.slice(); [q[a], q[b]] = [q[b], q[a]];
        const key = q.join(",");
        if (!seen.has(key)) { seen.add(key); next.push(q); }
      }
    }
    frontier = next; steps++;
  }
  return -1;
}

test("a new puzzle is sorted", () => {
  const p = createPuzzle(types);
  assert.deepEqual(p.perm, types.map((_, i) => i));
  assert.equal(p.minimumSwaps(), 0);
  assert.equal(p.moves, 0);
});

test("only tiles of the same type swap; the colours move, the shapes stay", () => {
  const p = createPuzzle(types);
  const a = idOfType("thick", 0), b = idOfType("thick", 1), c = idOfType("thin", 0);
  assert.equal(p.swap(a, c), "refused");
  assert.equal(p.moves, 0);
  assert.equal(p.swap(a, a), "same");
  assert.equal(p.swap(-1, a), "same");
  assert.equal(p.swap(a, 9999), "same");
  assert.equal(p.swap(a, b), "ok");
  assert.equal(p.perm[a], b);
  assert.equal(p.perm[b], a);
  assert.equal(p.moves, 1);
  assert.equal(p.minimumSwaps(), 1);
});

test("undo takes the last swap back; reset sorts", () => {
  const p = createPuzzle(types);
  const a = idOfType("thin", 0), b = idOfType("thin", 1), c = idOfType("thin", 2);
  assert.equal(p.undo(), false);
  p.swap(a, b); p.swap(b, c);
  assert.equal(p.moves, 2);
  assert.equal(p.undo(), true);
  assert.equal(p.moves, 1);
  assert.equal(p.perm[a], b);
  assert.equal(p.perm[c], c);
  p.undo();
  assert.deepEqual(p.perm, types.map((_, i) => i));
  p.swap(a, b); p.swap(b, c);
  p.reset();
  assert.deepEqual(p.perm, types.map((_, i) => i));
  assert.equal(p.moves, 0);
});

test("minimum swaps = tiles - cycles: a swap, a 3-cycle, two swaps", () => {
  const t = ["thick", "thick", "thick", "thick", "thick", "thick"];
  const p = createPuzzle(t);
  p.swap(0, 1);
  assert.equal(p.minimumSwaps(), 1);
  p.swap(1, 2); // 3-cycle
  assert.equal(p.minimumSwaps(), 2);
  p.swap(3, 4);
  assert.equal(p.minimumSwaps(), 3);
  p.undo(); p.undo(); p.undo();
  assert.equal(p.minimumSwaps(), 0);
});

test("minimum swaps equals the shortest solution found by brute force", () => {
  const typeList = ["thick", "thin", "thick", "thick", "thin", "thick", "thin"];
  const rng = createRng(11);
  for (let trial = 0; trial < 12; trial++) {
    const p = createPuzzle(typeList);
    p.shuffleFull(rng);
    assert.equal(bfsMinimum(typeList, p.perm), p.minimumSwaps(), "perm " + p.perm.join(","));
  }
});

test("a full shuffle is reproducible and permutes inside each type", () => {
  const a = createPuzzle(types), b = createPuzzle(types), c = createPuzzle(types);
  a.shuffleFull(createRng(5)); b.shuffleFull(createRng(5)); c.shuffleFull(createRng(6));
  assert.deepEqual(a.perm, b.perm);
  assert.notDeepEqual(a.perm, c.perm);
  assert.ok(isPerm(a.perm));
  a.perm.forEach((v, i) => assert.equal(types[v], types[i], "a colour never changes type"));
  assert.ok(a.minimumSwaps() > types.length / 2, "a full shuffle needs many swaps");
});

test("a shuffle to k swaps needs exactly k minimum swaps", () => {
  const p = createPuzzle(types);
  for (const k of [0, 1, 2, 10, 30, 57]) {
    const got = p.shuffleSwaps(createRng(k + 1), k);
    assert.equal(got, k);
    assert.equal(p.minimumSwaps(), k, `k = ${k}`);
    assert.ok(isPerm(p.perm));
    p.perm.forEach((v, i) => assert.equal(types[v], types[i]));
    assert.equal(p.moves, 0, "a shuffle is not a move");
  }
  const x = createPuzzle(types), y = createPuzzle(types);
  x.shuffleSwaps(createRng(3), 25); y.shuffleSwaps(createRng(3), 25);
  assert.deepEqual(x.perm, y.perm);
});

test("a shuffle to more swaps than possible stops at the capacity", () => {
  const p = createPuzzle(types);
  const cap = p.capacity();
  assert.equal(cap, types.length - 2); // two types
  assert.equal(p.shuffleSwaps(createRng(1), 10000), cap);
  assert.equal(p.minimumSwaps(), cap);
  assert.equal(createPuzzle(["thick"]).capacity(), 0);
});

test("solving along the cycles reaches the sorted state in exactly the minimum number of swaps", () => {
  const p = createPuzzle(types);
  const colours = types.map((_, i) => "#" + i.toString(16).padStart(6, "0"));
  p.shuffleSwaps(createRng(9), 40);
  assert.equal(p.solved(colours), false);
  const start = p.minimumSwaps();
  let made = 0;
  for (let i = 0; i < types.length; i++) {
    while (p.perm[i] !== i) { // put the colour that belongs to tile i there
      const j = p.perm.indexOf(i);
      assert.equal(p.swap(i, j), "ok");
      made++;
    }
  }
  assert.equal(made, start);
  assert.equal(p.solved(colours), true);
  assert.equal(p.minimumSwaps(), 0);
});

test("solved compares colours: tiles with the same colour are interchangeable", () => {
  const t = ["thick", "thick", "thick"];
  const p = createPuzzle(t);
  const colours = ["#aa0000", "#00aa00", "#aa0000"];
  p.swap(0, 2);
  assert.equal(p.solved(colours), true);
  p.swap(0, 1);
  assert.equal(p.solved(colours), false);
});

test("anchored tiles never move: swaps are refused and shuffles leave them alone", () => {
  const anchored = [0, 5, 6, 20];
  const p = createPuzzle(types, anchored);
  assert.equal(p.isAnchored(5), true);
  assert.equal(p.isAnchored(7), false);
  const other = types.findIndex((ty, i) => ty === types[0] && !anchored.includes(i));
  assert.equal(p.swap(0, other), "anchored");
  assert.equal(p.swap(other, 5), "anchored");
  for (const how of ["full", "swaps"]) {
    if (how === "full") p.shuffleFull(createRng(4)); else p.shuffleSwaps(createRng(4), 20);
    for (const a of anchored) assert.equal(p.perm[a], a, `${how}: tile ${a}`);
    assert.ok(isPerm(p.perm));
  }
  assert.equal(p.capacity(), types.length - 4 - 2);
});
