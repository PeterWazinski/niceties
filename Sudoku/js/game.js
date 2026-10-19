// Game model (PRD 3.2 - 3.4): pure state and rules, no DOM. The state is a plain
// JSON-able object that is changed in place by the functions below.
//
//   givens[81]    the clues (0 = not a clue)
//   solution[81]  the unique solution
//   entries[81]   digits entered by the player (0 = empty); a digit equal to the
//                 solution is "locked", any other digit is "wrong": it must be changed
//                 or cleared before anything else can be entered
//   notes[81]     pencil notes as 9-bit masks (bit d-1 = digit d), only in empty cells
//   mistakes      wrong digits entered so far (never refunded)
//   wrongOrder    cells that currently hold a wrong digit (at most one in a normal game)
//   selected      selected cell or -1
//   dialogOpen    the three-mistakes dialog is showing (game paused)
//   solved        every cell is correct
import { CELLS, PEERS, UNITS } from "./grid.js";
import { MAX_MISTAKES, LEVELS } from "./config.js";
import { candidates, nextStep, applyStep } from "./techniques.js";

const bit = (d) => 1 << (d - 1);

export function newGame(puzzle) {
  return {
    givens: puzzle.givens.slice(),
    solution: puzzle.solution.slice(),
    entries: new Array(CELLS).fill(0),
    notes: new Array(CELLS).fill(0),
    mistakes: 0,
    wrongOrder: [],
    level: puzzle.level,
    selected: -1,
    dialogOpen: false,
    solved: false
  };
}

// ---- queries ------------------------------------------------------------------

export const cellValue = (s, i) => s.givens[i] || s.entries[i];
export const isGiven = (s, i) => s.givens[i] !== 0;
export const isWrong = (s, i) => s.entries[i] !== 0 && s.entries[i] !== s.solution[i];
// Given or correctly entered: can never be changed or annotated.
export const isLocked = (s, i) => isGiven(s, i) || (s.entries[i] !== 0 && s.entries[i] === s.solution[i]);
// A wrong digit on the board stops the game: nothing else can be entered until it is fixed.
export const hasWrong = (s) => s.wrongOrder.length > 0;
// The cell may take input: it is not locked, the game is not paused or over, and if a wrong
// digit is on the board, this cell is that wrong cell.
export const isEditable = (s, i) => !s.dialogOpen && !s.solved && !isLocked(s, i) && (!hasWrong(s) || isWrong(s, i));
// An empty cell that would take input if it were not for a wrong digit elsewhere.
export const isBlocked = (s, i) => !s.dialogOpen && !s.solved && !isLocked(s, i) && hasWrong(s) && !isWrong(s, i);
export const hasNote = (s, i, d) => (s.notes[i] & bit(d)) !== 0;

// How many copies of a digit are correctly placed (givens + locked entries).
export function placed(s, digit) {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (isLocked(s, i) && cellValue(s, i) === digit) n++;
  return n;
}
export const remaining = (s, digit) => 9 - placed(s, digit);

const allCorrect = (s) => {
  for (let i = 0; i < CELLS; i++) if (cellValue(s, i) !== s.solution[i]) return false;
  return true;
};

// ---- actions ------------------------------------------------------------------

export function select(s, cell) {
  if (Number.isInteger(cell) && cell >= 0 && cell < CELLS) s.selected = cell;
}

function dropWrong(s, cell) {
  const k = s.wrongOrder.indexOf(cell);
  if (k >= 0) s.wrongOrder.splice(k, 1);
}

// A digit became correct in `cell`: it is locked, the cell loses its notes and the
// digit disappears from the notes of its row, column and box.
function lock(s, cell, digit) {
  dropWrong(s, cell);
  s.entries[cell] = digit;
  s.notes[cell] = 0;
  for (const j of PEERS[cell]) s.notes[j] &= ~bit(digit);
  if (allCorrect(s)) s.solved = true;
}

// Empties a cell that holds a wrong digit (no mistake is counted). Returns "cleared" | "ignored".
export function clearCell(s, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return "ignored";
  if (s.dialogOpen || s.solved || !isWrong(s, cell)) return "ignored";
  s.entries[cell] = 0;
  dropWrong(s, cell);
  return "cleared";
}

// Enters a digit in a cell. Returns "ignored" | "blocked" (a wrong digit elsewhere must be fixed
// first) | "cleared" (the same wrong digit again takes it back out) | "correct" | "wrong" |
// "gameOver" | "solved".
export function enterDigit(s, cell, digit) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return "ignored";
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return "ignored";
  if (isBlocked(s, cell)) return "blocked";
  if (!isEditable(s, cell)) return "ignored";
  if (s.entries[cell] === digit) return clearCell(s, cell); // tapping the wrong digit again clears it
  if (digit === s.solution[cell]) {
    lock(s, cell, digit);
    return s.solved ? "solved" : "correct";
  }
  s.entries[cell] = digit;
  s.notes[cell] = 0;
  dropWrong(s, cell);
  s.wrongOrder.push(cell);
  s.mistakes++;
  if (s.mistakes >= MAX_MISTAKES) { s.dialogOpen = true; return "gameOver"; }
  return "wrong";
}

// Toggles a pencil note in an empty cell. Returns "on" | "off" | "blocked" | "ignored".
// There is no validation against the neighbours: a note may be set even if the
// digit already stands in the row, column or box.
export function toggleNote(s, cell, digit) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return "ignored";
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return "ignored";
  if (s.dialogOpen || s.solved || cellValue(s, cell) !== 0) return "ignored";
  if (hasWrong(s)) return "blocked";
  s.notes[cell] ^= bit(digit);
  return hasNote(s, cell, digit) ? "on" : "off";
}

// The cell the human-technique solver would fill next, or -1.
function logicalCell(s) {
  const grid = s.givens.map((g, i) => (isLocked(s, i) ? cellValue(s, i) : 0));
  const cand = candidates(grid);
  for (let n = 0; n < 1000; n++) {
    const step = nextStep(grid, cand);
    if (!step) return -1;
    if (step.eliminations) { applyStep(grid, cand, step); continue; }
    return step.cell;
  }
  return -1;
}

// Hint (PRD 3.4). Returns { kind: "cleared" | "revealed" | "ignored", cell, digit, wasGameOver }.
//  - a wrong digit on the board: it is emptied (the selected one first, else the most recent)
//    - there is normally only one, because a wrong digit blocks all other input
//  - otherwise the selected empty cell, or the next logical cell, gets its correct digit
// After the three-mistakes dialog the counter goes back to MAX_MISTAKES - 1.
export function hint(s) {
  if (s.solved) return { kind: "ignored", cell: -1, digit: 0, wasGameOver: false };
  const wasGameOver = s.dialogOpen;
  if (wasGameOver) { s.dialogOpen = false; s.mistakes = MAX_MISTAKES - 1; }

  if (s.wrongOrder.length) {
    const cell = s.wrongOrder.includes(s.selected) ? s.selected : s.wrongOrder[s.wrongOrder.length - 1];
    const digit = s.entries[cell];
    s.entries[cell] = 0;
    dropWrong(s, cell);
    s.selected = cell;
    return { kind: "cleared", cell, digit, wasGameOver };
  }

  let cell = s.selected >= 0 && cellValue(s, s.selected) === 0 ? s.selected : logicalCell(s);
  if (cell < 0) cell = s.solution.findIndex((_, i) => cellValue(s, i) === 0);
  if (cell < 0) return { kind: "ignored", cell: -1, digit: 0, wasGameOver };
  const digit = s.solution[cell];
  lock(s, cell, digit);
  s.selected = cell;
  return { kind: "revealed", cell, digit, wasGameOver };
}

// ---- save / restore -------------------------------------------------------------

const isIntArray = (a, lo, hi) => Array.isArray(a) && a.length === CELLS &&
  a.every((d) => Number.isInteger(d) && d >= lo && d <= hi);

export function serialize(s) {
  return JSON.stringify({ v: 1, ...s });
}

// Parses and validates saved data; returns a state or null for anything malformed or inconsistent.
export function deserialize(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  if (!d || typeof d !== "object" || d.v !== 1) return null;
  if (!isIntArray(d.givens, 0, 9) || !isIntArray(d.solution, 1, 9)) return null;
  if (!isIntArray(d.entries, 0, 9) || !isIntArray(d.notes, 0, 0x1ff)) return null;
  if (!UNITS.every((u) => new Set(u.map((i) => d.solution[i])).size === 9)) return null;
  if (!d.givens.every((g, i) => g === 0 || g === d.solution[i])) return null;
  if (!LEVELS.includes(d.level)) return null;
  if (!Number.isInteger(d.mistakes) || d.mistakes < 0 || d.mistakes > MAX_MISTAKES) return null;
  if (!Number.isInteger(d.selected) || d.selected < -1 || d.selected >= CELLS) return null;
  if (typeof d.dialogOpen !== "boolean" || typeof d.solved !== "boolean") return null;
  for (let i = 0; i < CELLS; i++) {
    if (d.givens[i] && d.entries[i]) return null;               // entries only in non-given cells
    if ((d.givens[i] || d.entries[i]) && d.notes[i]) return null; // notes only in empty cells
  }
  const state = {
    givens: d.givens, solution: d.solution, entries: d.entries, notes: d.notes,
    mistakes: d.mistakes, wrongOrder: d.wrongOrder, level: d.level,
    selected: d.selected, dialogOpen: d.dialogOpen, solved: d.solved
  };
  const wrong = [];
  for (let i = 0; i < CELLS; i++) if (isWrong(state, i)) wrong.push(i);
  const order = state.wrongOrder;
  if (!Array.isArray(order) || order.length !== wrong.length || !order.every((c) => wrong.includes(c)) ||
      new Set(order).size !== order.length) return null;
  if (state.dialogOpen && state.mistakes !== MAX_MISTAKES) return null;
  if (state.solved !== allCorrect(state)) return null;
  if (state.solved && state.dialogOpen) return null;
  return state;
}
