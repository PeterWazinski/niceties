// Texts of the app per language (PRD 3.8), pure: no DOM, no state. Every visible and
// screen-reader text lives here, so a language is one table. A value is a string or a
// function of named values; t() picks the table and falls back to English.

export const LANGS = ["en", "de"];
export const DEFAULT_LANG = "en";
export const isLang = (x) => LANGS.includes(x);

// Device language → app language: "de", "de-DE", "de-AT" … → German, anything else English.
export function detectLang(languages) {
  const first = (languages || []).find((l) => typeof l === "string" && l);
  return first && first.toLowerCase().startsWith("de") ? "de" : "en";
}

// "a", "a and b", "a, b and c" (`and` per language)
const joinWith = (and) => (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + ` ${and} ` + xs[xs.length - 1]);

const listEn = joinWith("and");

// Unit indices as in grid.js: 0-8 rows, 9-17 columns, 18-26 boxes.
const EN = {
  // header, status row, tool row, panels
  "newGame": "New Game",
  "level": "Level",
  "mistakes": "Mistakes",
  "colours": "Colours",
  "board": "Sudoku board",
  "numbers": "Numbers",
  "preparing": "Preparing puzzle…",
  "hint": "Hint",
  "coach": "Coach",
  "close": "Close",
  "next": "Next",
  "fill": "Fill",
  "help": ({ n, max }) => `Help: ${n} of ${max} used`,
  "tip": "Tip: hold a number to add a note",
  "cancel": "Cancel",
  "ok": "OK",

  "level.beginner": "Beginner",
  "level.expert": "Expert",
  "level.master": "Master",

  "scheme.bw": "Black & White",
  "scheme.blue": "Classic Blue",
  "scheme.sepia": "Sepia",
  "scheme.dark": "Dark",
  "scheme.forest": "Forest",
  "scheme.neon": "Neon",
  "scheme.rainbow": "Rainbow",

  // dialogs
  "dlg.mistake.title": ({ n, max }) => `Mistake ${n}/${max}`,
  "dlg.mistake.text": "You may consider taking a hint next time.",
  "dlg.lost.title": "You lost the game.",
  "dlg.lost.text": "Play again?",
  "dlg.lost.primary": "Play Again",
  "dlg.solved.title": "Solved!",
  "dlg.solved.text": "Well done.",
  "dlg.confirm.title": "Abandon this game?",
  "dlg.confirm.text": "Your progress in this game will be lost.",

  // notices under the board
  "notice.blocked": "Fix or clear the red digit first.",
  "notice.clear": "Tap the same digit again to clear it.",

  // cell labels (screen readers)
  "cell.pos": ({ r, c }) => `row ${r}, column ${c}`,
  "cell.given": "given",
  "cell.wrong": "wrong",
  "cell.correct": "correct",
  "cell.empty": "empty",
  "cell.notes": ({ digits }) => `notes ${digits}`,
  "cell.cands": ({ digits }) => `candidates ${digits}`,
  "cell.removed": ({ digits }) => `${digits} removed`,

  // announcements (screen readers)
  "say.correct": "Correct.",
  "say.wrong": ({ n, max }) => `Wrong digit. ${n} of ${max} mistakes.`,
  "say.gameOver": "Three mistakes. You lost the game.",
  "say.solved": "Solved!",
  "say.note": "Note added.",
  "say.noteOff": "Note removed.",
  "say.cleared": "Digit cleared.",
  "say.hint": ({ d, where }) => `Hint: ${d} in ${where}.`,
  "say.hintCleared": ({ where }) => `Hint: the wrong digit in ${where} is removed.`,
  "say.coach": ({ d, where }) => `Coach: ${d} in ${where}.`,
  "say.coachCleared": ({ where }) => `The wrong digit in ${where} is removed.`,

  // Coach panel
  "coach.step": ({ k, n }) => `Step ${k} of ${n}`,
  "coach.prep": "This step removes candidates; no cell can be filled yet.",
  "coach.none": "No technique from the list applies here.",

  // technique names (German may get its own later, PRD 3.8)
  "tech.nakedSingle": "Naked Single",
  "tech.hiddenSingle": "Hidden Single",
  "tech.pointing": "Pointing",
  "tech.claiming": "Claiming",
  "tech.nakedPair": "Naked Pair",
  "tech.hiddenPair": "Hidden Pair",
  "tech.nakedTriple": "Naked Triple",
  "tech.hiddenTriple": "Hidden Triple",
  "tech.xWing": "X-Wing",
  "tech.xyWing": "XY-Wing",
  "tech.swordfish": "Swordfish",

  // Coach phrases: names, lists, explanation templates (PRD 3.4.1)
  "coach.cellLong": ({ r, c }) => `row ${r}, column ${c}`,
  "coach.cellShort": ({ r, c }) => `r${r}c${c}`,
  "coach.unit": ({ u }) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`),
  "coach.list": ({ items }) => listEn(items),
  // "rows 2 and 7", "columns 1, 4 and 8"
  "coach.lines": ({ units }) => (units[0] < 9 ? "rows " : "columns ") + listEn(units.map((u) => String(u < 9 ? u + 1 : u - 8))),
  "coach.t.nakedSingle": ({ cell, d }) => `${cell} can only be ${d}: every other digit already stands in its row, column or box.`,
  "coach.t.nakedSingleAfter": ({ cell, d }) => `${cell} can only be ${d}: all other candidates are gone.`,
  "coach.t.hiddenSingle": ({ unit, d, cell }) => `In ${unit}, the ${d} fits only into ${cell}.`,
  "coach.t.pointing": ({ box, line, d }) => `In ${box}, the ${d} can only be in ${line}. So the ${d} is removed from the rest of ${line}.`,
  "coach.t.claiming": ({ line, box, d }) => `In ${line}, the ${d} can only be in ${box}. So the ${d} is removed from the rest of ${box}.`,
  "coach.t.nakedSubset": ({ cells, digits, unit, triple }) =>
    `${cells} can only hold ${digits}${triple ? " between them" : ""}. So ${digits} are removed from the other cells of ${unit}.`,
  "coach.t.hiddenSubset": ({ unit, digits, cells }) =>
    `In ${unit}, ${digits} fit only into ${cells}. So all other candidates are removed from these cells.`,
  "coach.t.fish": ({ base, cover, d }) =>
    `In ${base}, the ${d} fits only into ${cover}. So in ${cover} the ${d} must be in ${base}, and it is removed from the rest of ${cover}.`,
  "coach.t.xyWing": ({ P, x, y, A, B, A2, B2, p1, p2, d }) =>
    `${P} can only be ${p1} or ${p2}. If it is ${x}, ${A} must be ${d}; if it is ${y}, ${B} must be ${d}. ` +
    `Either way one of ${A2} and ${B2} is ${d}, so the ${d} is removed from every cell that sees both.`
};

const TABLES = { en: EN, de: {} };

// Text `key` in `lang` with `values`; falls back to English, then to the key itself.
export function t(lang, key, values = {}) {
  const table = TABLES[lang] || EN;
  const v = key in table ? table[key] : EN[key];
  if (v === undefined) return key;
  return typeof v === "function" ? v(values) : v;
}

// For tests: the keys of a language table.
export const keysOf = (lang) => Object.keys(TABLES[lang] || {});
