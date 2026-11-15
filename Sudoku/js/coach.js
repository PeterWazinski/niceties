// Coach engine (PRD 3.4.1), pure: from a board it builds the chain of steps up to
// the next placement (easiest technique first), drops the steps that the placement
// does not need, and turns every step into a short English explanation.
import { ROW, COL, BOX, UNITS } from "./grid.js";
import { candidates, nextStep, applyStep, validStep, techniqueLevel } from "./techniques.js";
import { COACH_MAX_STEPS } from "./config.js";

const bit = (d) => 1 << (d - 1);

export const TECHNIQUE_TITLES = {
  nakedSingle: "Naked Single", hiddenSingle: "Hidden Single", pointing: "Pointing", claiming: "Claiming",
  nakedPair: "Naked Pair", hiddenPair: "Hidden Pair", nakedTriple: "Naked Triple", hiddenTriple: "Hidden Triple",
  xWing: "X-Wing", xyWing: "XY-Wing", swordfish: "Swordfish"
};
const LEVEL_TITLES = { beginner: "Beginner", expert: "Expert", master: "Master" };

// ---- chain ----------------------------------------------------------------------

// The naked or hidden single that places `digit` into `cell` in this state, or null.
function singleFor(grid, cand, cell, digit) {
  if (grid[cell] || !(cand[cell] & bit(digit))) return null;
  if (cand[cell] === bit(digit)) return { technique: "nakedSingle", cell, digit };
  for (const u of [ROW[cell], 9 + COL[cell], 18 + BOX[cell]]) {
    if (UNITS[u].every((i) => i === cell || !(cand[i] & bit(digit)))) return { technique: "hiddenSingle", cell, digit, unit: u };
  }
  return null;
}

// Replays elimination steps from the board; returns the final single for the
// placement, or null if a step no longer holds or the placement is not forced.
function replay(grid, eliminations, placement) {
  const cand = candidates(grid);
  for (const step of eliminations) {
    if (!validStep(grid, cand, step)) return null;
    applyStep(grid, cand, step);
  }
  return singleFor(grid, cand, placement.cell, placement.digit);
}

// Drops elimination steps the placement does not need (last first, greedy).
function prune(grid, eliminations, placement) {
  let kept = eliminations.slice();
  for (let k = kept.length - 1; k >= 0; k--) {
    const without = kept.slice(0, k).concat(kept.slice(k + 1));
    if (replay(grid, without, placement)) kept = without;
  }
  return kept;
}

// Cells a step is about and what to show in them, taken in the state before the step.
function decorate(step, cand) {
  const placing = !step.eliminations;
  const keyCells = placing ? [step.cell] : step.cells;
  const removed = placing ? [] : step.eliminations.filter((e) => cand[e.cell] & bit(e.digit));
  const cells = [...new Set([...keyCells, ...removed.map((e) => e.cell)])];
  const shown = {};
  for (const i of cells) shown[i] = cand[i];
  let keyDigits;
  if (placing) keyDigits = () => [step.digit];
  else if (step.digits) keyDigits = (i) => step.digits.filter((d) => cand[i] & bit(d));
  else if (step.technique === "xyWing") keyDigits = (i) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => cand[i] & bit(d));
  else keyDigits = () => [step.digit];
  const key = keyCells.flatMap((i) => keyDigits(i).map((digit) => ({ cell: i, digit })));
  let units = [];
  if (step.technique === "nakedSingle") units = [ROW[step.cell], 9 + COL[step.cell], 18 + BOX[step.cell]];
  else if (step.technique === "hiddenSingle" || step.digits) units = [step.unit];
  else if (step.technique === "pointing" || step.technique === "claiming") units = [step.box, step.line];
  else if (step.base) units = [...step.base, ...step.cover];
  return {
    ...step,
    level: techniqueLevel(step.technique),
    keyCells,
    units,
    shown,     // { cell: candidate mask } for the involved cells only
    removed,   // candidates this step takes away
    key        // deciding candidates
  };
}

// grid = givens + correct digits (0 = empty; wrong digits must be left out).
// Returns { steps, placement }: steps ends with the placing single; placement is
// { cell, digit } or null when no technique of the catalogue makes progress.
export function coachChain(grid, { prune: doPrune = true } = {}) {
  const g = grid.slice();
  const cand = candidates(g);
  const raw = [];
  let placement = null;
  for (let n = 0; n < COACH_MAX_STEPS; n++) {
    const step = nextStep(g, cand);
    if (!step) break;
    if (!step.eliminations) { placement = { cell: step.cell, digit: step.digit }; raw.push(step); break; }
    raw.push(step);
    applyStep(g, cand, step);
  }
  if (!placement) return { steps: [], placement: null };
  let eliminations = raw.slice(0, -1);
  let final = raw[raw.length - 1];
  if (doPrune && eliminations.length) {
    eliminations = prune(grid, eliminations, placement);
    final = replay(grid.slice(), eliminations, placement);
  }
  // decorate in the replayed states
  const rg = grid.slice();
  const rc = candidates(rg);
  const steps = [];
  for (const step of eliminations) {
    steps.push(decorate(step, rc));
    applyStep(rg, rc, step);
  }
  steps.push(decorate(final, rc));
  return { steps, placement };
}

// ---- texts ----------------------------------------------------------------------

const unitName = (u) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
const list = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
// "rows 2 and 7", "columns 1, 4 and 8"
const linesName = (us) => (us[0] < 9 ? "rows " : "columns ") + list(us.map((u) => String(u < 9 ? u + 1 : u - 8)));

// Names cells for one coaching session: first mention "row 4, column 6", then "r4c6".
export function cellNamer() {
  const seen = new Set();
  return (i) => {
    const r = ROW[i] + 1, c = COL[i] + 1;
    if (seen.has(i)) return `r${r}c${c}`;
    seen.add(i);
    return `row ${r}, column ${c}`;
  };
}

// { title, level, text } for a decorated step; `name` is the session's cellNamer.
// afterEliminations: earlier steps of the chain removed candidates (changes the
// wording of a naked single).
export function explain(step, name = cellNamer(), { afterEliminations = false } = {}) {
  const title = TECHNIQUE_TITLES[step.technique];
  const level = LEVEL_TITLES[step.level || techniqueLevel(step.technique)];
  const d = step.digit;
  let text;
  switch (step.technique) {
    case "nakedSingle":
      text = afterEliminations
        ? `${cap(name(step.cell))} can only be ${d}: all other candidates are gone.`
        : `${cap(name(step.cell))} can only be ${d}: every other digit already stands in its row, column or box.`;
      break;
    case "hiddenSingle":
      text = `In ${unitName(step.unit)}, the ${d} fits only into ${name(step.cell)}.`;
      break;
    case "pointing":
      text = `In ${unitName(step.box)}, the ${d} can only be in ${unitName(step.line)}. So the ${d} is removed from the rest of ${unitName(step.line)}.`;
      break;
    case "claiming":
      text = `In ${unitName(step.line)}, the ${d} can only be in ${unitName(step.box)}. So the ${d} is removed from the rest of ${unitName(step.box)}.`;
      break;
    case "nakedPair": case "nakedTriple": {
      const ds = list(step.digits.map(String));
      const between = step.cells.length > 2 ? " between them" : "";
      text = `${cap(list(step.cells.map(name)))} can only hold ${ds}${between}. So ${ds} are removed from the other cells of ${unitName(step.unit)}.`;
      break;
    }
    case "hiddenPair": case "hiddenTriple":
      text = `In ${unitName(step.unit)}, ${list(step.digits.map(String))} fit only into ${list(step.cells.map(name))}. So all other candidates are removed from these cells.`;
      break;
    case "xWing": case "swordfish": {
      const base = linesName(step.base), cover = linesName(step.cover);
      text = `In ${base}, the ${d} fits only into ${cover}. So in ${cover} the ${d} must be in ${base}, and it is removed from the rest of ${cover}.`;
      break;
    }
    case "xyWing": {
      const p = step.pivot, [a, b] = step.pincers;
      const pd = digitsOf(step.shown[p]);
      const x = digitsOf(step.shown[a]).find((v) => v !== d), y = digitsOf(step.shown[b]).find((v) => v !== d);
      const P = name(p), A = name(a), B = name(b);
      text = `${cap(P)} can only be ${pd[0]} or ${pd[1]}. If it is ${x}, ${A} must be ${d}; if it is ${y}, ${B} must be ${d}. ` +
        `Either way one of ${name(a)} and ${name(b)} is ${d}, so the ${d} is removed from every cell that sees both.`;
      break;
    }
    default:
      text = "";
  }
  return { title, level, text };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function digitsOf(m) { const r = []; for (let v = 1; v <= 9; v++) if (m & bit(v)) r.push(v); return r; }
