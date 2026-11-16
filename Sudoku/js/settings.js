// Colour scheme, level and language, remembered in localStorage (PRD 3.7, 3.8).
// Invalid or missing values fall back to the defaults; storage errors never throw.
import { LEVELS, DEFAULT_LEVEL, DEFAULT_SCHEME } from "./config.js";
import { SCHEMES } from "./schemes.js";
import { safeGet, safeSet } from "./storage.js";
import { isLang } from "./i18n.js";

export const SCHEME_KEY = "sudoku.scheme";
export const LEVEL_KEY = "sudoku.level";
export const LANG_KEY = "sudoku.lang";

// Schemes that were replaced: a saved old id moves to its successor.
const RENAMED_SCHEMES = { neon: "starwars" };

export function loadSettings() {
  const saved = safeGet(SCHEME_KEY), level = safeGet(LEVEL_KEY);
  const scheme = RENAMED_SCHEMES[saved] || saved;
  return {
    scheme: SCHEMES.some((s) => s.id === scheme) ? scheme : DEFAULT_SCHEME,
    level: LEVELS.includes(level) ? level : DEFAULT_LEVEL
  };
}

export const saveScheme = (id) => { if (SCHEMES.some((s) => s.id === id)) safeSet(SCHEME_KEY, id); };
export const saveLevel = (level) => { if (LEVELS.includes(level)) safeSet(LEVEL_KEY, level); };

// The saved language, or `fallback` (the device language) when none or an invalid one is saved.
export function loadLang(fallback) {
  const lang = safeGet(LANG_KEY);
  return isLang(lang) ? lang : fallback;
}
export const saveLang = (lang) => { if (isLang(lang)) safeSet(LANG_KEY, lang); };
