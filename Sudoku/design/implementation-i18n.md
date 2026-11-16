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

## Phase L2 – German and the globe button ✅ 2026-11-16

- [x] `i18n.js`: German table with every key (texts of PRD 3.8), German Coach phrases
  ("Reihe 4, Spalte 6" → "r4s6", "Block 5", "Reihen 2 und 7", "4 und 8", the 11
  templates); the `tech.*` keys are left out on purpose, so technique names fall back
  to English (fill them in to translate later); `lang.code` / `lang.label` /
  `lang.name` for the globe button
- [x] `settings.js`: `loadLang(fallback)`, `saveLang()` with `sudoku.lang`
- [x] `controller.js`: start language = saved choice, else
  `detectLang(navigator.languages || [navigator.language])`
- [x] `view.js`: globe button `#lang` (icon + `#lang-code`, accessible name per PRD
  3.8) in a new `.head` (title + globe) left of New Game in portrait, the title row
  in landscape
- [x] `controller.js`: tap toggles, saves, `view.setLanguage()`, redraws an open
  Coach panel (texts rebuilt with a new `cellNamer(lang)`, same step, focus stays),
  announces "Deutsch" / "English"
- [x] `base.css`: header with title, globe and New Game; tool buttons with less side
  padding and `minmax(0, 1fr)` columns (German "Hinweis"/"Schließen" made the tool
  row 24 px too wide on 375 px phones); short landscape: 12 px instead of 27 px above
  the panel, so the 44 px globe adds no height
- [x] German tip shortened to "Tipp: Zahl lang drücken für eine Notiz" (the PRD text
  wrapped to two lines on 375 px phones); PRD 3.8 updated

Tests:
- [x] unit `i18n.test.js` (+8): `de` has exactly the keys of `en` except `tech.*`;
  every German text filled, same values, no `undefined`/`NaN`/`${`; UI texts of PRD
  3.8 (help, dialogs, levels, schemes, cell names, step counter, globe code)
- [x] unit (German Coach): exact texts for every technique, "r4s6" after the long
  name, per session; real chains of 16 expert/master games in German without gaps or
  English unit words
- [x] unit `settings.test.js` (+1): `sudoku.lang` saved / loaded, invalid value
  ignored, saved choice wins, storage errors
- [x] e2e `language.spec.js` (new, 12 tests, all projects):
  - [x] locale `de-DE` starts in German (header, labels, Leicht/Mittel/Schwer,
    scheme names, Hinweis/Coach, tip, board and help labels, `<html lang="de">`,
    title "Sudoku"); locale `en-US` in English, "EN", English accessible name
  - [x] the globe toggles live both ways (no reload), label = current language,
    announcement
  - [x] the choice survives a reload and wins over the device language; an invalid
    saved value falls back to the device language
  - [x] dialogs (mistake, confirm with Abbrechen, lost) and the notice in German; the
    game is untouched by a switch
  - [x] screen reader: cell labels ("Reihe r, Spalte c, d, vorgegeben" / "leer" /
    "richtig"), "Richtig.", "Coach: d in Reihe …"
  - [x] Coach in German: "Schritt 1 von n · <technique> · Mittel", note, texts equal
    the engine's German texts; switching with the panel open shows the English step,
    switching back and stepping through to "Eintragen" works
  - [x] the page never scrolls in German (also with the Coach open); globe, New Game,
    Hint, Coach ≥ 44 px and visible; labels not cut off, the tip on one line
- [x] e2e a11y: axe scan in German (main screen, Coach panel, confirm dialog) –
  written, runs on the notebook (axe not available in the cloud session)
- [x] e2e: earlier tests pass (`play-helpers.js` accepts "Fehler n/3" as well as
  "Mistake n/3"): desktop 124, emulated iPhone/iPad 372 (Chrome)

Result: 188 unit tests green.

Gate → commit `Sudoku: i18n phase L2 – German and the globe button`.

## Phase L3 – Offline, docs, release ✅ 2026-11-16

- [x] `sw.js`: `VERSION` 9 → 10 (L2 changed shipped files)
- [x] e2e offline: German after an offline reload, the toggle works offline, the
  Coach title in German (`offline.spec.js`, locale `de-DE`)
- [x] `README.md` (Sudoku): language section (device language, globe toggle,
  technique names English), all seven schemes, `i18n` in the project layout
- [x] `Sudoku/CLAUDE.md`: code map (`coach.js`, `i18n.js`), seven schemes, shared help
  dots instead of `n/4`, the rule that every text goes into both tables of
  `i18n.js`, how the e2e tests choose the language, links to the change-request plans
- [x] `implementation.md` "After the release": entry pointing to this file
- [x] PRD 9 criterion 12 mapped to tests (table below)

Run: 188 unit tests; e2e desktop 125, emulated iPhone/iPad 375 (Chrome) – all green.
Still on the dev notebook: real WebKit, `a11y.spec.js` (now with the German scan) and
the real iPad – see the list in [implementation-coach.md](implementation-coach.md).

Gate → commit `Sudoku: i18n phase L3 – offline and docs`.

---

## Acceptance traceability (PRD 9, criterion 12)

| Part | Test(s) |
|---|---|
| Device language at first start | unit `detectLang`, settings `loadLang`; e2e language (locale de-DE / en-US, invalid saved value) |
| Globe toggles live, label = current language | e2e language |
| Every visible and screen-reader text translated | unit key parity; e2e language (texts, labels, dialogs) |
| Technique names stay English | unit coach (German titles); e2e language (Coach title) |
| Choice survives a reload | unit settings; e2e language |
| Works offline | e2e offline: "German after an offline reload, the language toggle works offline" (L3) |

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
