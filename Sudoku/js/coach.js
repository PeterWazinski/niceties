// Coach engine (PRD 3.4.1), pure: from a board it builds the chain of steps up to
// the next placement (easiest technique first), drops the steps that the placement
// does not need, and turns every step into a short explanation (texts in i18n.js).
import { ROW, COL, BOX, UNITS } from "./grid.js";
import { candidates, nextStep, applyStep, validStep, techniqueLevel } from "./techniques.js";
import { COACH_MAX_STEPS } from "./config.js";
import { t, DEFAULT_LANG } from "./i18n.js";

const bit = (d) => 1 << (d - 1);

// Technique names (English; per language in i18n.js).
export const TECHNIQUE_TITLES = Object.fromEntries(
  ["nakedSingle", "hiddenSingle", "pointing", "claiming", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "xWing", "xyWing", "swordfish"]
    .map((k) => [k, t(DEFAULT_LANG, "tech." + k)])
);

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
// The words come from i18n.js (PRD 3.8); this part only decides what is named, in
// which order (the order decides long vs. short cell names).

// Names cells for one coaching session: first mention "row 4, column 6", then "r4c6"
// (German: "Reihe 4, Spalte 6", then "r4s6").
export function cellNamer(lang = DEFAULT_LANG) {
  const seen = new Set();
  return (i) => {
    const r = ROW[i] + 1, c = COL[i] + 1;
    if (seen.has(i)) return t(lang, "coach.cellShort", { r, c });
    seen.add(i);
    return t(lang, "coach.cellLong", { r, c });
  };
}

// { title, level, text } for a decorated step; `name` is the session's cellNamer.
// afterEliminations: earlier steps of the chain removed candidates (changes the
// wording of a naked single).
export function explain(step, name = cellNamer(), { afterEliminations = false, lang = DEFAULT_LANG } = {}) {
  const tr = (key, values) => t(lang, key, values);
  const title = tr("tech." + step.technique);
  const level = tr("level." + (step.level || techniqueLevel(step.technique)));
  const unit = (u) => tr("coach.unit", { u });
  const list = (items) => tr("coach.list", { items });
  const d = step.digit;
  let text;
  switch (step.technique) {
    case "nakedSingle":
      text = tr(afterEliminations ? "coach.t.nakedSingleAfter" : "coach.t.nakedSingle", { cell: name(step.cell), d });
      break;
    case "hiddenSingle":
      text = tr("coach.t.hiddenSingle", { unit: unit(step.unit), d, cell: name(step.cell) });
      break;
    case "pointing":
      text = tr("coach.t.pointing", { box: unit(step.box), line: unit(step.line), d });
      break;
    case "claiming":
      text = tr("coach.t.claiming", { line: unit(step.line), box: unit(step.box), d });
      break;
    case "nakedPair": case "nakedTriple":
      text = tr("coach.t.nakedSubset", {
        cells: list(step.cells.map(name)), digits: list(step.digits.map(String)), unit: unit(step.unit), triple: step.cells.length > 2
      });
      break;
    case "hiddenPair": case "hiddenTriple":
      text = tr("coach.t.hiddenSubset", { unit: unit(step.unit), digits: list(step.digits.map(String)), cells: list(step.cells.map(name)) });
      break;
    case "xWing": case "swordfish":
      text = tr("coach.t.fish", { base: tr("coach.lines", { units: step.base }), cover: tr("coach.lines", { units: step.cover }), d });
      break;
    case "xyWing": {
      const p = step.pivot, [a, b] = step.pincers;
      const [p1, p2] = digitsOf(step.shown[p]);
      const x = digitsOf(step.shown[a]).find((v) => v !== d), y = digitsOf(step.shown[b]).find((v) => v !== d);
      // mention order: pivot, both pincers, both pincers again (short)
      const P = name(p), A = name(a), B = name(b), A2 = name(a), B2 = name(b);
      text = tr("coach.t.xyWing", { P, x, y, A, B, A2, B2, p1, p2, d });
      break;
    }
    default:
      text = "";
  }
  return { title, level, text: cap(text) };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function digitsOf(m) { const r = []; for (let v = 1; v <= 9; v++) if (m & bit(v)) r.push(v); return r; }
