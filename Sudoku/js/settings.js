// Colour scheme and level, remembered in localStorage (PRD 3.7). Invalid or
// missing values fall back to the defaults; storage errors never throw.
import { LEVELS, DEFAULT_LEVEL, DEFAULT_SCHEME } from "./config.js";
import { SCHEMES } from "./schemes.js";
import { safeGet, safeSet } from "./storage.js";

export const SCHEME_KEY = "sudoku.scheme";
export const LEVEL_KEY = "sudoku.level";

export function loadSettings() {
  const scheme = safeGet(SCHEME_KEY), level = safeGet(LEVEL_KEY);
  return {
    scheme: SCHEMES.some((s) => s.id === scheme) ? scheme : DEFAULT_SCHEME,
    level: LEVELS.includes(level) ? level : DEFAULT_LEVEL
  };
}

export const saveScheme = (id) => { if (SCHEMES.some((s) => s.id === id)) safeSet(SCHEME_KEY, id); };
export const saveLevel = (level) => { if (LEVELS.includes(level)) safeSet(LEVEL_KEY, level); };
