import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, PEERS, ROW, COL, BOX } from "../../js/grid.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { MAX_MISTAKES } from "../../js/config.js";
import {
  newGame, select, enterDigit, toggleNote, hint, remaining, placed, serialize, deserialize,
  cellValue, isLocked, isWrong, isEditable, isBlocked, hasNote, clearCell
} from "../../js/game.js";

const puzzle = generate("beginner", createRng(12));
const fresh = () => newGame(puzzle);
const emptyCells = (s) => s.givens.map((g, i) => (cellValue(s, i) === 0 ? i : -1)).filter((i) => i >= 0);
const wrongDigit = (s, cell) => (s.solution[cell] % 9) + 1;
const bit = (d) => 1 << (d - 1);

test("newGame copies the puzzle into a clean state", () => {
  const s = fresh();
  assert.deepEqual(s.givens, puzzle.givens);
  assert.equal(s.mistakes, 0);
  assert.equal(s.selected, -1);
  assert.equal(s.dialogOpen, false);
  assert.equal(s.solved, false);
  s.givens[0] = 99;
  assert.notEqual(puzzle.givens[0], 99, "state must not alias the puzzle");
});

test("a correct digit locks: no change, no erase, no notes afterwards", () => {
  const s = fresh(), cell = emptyCells(s)[0], d = s.solution[cell];
  assert.equal(enterDigit(s, cell, d), "correct");
  assert.equal(isLocked(s, cell), true);
  assert.equal(isEditable(s, cell), false);
  const other = wrongDigit(s, cell);
  assert.equal(enterDigit(s, cell, other), "ignored");
  assert.equal(s.entries[cell], d);
  assert.equal(toggleNote(s, cell, other), "ignored");
  assert.equal(s.notes[cell], 0);
  assert.equal(s.mistakes, 0);
});

test("givens cannot be changed or annotated", () => {
  const s = fresh(), g = s.givens.findIndex((x) => x);
  assert.equal(enterDigit(s, g, wrongDigit(s, g)), "ignored");
  assert.equal(toggleNote(s, g, 1), "ignored");
  assert.equal(s.mistakes, 0);
});

test("a wrong digit counts once and stays; another wrong digit counts again; the right digit is free", () => {
  const s = fresh(), cell = emptyCells(s)[0];
  const w = wrongDigit(s, cell);
  assert.equal(enterDigit(s, cell, w), "wrong");
  assert.equal(s.mistakes, 1);
  assert.equal(isWrong(s, cell), true);
  assert.equal(isEditable(s, cell), true);
  const w2 = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== w && d !== s.solution[cell]);
  assert.equal(enterDigit(s, cell, w2), "wrong");
  assert.equal(s.mistakes, 2);
  assert.deepEqual(s.wrongOrder, [cell]);
  assert.equal(enterDigit(s, cell, s.solution[cell]), "correct");
  assert.equal(s.mistakes, 2, "the right digit costs nothing");
  assert.equal(isWrong(s, cell), false);
  assert.deepEqual(s.wrongOrder, []);
});

test("the same wrong digit again clears the cell, without a new mistake; clearCell does the same", () => {
  const s = fresh(), [a, b] = emptyCells(s);
  const w = wrongDigit(s, a);
  enterDigit(s, a, w);
  assert.equal(enterDigit(s, a, w), "cleared");
  assert.equal(s.entries[a], 0);
  assert.equal(s.mistakes, 1);
  assert.deepEqual(s.wrongOrder, []);
  // clearCell: explicit clear (Backspace / Delete)
  enterDigit(s, a, w);
  assert.equal(s.mistakes, 2);
  assert.equal(clearCell(s, a), "cleared");
  assert.equal(s.entries[a], 0);
  assert.equal(s.mistakes, 2);
  // only wrong digits can be cleared
  assert.equal(clearCell(s, a), "ignored");                          // empty
  assert.equal(clearCell(s, s.givens.findIndex((g) => g)), "ignored"); // given
  enterDigit(s, b, s.solution[b]);
  assert.equal(clearCell(s, b), "ignored");                          // locked
  assert.equal(clearCell(s, -1), "ignored");
  assert.equal(s.entries[b], s.solution[b]);
});

test("a wrong digit stops the game: nothing else can be entered or annotated until it is fixed or cleared", () => {
  const s = fresh(), [a, b, c] = emptyCells(s);
  enterDigit(s, a, wrongDigit(s, a));
  assert.equal(enterDigit(s, b, s.solution[b]), "blocked");
  assert.equal(enterDigit(s, b, wrongDigit(s, b)), "blocked");
  assert.equal(toggleNote(s, b, 4), "blocked");
  assert.equal(s.entries[b], 0);
  assert.equal(s.notes[b], 0);
  assert.equal(s.mistakes, 1, "a blocked entry is not a mistake");
  assert.equal(isEditable(s, b), false);
  assert.equal(isBlocked(s, b), true);
  assert.equal(isEditable(s, a), true);
  assert.equal(isBlocked(s, a), false);
  // given cells are simply fixed, not blocked
  const g = s.givens.findIndex((x) => x);
  assert.equal(enterDigit(s, g, 1), "ignored");
  // selecting other cells is still possible
  select(s, c);
  assert.equal(s.selected, c);
  // fix it by overwriting with the right digit: the game goes on
  assert.equal(enterDigit(s, a, s.solution[a]), "correct");
  assert.equal(enterDigit(s, b, s.solution[b]), "correct");
  assert.equal(toggleNote(s, c, 4), "on");
});

test("clearing the wrong digit also lets the game go on", () => {
  const s = fresh(), [a, b] = emptyCells(s);
  enterDigit(s, a, wrongDigit(s, a));
  assert.equal(enterDigit(s, b, s.solution[b]), "blocked");
  clearCell(s, a);
  assert.equal(enterDigit(s, b, s.solution[b]), "correct");
  assert.equal(enterDigit(s, a, s.solution[a]), "correct");
});

test("input without a valid cell or digit is ignored", () => {
  const s = fresh(), cell = emptyCells(s)[0];
  for (const [c, d] of [[-1, 1], [null, 1], [undefined, 1], [81, 1], [cell, 0], [cell, 10], [cell, 1.5], [cell, "3"]]) {
    assert.equal(enterDigit(s, c, d), "ignored");
    assert.equal(toggleNote(s, c, d), "ignored");
  }
  assert.equal(s.mistakes, 0);
});

test("notes toggle on and off, only in empty cells", () => {
  const s = fresh(), [a, b] = emptyCells(s);
  assert.equal(toggleNote(s, a, 4), "on");
  assert.equal(hasNote(s, a, 4), true);
  assert.equal(toggleNote(s, a, 7), "on");
  assert.equal(toggleNote(s, a, 4), "off");
  assert.equal(hasNote(s, a, 4), false);
  assert.equal(s.notes[a], bit(7));
  // blocked in a cell with a wrong digit
  enterDigit(s, b, wrongDigit(s, b));
  assert.equal(toggleNote(s, b, 3), "ignored");
  assert.equal(s.notes[b], 0);
});

test("notes: a note may be set although the digit already stands in the row, column or box", () => {
  const s = fresh(), cell = emptyCells(s)[0];
  const peer = PEERS[cell].find((j) => cellValue(s, j) !== 0);
  const d = cellValue(s, peer);
  assert.equal(toggleNote(s, cell, d), "on");
  assert.equal(hasNote(s, cell, d), true);
});

test("entering a digit replaces the notes of the cell, wrong or right", () => {
  const s = fresh(), [a, b] = emptyCells(s);
  toggleNote(s, a, 1); toggleNote(s, a, 2);
  enterDigit(s, a, s.solution[a]);
  assert.equal(s.notes[a], 0);
  toggleNote(s, b, 1); toggleNote(s, b, 2);
  enterDigit(s, b, wrongDigit(s, b));
  assert.equal(s.notes[b], 0);
});

test("a correct digit removes its note from the whole row, column and box, and nothing else", () => {
  const s = fresh(), cell = emptyCells(s)[0], d = s.solution[cell];
  const cells = emptyCells(s).filter((j) => j !== cell);
  const peerCell = cells.find((j) => PEERS[cell].includes(j));
  const farCell = cells.find((j) => !PEERS[cell].includes(j) && j !== cell);
  for (const j of [peerCell, farCell]) { toggleNote(s, j, d); toggleNote(s, j, d === 9 ? 1 : 9); }
  enterDigit(s, cell, d);
  assert.equal(hasNote(s, peerCell, d), false);
  assert.equal(hasNote(s, peerCell, d === 9 ? 1 : 9), true);
  assert.equal(hasNote(s, farCell, d), true);
  // every peer, in every direction
  for (const j of PEERS[cell]) assert.equal(s.notes[j] & bit(d), 0);
});

test("a wrong digit removes no notes anywhere", () => {
  const s = fresh(), cell = emptyCells(s)[0], w = wrongDigit(s, cell);
  const peerCell = emptyCells(s).find((j) => PEERS[cell].includes(j));
  toggleNote(s, peerCell, w);
  enterDigit(s, cell, w);
  assert.equal(hasNote(s, peerCell, w), true);
});

// three different wrong digits in the same cell
function threeMistakes(s, cell) {
  const wrongs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== s.solution[cell]).slice(0, 3);
  return wrongs.map((d) => enterDigit(s, cell, d));
}

test("the third mistake opens the dialog; input is blocked until the hint or a new game", () => {
  const s = fresh(), cells = emptyCells(s);
  assert.deepEqual(threeMistakes(s, cells[0]), ["wrong", "wrong", "gameOver"]);
  assert.equal(s.mistakes, MAX_MISTAKES);
  assert.equal(s.dialogOpen, true);
  assert.equal(enterDigit(s, cells[0], s.solution[cells[0]]), "ignored");
  assert.equal(enterDigit(s, cells[3], s.solution[cells[3]]), "ignored");
  assert.equal(toggleNote(s, cells[3], 1), "ignored");
  assert.equal(clearCell(s, cells[0]), "ignored");
  assert.equal(isEditable(s, cells[3]), false);
});

test("hint after game over: counter 2/3, the wrong digit is emptied, the next wrong digit ends the game again", () => {
  const s = fresh(), cells = emptyCells(s);
  threeMistakes(s, cells[0]);
  const shown = s.entries[cells[0]];
  const r = hint(s);
  assert.deepEqual(r, { kind: "cleared", cell: cells[0], digit: shown, wasGameOver: true });
  assert.equal(s.mistakes, 2);
  assert.equal(s.dialogOpen, false);
  assert.equal(s.entries[cells[0]], 0);
  assert.equal(s.selected, cells[0]);
  assert.deepEqual(s.wrongOrder, []);
  assert.equal(enterDigit(s, cells[0], wrongDigit(s, cells[0])), "gameOver");
  assert.equal(s.dialogOpen, true);
});

test("hint clears the wrong digit whichever cell is selected; it never changes the mistakes in normal play", () => {
  const s = fresh(), cells = emptyCells(s);
  enterDigit(s, cells[0], wrongDigit(s, cells[0]));
  select(s, cells[5]);
  const r = hint(s);
  assert.equal(r.kind, "cleared");
  assert.equal(r.cell, cells[0]);
  assert.equal(r.wasGameOver, false);
  assert.equal(s.mistakes, 1);
  assert.equal(s.selected, cells[0], "the cleared cell is selected afterwards");
});

test("hint without wrong digits reveals the selected empty cell (and locks it)", () => {
  const s = fresh(), cell = emptyCells(s)[3];
  select(s, cell);
  const r = hint(s);
  assert.deepEqual(r, { kind: "revealed", cell, digit: s.solution[cell], wasGameOver: false });
  assert.equal(isLocked(s, cell), true);
  assert.equal(s.mistakes, 0);
  assert.equal(s.selected, cell);
});

test("hint without selection (or with a filled cell selected) fills the next logical cell", () => {
  const s = fresh();
  const r = hint(s);
  assert.equal(r.kind, "revealed");
  assert.equal(r.digit, s.solution[r.cell]);
  const g = s.givens.findIndex((x) => x);
  select(s, g);
  const r2 = hint(s);
  assert.equal(r2.kind, "revealed");
  assert.notEqual(r2.cell, g);
  assert.equal(s.mistakes, 0);
});

test("hint also removes the digit from the notes of its peers", () => {
  const s = fresh(), cell = emptyCells(s)[0], d = s.solution[cell];
  const peerCell = emptyCells(s).find((j) => PEERS[cell].includes(j));
  toggleNote(s, peerCell, d);
  select(s, cell);
  hint(s);
  assert.equal(hasNote(s, peerCell, d), false);
});

test("hint the empty-cell then reveal flow: wrong digit, hint empties it, second hint reveals it", () => {
  const s = fresh(), cell = emptyCells(s)[0];
  enterDigit(s, cell, wrongDigit(s, cell));
  assert.equal(hint(s).kind, "cleared");
  assert.equal(s.selected, cell);
  const r = hint(s);
  assert.equal(r.kind, "revealed");
  assert.equal(r.cell, cell);
  assert.equal(s.entries[cell], s.solution[cell]);
});

test("filling the last cell correctly solves the game; then input and hint are ignored", () => {
  const s = fresh(), cells = emptyCells(s);
  for (let k = 0; k < cells.length - 1; k++) assert.equal(enterDigit(s, cells[k], s.solution[cells[k]]), "correct");
  assert.equal(s.solved, false);
  const last = cells[cells.length - 1];
  assert.equal(enterDigit(s, last, s.solution[last]), "solved");
  assert.equal(s.solved, true);
  assert.equal(hint(s).kind, "ignored");
  assert.equal(enterDigit(s, last, 1), "ignored");
});

test("hint can solve the game", () => {
  const s = fresh();
  for (let n = 0; n < CELLS && !s.solved; n++) hint(s);
  assert.equal(s.solved, true);
  assert.equal(s.mistakes, 0);
});

test("placed / remaining count correctly placed digits only", () => {
  const s = fresh();
  const d = 5;
  const before = placed(s, d);
  const cell = emptyCells(s).find((i) => s.solution[i] === d);
  enterDigit(s, cell, d);
  assert.equal(placed(s, d), before + 1);
  assert.equal(remaining(s, d), 9 - before - 1);
  const other = emptyCells(s).find((i) => s.solution[i] !== d);
  enterDigit(s, other, d); // wrong here
  assert.equal(placed(s, d), before + 1, "a wrong digit does not count");
});

test("serialize / deserialize round trip is identical, including notes, mistakes and the open dialog", () => {
  const s = fresh(), cells = emptyCells(s);
  enterDigit(s, cells[0], s.solution[cells[0]]);
  toggleNote(s, cells[1], 3); toggleNote(s, cells[1], 8);
  select(s, cells[1]);
  threeMistakes(s, cells[2]);
  assert.equal(s.dialogOpen, true);
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
  s.dialogOpen = false; s.mistakes = 1;
  assert.notEqual(deserialize(serialize(s)), null);
});

test("deserialize rejects garbage and inconsistent data", () => {
  const s = fresh(), cells = emptyCells(s);
  enterDigit(s, cells[0], wrongDigit(s, cells[0]));
  const good = JSON.parse(serialize(s));
  assert.notEqual(deserialize(JSON.stringify(good)), null);
  const bad = (mutate) => { const d = JSON.parse(JSON.stringify(good)); mutate(d); return deserialize(JSON.stringify(d)); };
  assert.equal(deserialize("not json"), null);
  assert.equal(deserialize("null"), null);
  assert.equal(deserialize("{}"), null);
  assert.equal(bad((d) => { d.v = 2; }), null);
  assert.equal(bad((d) => { d.givens = d.givens.slice(1); }), null);
  assert.equal(bad((d) => { d.entries[0] = 10; }), null);
  assert.equal(bad((d) => { d.level = "easy"; }), null);
  assert.equal(bad((d) => { d.mistakes = 4; }), null);
  assert.equal(bad((d) => { d.mistakes = -1; }), null);
  assert.equal(bad((d) => { d.selected = 81; }), null);
  assert.equal(bad((d) => { d.dialogOpen = true; }), null, "dialog needs 3 mistakes");
  assert.equal(bad((d) => { d.solved = true; }), null);
  assert.equal(bad((d) => { d.wrongOrder = []; }), null, "wrong digits must be tracked");
  assert.equal(bad((d) => { const g = d.givens.findIndex((x) => x); d.entries[g] = 3; }), null, "entry on a given");
  assert.equal(bad((d) => { const g = d.givens.findIndex((x) => x); d.notes[g] = 1; }), null, "note on a given");
  assert.equal(bad((d) => { d.solution[0] = d.solution[1]; }), null, "solution must be valid");
  assert.equal(bad((d) => { d.notes[cells[0]] = 4; }), null, "note in a cell with a digit");
});

test("property: random legal play never breaks the invariants", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    const s = newGame(generate(["beginner", "expert", "master"][seed % 3], createRng(seed * 7)));
    const everCorrect = new Set();
    for (let step = 0; step < 400; step++) {
      const a = rng.int(10), cell = rng.int(CELLS), digit = 1 + rng.int(9);
      if (a < 4) { if (rng.int(6) === 0) clearCell(s, cell); else enterDigit(s, cell, digit); }
      else if (a < 7) toggleNote(s, cell, digit);
      else if (a < 8) select(s, cell);
      else if (a < 9) { if (rng.int(4) === 0) hint(s); }
      else if (s.dialogOpen && rng.int(2) === 0) hint(s);

      assert.ok(s.mistakes >= 0 && s.mistakes <= MAX_MISTAKES);
      assert.ok(s.wrongOrder.length <= 1, "a wrong digit blocks further entries");
      if (s.dialogOpen) assert.equal(s.mistakes, MAX_MISTAKES);
      for (let i = 0; i < CELLS; i++) {
        if (everCorrect.has(i)) assert.equal(s.entries[i], s.solution[i], "locked cell changed");
        if (s.entries[i] && s.entries[i] === s.solution[i]) everCorrect.add(i);
        if (cellValue(s, i)) assert.equal(s.notes[i], 0, "note in a filled cell");
        assert.ok(s.givens[i] === 0 || s.entries[i] === 0);
      }
      assert.deepEqual([...s.wrongOrder].sort((x, y) => x - y), s.entries.map((e, i) => (isWrong(s, i) ? i : -1)).filter((i) => i >= 0));
      assert.notEqual(deserialize(serialize(s)), null, "state must stay serialisable");
      if (s.solved) break;
    }
  }
});

test("geometry sanity used by the rules: peers share a row, column or box", () => {
  for (const j of PEERS[40]) assert.ok(ROW[j] === 4 || COL[j] === 4 || BOX[j] === 4);
});
