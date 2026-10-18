// Saves the complete game state after every move and restores it on load (PRD 3.7).
import { serialize, deserialize } from "./game.js";
import { safeGet, safeSet, safeRemove } from "./storage.js";

export const GAME_KEY = "sudoku.game";

export function saveGame(state) { safeSet(GAME_KEY, serialize(state)); }
export function clearGame() { safeRemove(GAME_KEY); }

// The saved game, or null if there is none or the data is invalid or finished.
export function loadGame() {
  const text = safeGet(GAME_KEY);
  if (text === null) return null;
  const state = deserialize(text);
  if (!state || state.solved) { clearGame(); return null; }
  return state;
}
