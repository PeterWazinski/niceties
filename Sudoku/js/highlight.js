// Which cells to highlight for the current selection (PRD 3.3). Pure; the view
// maps each set to a CSS class.
import { CELLS, PEERS, UNITS } from "./grid.js";
import { cellValue, isWrong } from "./game.js";

// Returns Sets of cell indices:
//   sel       the selected cell
//   peer      its row, column and box (without the cell itself)
//   same      every other cell showing the same digit (only if the selected cell has one)
//   conflict  cells whose digit appears twice in a row, column or box (visible rule breaks)
//   wrong     cells holding a digit that is not part of the solution (conflicting or not)
export function highlights(state) {
  const sel = new Set(), peer = new Set(), same = new Set(), conflict = new Set(), wrong = new Set();

  const s = state.selected;
  if (s >= 0) {
    sel.add(s);
    for (const j of PEERS[s]) peer.add(j);
    const v = cellValue(state, s);
    if (v) for (let j = 0; j < CELLS; j++) if (j !== s && cellValue(state, j) === v) same.add(j);
  }

  for (const unit of UNITS) {
    const seen = new Map(); // digit -> cells in this unit
    for (const i of unit) {
      const v = cellValue(state, i);
      if (!v) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push(i);
    }
    for (const cells of seen.values()) if (cells.length > 1) cells.forEach((i) => conflict.add(i));
  }

  for (let i = 0; i < CELLS; i++) if (isWrong(state, i)) wrong.add(i);
  return { sel, peer, same, conflict, wrong };
}
