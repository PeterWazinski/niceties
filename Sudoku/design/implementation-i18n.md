# Sudoku – Implementation Plan: German (change request)

Implements PRD 3.8 and the decisions of PRD 11 "Change request German (review
round 4)". The working rules and the phase gate of [implementation.md](implementation.md)
apply unchanged: phases in order, every phase ends with **all** unit tests and **all**
e2e tests (four projects) green, checkboxes ticked only when delivered and tested,
one commit per phase (`Sudoku: i18n phase N – <title>`). Never commit red.

## Starting point (code as of 2026-11-16)

- About 100 visible and screen-reader texts, spread over `view.js` (template,
  `LEVEL_NAMES`, `DIALOGS`, cell labels, help text), `controller.js` (notices,
  announcements, Coach note and counter), `coach.js` (technique titles, levels, the 11
  explanation templates, unit and cell names, lists) and `schemes.js` (scheme names).
- `index.html` has `lang="en"`; the page title and the manifest name are "Sudoku" and
  stay so.
- The e2e tests look for English texts and roles (`"New Game"`, `"Fill"`, cell labels
  "row 4, column 6"). Playwright's default locale is `en-US`, so with device-language
  detection they keep running in English unchanged; German tests set `locale: "de-DE"`.

## Design decisions for the implementation

- **`i18n.js`, pure (no DOM):** `LANGS = ["en", "de"]`, one table per language
  (`key → string` or `key → (values) => string`), `t(lang, key, values)`,
  `detectLang(languages)` (`de…` → `de`, else `en`), `isLang(x)`. A missing key in
  `de` falls back to `en` (and a unit test makes sure none is missing). The current
  language lives in the controller and is passed to the view; `i18n.js` keeps no state.
- **Coach phrases per language:** `coach.js` gets a `lang` option
  (`explain(step, name, { afterEliminations, lang })`, `cellNamer(lang)`); unit names,
  plural line names, lists and the 11 templates come from a per-language phrase set
  in `i18n.js`. Technique titles come from the table too, but `de` uses the English
  titles (PRD 3.8: ready for German names later). Levels in the Coach title use the
  level names of the table (Leicht / Mittel / Schwer).
- **Live switch:** `view.setLanguage(lang)` rewrites every text node and attribute
  that carries a text (labels, options, aria-labels, the open dialog, the help text,
  the tip, the notice) and sets `<html lang>`; then `render(state)` redraws the cell
  labels. The template keeps its structure; texts are filled from the table, so the
  same code path serves the first render and every switch.
- **Coach redraw:** on a switch with the Coach open, the controller rebuilds the texts
  of the session with a new `cellNamer(lang)` (names start long again) and shows the
  same step index again.
- **Settings:** `sudoku.lang` next to `sudoku.scheme` in `settings.js`
  (`loadLang(fallback)`, `saveLang(lang)`; invalid values ignored, like the scheme).

---

## Phase L1 – Text tables, no visible change ✅ 2026-11-16

- [x] `i18n.js` (new, pure): English table with every text of the app (including the
  screen-reader texts), `t(lang, key, values)`, `detectLang()`, `isLang()`, `keysOf()`;
  the English Coach phrases (cell names, units, line names, lists, 11 templates) are
  keys of the same table (`coach.*`), so German needs no extra code path
- [x] `coach.js`: titles, levels, unit/cell names, lists and templates from the table;
  `cellNamer(lang)`, `explain(step, name, { afterEliminations, lang })` (default `en`);
  English output identical (the order of name calls is kept in `coach.js`)
- [x] `view.js`: template texts as `data-t` / `data-t-label` keys, filled by
  `applyTexts()`; `LEVEL_NAMES` gone; `DIALOGS` hold keys; cell labels and help text
  from `t()`; `setLanguage(lang)` (also redraws an open dialog, sets `<html lang>`)
- [x] `controller.js`: notices, announcements, Coach note and counter from `t()`;
  holds the current language (`DEFAULT_LANG` in this phase)
- [x] `schemes.js`: names removed, they are `scheme.<id>` keys
- [x] `sw.js`: `js/i18n.js` in the precache list, `VERSION` 8 → 9

Tests:
- [x] unit `i18n.test.js` (6): languages, `detectLang()` (`de`, `de-DE`, `de-AT`,
  `DE-ch`, `en-US`, `fr-FR` first, empty / missing / empty entries), `t()` with values,
  fallback to `en`, unknown keys; no empty English text
- [x] unit: every key used in `js/` exists in the English table (scan of `tr("…")`,
  `t(lang, "…")`, `data-t`, dialog keys and ternaries), plus the dynamic keys of every
  technique, level and scheme
- [x] unit `coach.test.js`: all existing text tests unchanged and green
- [x] e2e: **all existing tests unchanged** (no file in `tests/e2e` touched) and green:
  desktop 112, emulated iPhone/iPad 336 (Chrome). WebKit, axe and visual on the
  notebook as before

Result: 179 unit tests green.

Gate → commit `Sudoku: i18n phase L1 – text tables`.

## Phase L2 – German and the globe button

- [ ] `i18n.js`: German table with every key (texts of PRD 3.8), German Coach phrase
  set ("Reihe 4, Spalte 6" → "r4s6", "Block 5", "Reihen 2 und 7", "4 und 8", the 11
  templates); technique titles in `de` = English
- [ ] `settings.js`: `loadLang()`, `saveLang()` with `sudoku.lang`
- [ ] `main.js` / `controller.js`: start language = saved choice, else
  `detectLang(navigator.languages || [navigator.language])`
- [ ] `view.js`: globe button `#lang` (icon + current code, accessible name per PRD
  3.8) in the header left of New Game (portrait) and in the title row (landscape)
- [ ] `controller.js`: tap / click toggles, saves, calls `view.setLanguage()`, redraws
  an open Coach panel, announces "Deutsch" / "English"; works while the Coach is open,
  not while a dialog is open (the overlay covers it anyway)
- [ ] `base.css`: header with three items in portrait and landscape; German texts are
  longer ("Neues Spiel", "Schließen", "Eintragen", "Hinweis") – no truncation, no
  page scroll, targets ≥ 44 px

Tests:
- [ ] unit `i18n.test.js`: `de` has exactly the keys of `en`; no empty string; every
  function key accepts the same values in both languages
- [ ] unit `coach.test.js`: German text for every technique (exact strings, as in the
  English tests), German cell names (long then short, per session), lists, plurals;
  the 30-game batch also produces German texts without `undefined` or `NaN`
- [ ] unit `settings.test.js`: `sudoku.lang` saved / loaded, invalid value ignored
- [ ] e2e `language.spec.js` (new, all four projects):
  - [ ] locale `de-DE` starts in German (header, status labels, levels Leicht/Mittel/
    Schwer, scheme names, Hint/Coach, tip, `<html lang="de">`); locale `en-US` in English
  - [ ] the globe toggles live both ways, label = current language, no reload
  - [ ] the choice survives a reload and wins over the device language
  - [ ] dialogs (mistake, lost, solved, confirm) and the notice in German
  - [ ] screen reader: cell labels ("Reihe 1, Spalte 1, …"), announcements, help text
  - [ ] Coach in German: title "Schritt 1 von n · Pointing · Mittel", note, texts equal
    the engine's German texts; switching with the panel open redraws it, names long again
  - [ ] the page never scrolls in German (portrait, landscape, short landscape with
    the Coach open); all buttons ≥ 44 px
- [ ] e2e a11y: axe scan in German (main screen, a dialog, the Coach panel)
- [ ] e2e: earlier tests pass

Gate → commit `Sudoku: i18n phase L2 – German and the globe button`.

## Phase L3 – Offline, docs, release

- [ ] `sw.js`: `VERSION` raised
- [ ] e2e offline: German after an offline reload, the toggle works offline
- [ ] `README.md` (Sudoku): language section (device language, globe toggle); project
  layout lists `i18n.js`
- [ ] `Sudoku/CLAUDE.md`: code map (`coach.js`, `i18n.js`), seven schemes, shared help
  dots instead of `n/4` (stale since the Coach)
- [ ] `implementation.md` "After the release": entry pointing to this file
- [ ] PRD 9 criterion 12 mapped to tests (table below)

Gate → commit `Sudoku: i18n phase L3 – offline and docs`.

---

## Acceptance traceability (PRD 9, criterion 12)

| Part | Test(s) |
|---|---|
| Device language at first start | unit `detectLang`; e2e language (locale de-DE / en-US) |
| Globe toggles live, label = current language | e2e language |
| Every visible and screen-reader text translated | unit key parity; e2e language (texts, labels, dialogs) |
| Technique names stay English | unit coach (German titles); e2e language (Coach title) |
| Choice survives a reload | unit settings; e2e language |
| Works offline | e2e offline (L3) |

## Risks to watch

- **L1 touches every text:** a single typo changes an English string and breaks an
  existing test – that is the intended safety net; L1 is done only when every existing
  test passes unchanged.
- **Longer German texts:** the header gets a third item and the buttons longer labels;
  check the iPhone portrait and short landscape layouts first.
- **German grammar in templates:** "die 7", "aus dem Rest von Reihe 4", plurals – the
  exact-string unit tests are the review copy; the user reviews the wording in the PRD
  before L2.
- **Test environment:** real WebKit, axe and the screenshot baselines still run only on
  the dev notebook (see the list in [implementation-coach.md](implementation-coach.md)).
