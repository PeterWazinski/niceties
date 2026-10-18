# Sudoku – Product Requirements Document

Status: **Final – ready for the implementation plan** · 2026-10-18

A small, ad-free Sudoku for the browser. It follows the clean look of sudoku.com
(see the screenshots in this folder) but has no ads, no scoring and no timer. It
runs offline once loaded and is made for a 6-inch phone and a 10-inch iPad.

Reference images (same folder):
`portrait-layout-6inch.jpg`, `screenshot01-number-highlight.jpg`,
`screenshot02-error.jpg`, `screenshot03-cell-highlight.jpg`.

All review decisions are recorded in section 11. No questions are open.

---

## 1. Goals and non-goals

**Goals**

- Relaxed Sudoku with a simple layout, no ads, no accounts, no network.
- Instant, clear visual feedback: highlighting of related cells and of conflicts.
- Three difficulty levels, generated on the device, symmetric puzzles.
- Playable and restartable (new game) while fully offline.
- Comfortable on iPhone (~6") and iPad (~10"), touch first.

**Non-goals**

- No scoring, no timer, no leaderboards, no statistics, no daily challenges.
- No accounts, no server, no analytics.
- No Killer/other variants.
- No ads, ever.

## 2. Users and platforms

| Item | Decision |
|---|---|
| Primary devices | iPhone (~6", portrait), iPad (~10", portrait and landscape) |
| Browsers | Safari iOS 15+ first; current Chrome/Edge/Firefox on desktop as a bonus |
| Input | Touch first (tap = digit, long press = note); keyboard on desktop (arrows, 1–9 = digit, Shift+1–9 = note, H = hint) |
| Network | Needed only for the first load; never afterwards |

## 3. User experience

### 3.1 Screen layout

One screen, no navigation. Plain, flat, lots of white space, like sudoku.com.

**Portrait (phone, and iPad portrait)** – modelled on `portrait-layout-6inch.jpg`:

```
┌──────────────────────────────┐
│ Sudoku              [New Game]│  header
├──────────────────────────────┤
│ Level ▾     Mistakes   Colours ▾│  status row
│              0/3                │
│ ┌────────────────────────────┐ │
│ │                            │ │
│ │          9 × 9 board       │ │  square, full width
│ │                            │ │
│ └────────────────────────────┘ │
│            💡 Hint             │  tool row (just Hint)
│  1  2  3  4  5  6  7  8  9     │  number row (tap = digit, hold = note)
└──────────────────────────────┘
```

Differences from the sudoku.com screenshot: the *Time* slot is replaced by the
**colour-scheme dropdown**; there is no pause button, no score, no menu bubble,
and no Undo / Erase / Notes buttons (see 3.2 for why they are not needed).

**Landscape (iPad, wide desktop)** – modelled on screenshots 1–3: board on the left,
a side panel on the right with the status row, the Hint button, a 3×3 number
pad and **New Game** at the bottom.

**Sizing rules**

- Board is square and as large as the viewport allows; it never scrolls the page.
- Use `100dvh` and `env(safe-area-inset-*)` so Safari's toolbars don't cut it.
- Touch targets ≥ 44 pt. The number row buttons are ≥ 36 pt wide on a 6" phone.
- Test viewports: iPhone 6.1" (≈ 390×844), iPad 10.2" (≈ 810×1080 portrait, 1080×810 landscape).
- No double-tap zoom, no text selection, no rubber-band scroll on the board.

### 3.2 Playing

The rules are strict, which is what makes Undo and Erase unnecessary:
**the game knows the solution, so a correct digit is locked in immediately.**

1. **Select a cell** by tapping it. Any cell can be selected (to see its
   highlights), but only **empty cells and cells holding a wrong digit** accept input.
2. **A cell must be selected first.** Tapping a number with no cell selected, or
   with a locked cell selected, does nothing (number row is dimmed).
3. **Tap a number** (short tap) → the digit is entered in the selected cell:
   - **Correct** (equals the solution): the digit is **locked**. It can no longer
     be changed, erased or annotated. Notes of that digit in the cell's row,
     column and box are removed automatically.
   - **Wrong**: the mistake counter goes up (3.4) and the digit is shown in red.
     The cell stays editable: tap another digit to overwrite it (free if it is
     right, another mistake if it is wrong again). Tapping the very same wrong digit again does nothing.
4. **Hold a number** (long press) → the digit is toggled as a **pencil note** in
   the selected empty cell (details in 3.2.1). Cells with a digit – right or wrong –
   take no notes. Entering a digit replaces the cell's notes.
5. **Hint** button: always active (3.4).
6. A digit whose nine copies are all placed is greyed out in the number row.
7. Filling the last cell ends the game: a short "Solved!" message with **New Game**.
   No score, no time.

**Why no Undo and no Erase:** Undo would only matter for wrong digits, but a wrong
digit can simply be overwritten, and the mistake stays counted anyway. Nothing
correct can be taken back. Notes are toggled off by holding the same digit again.
Hence neither button earns its place. (Hint can also clear a wrong digit, 3.4.)

Locked digits are shown in the "player" colour, different from the givens
(blue in the colour schemes, dark grey vs. black in B/W). Wrong digits are red.

#### 3.2.1 Notes by long press instead of a mode button

Instead of a Notes on/off toggle, the **same number buttons** do both jobs:

| Gesture on a number button | Effect |
|---|---|
| Short tap (released before ~350 ms) | Enter the digit |
| Hold (≥ ~350 ms) | Toggle that digit as a note in the selected cell |

Pros: no mode to forget (the classic "why did my digit become a tiny note?"
mistake), one less button, and every action is one gesture away.
Cons and how the design handles them:

- **Discoverability.** Nothing on screen says "hold me". → A one-line hint under
  the number row on the first game ("Tip: hold a number to add a note"), shown until
  the first note has been made (flag in localStorage).
- **No feedback during the hold.** → The note is applied when the threshold is
  **reached** (not on release), and the button gives immediate visual feedback
  (it fills/pulses at the threshold; a short `navigator.vibrate` where available –
  not on iOS Safari). The press-down state of the button is shown from the first
  moment, so the user sees the hold registering.
- **iOS long-press side effects** (callout menu, text selection, magnifier).
  → `-webkit-touch-callout: none`, `user-select: none`, `touch-action: manipulation`,
  and `contextmenu` is cancelled on the number buttons. Pointer events are used
  (`pointerdown` starts a timer, `pointerup` before the threshold = tap,
  `pointercancel`/leaving the button aborts).
- **Accidental holds** while thinking with a finger on a digit. → harmless: it
  creates a note, which is toggled off by another hold.
- **Desktop:** `Shift+digit` toggles a note, `digit` enters it.

If real-device testing shows it feels bad, a Notes toggle button can be added
later without changing anything else. (Recommendation: try the long press first.)

### 3.3 Highlighting

| Action | Highlight |
|---|---|
| Tap an **empty** cell | The cell (strong), plus its **row, column and 3×3 box** (light). |
| Tap a **filled** cell | The cell (strong), **all cells containing the same digit** (medium), plus its row, column and box (light) as on sudoku.com. |
| Conflict | Cells that break a rule (same digit twice in a row/column/box) are highlighted **red**: the offending cells and the digit in them. |

The highlight layers are separate CSS classes, so a colour scheme can restyle
every one of them. Red for conflicts is kept recognisable in every colour scheme.

### 3.4 Mistakes, game over and Hint

**Mistake counter.** A mistake is counted when the entered digit **differs from the
puzzle's solution** – even if it does not (yet) clash with any visible digit.
The counter shows `n/3`. It is never refunded. Wrong digits are red; if they also
duplicate a visible digit in the row/column/box, those cells get the red conflict
highlight as well.

**Hint button** (always active, unlimited – there is no score to protect):

| Situation | What Hint does |
|---|---|
| Board has a **wrong digit** | The wrong digit is **emptied in slow motion** (fades out over ~1.2 s). That cell is selected afterwards. If there are several wrong digits, the selected one goes first, else the most recent. |
| No wrong digit, a cell is **selected and empty** | The correct digit is **slowly faded in** there and locked. The cell is selected and gets a brief pulsing outline so the user notices where the hint landed. |
| No wrong digit, **nothing useful selected** | The cell the logical solver would fill next is selected and filled the same way. |

So after a wrong digit has been emptied, the user decides: **guess again** (tap a
digit) or press **Hint** again, which then reveals the right digit. A hint never
counts as a mistake.

**Game over at 3/3.** Play stops and a dialog asks (instead of sudoku.com's "game over"):

> **Three mistakes.**
> [ New Game ]  [ Hint ]

- **New Game** – starts a new puzzle at the current level.
- **Hint** – the dialog closes, the game goes on: the wrong cell is emptied in
  slow motion (as above) and the counter goes back to **2/3**, so the user has
  one more chance. Any further wrong digit shows the dialog again.

The dialog is modal; it is also restored after a reload (3.7).

### 3.5 New game and levels

- **New Game** button: starts a new puzzle at the current level. If a game is in
  progress, ask for confirmation first ("Abandon this game?").
- **Level dropdown**: `Beginner`, `Expert`, `Master`. Choosing a different level
  starts a new game (with the same confirmation).
- No other settings, no menu.

### 3.6 Colour schemes

Dropdown in the status row. **Black & White** is the default. Proposed set (all
defined as CSS variable sets, so more can be added in minutes):

| Scheme | Notes |
|---|---|
| **Black & White** (default) | White paper, black lines/givens, greys for highlights, dark grey for player digits, red for errors |
| Classic Blue | The sudoku.com look from the screenshots |
| Sepia | Warm paper, brown ink – easy on the eyes |
| Dark | Near-black background, light digits |
| Forest | Soft greens |

Every scheme must keep givens, player digits, the three highlight levels and the
error red clearly distinguishable (minimum contrast 4.5:1 for digits).
The colour scheme switches live, with no reload. The browser's
`theme-color` meta tag follows the scheme.

### 3.7 Persistence

`localStorage`:

| Key | Value |
|---|---|
| `sudoku.scheme` | scheme id, default `bw` |
| `sudoku.level` | `beginner` \| `expert` \| `master`, default `beginner` |
| `sudoku.game` | the **complete game state**: givens, solution, entries, notes, mistakes, selected cell, level, game-over dialog open or not. Written after every move; restored when the page is opened again, also after an iOS tab eviction. Deleted when the game is solved. |
| `sudoku.pool` | pre-generated puzzles (5.4) |
| `sudoku.tipShown` | the long-press tip has been dismissed by a first note |

All reads/writes are wrapped in try/catch (private mode, quota); the game works
without storage.

## 4. Difficulty levels

Clue count alone does not define difficulty: a 24-clue puzzle can be easy and a
32-clue one nasty. So each level has **two** criteria: a clue range and the
hardest solving technique that is *required*. The generator checks both.

| Level | Clues (givens) | Hardest technique required | Feel |
|---|---|---|---|
| **Beginner** | 38–42 | Naked & hidden singles only | Pure scanning, no guessing |
| **Expert** | 30–34 | + naked/hidden pairs & triples, pointing/claiming pairs | Needs some candidate tracking |
| **Master** | 24–28 | + X-Wing, Swordfish, XY-Wing (and similar fish/wings) | Real thinking, a few "aha" moments |

My suggestion for clue counts is the middle of each range: **40 / 32 / 26**.
With symmetry the actual count is whatever the symmetric removal gives (e.g. 180°
rotation gives an odd count if the centre cell is a clue, even otherwise), so the
generator accepts any count inside the range.

Why not fewer than 24? Puzzles with 17–23 clues exist and are unique, but they are
rare, slow to find and, with symmetry, very rare. 24 is cheap to reach and plenty hard.

## 5. Puzzle generation

### 5.1 Can a browser do it? Yes.

Generating symmetric, uniquely solvable puzzles is cheap on a phone. The
expensive-sounding part is the uniqueness check, but a bitmask backtracking
solver with "fewest candidates first" counts solutions (stopping at 2) in well
under a millisecond to a few milliseconds for typical puzzles. A full generation
costs roughly:

| Level | Typical | Worst case (rejection retries) |
|---|---|---|
| Beginner | < 50 ms | ~ 0.2 s |
| Expert | ~ 100 ms | ~ 0.5 s |
| Master | ~ 0.3 s | ~ 2 s on an older iPhone |

(Estimates; to be measured in the implementation phase.) To keep the UI smooth
regardless, generation runs in a **Web Worker**, and the app keeps one
**pre-generated puzzle per level** ready (see 5.4), so *New Game* is instant,
also offline.

### 5.2 Algorithm

1. **Full grid**: fill an empty grid with randomised backtracking (random digit order per cell).
2. **Pick a symmetry** and compute the *orbits* of cells (cells that map onto each other).
3. **Dig**: visit orbits in random order; remove the whole orbit; if the puzzle no
   longer has exactly one solution, put the orbit back. Stop when the clue count
   reaches the level's range, or no orbit can be removed.
4. **Grade**: run a human-technique solver (singles → pairs/triples → pointing →
   fish/wings) and record the hardest technique needed. Accept only if it matches
   the level and the clue count is in range; otherwise retry (new dig order, or
   new grid after N tries).
5. Return `{ givens, solution, level, symmetry }`.

The step-4 solver doubles as the **hint engine**: it can name the next logical move.

### 5.3 Symmetry (optional requirement – included)

As described in the SudokuPulse article, symmetric puzzles have givens in
mirrored/rotated patterns. Symmetry only changes step 3 (remove orbits instead of
single cells), so it adds almost no cost. Supported symmetries:

| Symmetry | Orbit size |
|---|---|
| Rotational 180° (the classic) | 2 |
| Rotational 90° | 4 |
| Horizontal mirror / vertical mirror | 2 |
| Diagonal / anti-diagonal mirror | 2 |
| Both diagonals; both axes | 4 |

**Plan:** the first release always uses 180° rotation (the most common and
nicest-looking, easy for Master clue counts). The other types are picked at random
per game for variety when the level allows. Strong symmetries (90°, both
diagonals) make low clue counts harder to reach, so Master falls back to a
weaker symmetry after a few failed tries. Beginner and Expert can use any. Whether
the player should see which symmetry a puzzle has: no, not in the UI.

### 5.4 Background pool

- After the page loads (and after every *New Game*) the worker generates the next
  puzzle for the current level and, when idle, for the other two levels.
- Pool: one puzzle per level, stored in `localStorage` (or IndexedDB), so that
  *New Game* is instant after a cold start, too.
- If the pool is empty (first ever start), show the board with a brief
  "Preparing puzzle…" state; Beginner takes < 0.1 s so this is rarely visible.

## 6. Offline behaviour

Requirement: after the game has been **loaded once in the browser**, it must be
completely playable offline, including *New Game*.

- All code, CSS, fonts and icons are served from the same origin; no CDN, no web
  fonts, no external requests. (System font stack; digits use a numeric font that
  is the same on iOS and desktop.)
- A **service worker** pre-caches the whole app (`index.html`, CSS, JS, worker,
  icons, manifest) at install. Strategy: cache-first, with background update
  (stale-while-revalidate); cache name carries a version so updates replace old files.
- Puzzles are generated on the device, so *New Game* needs no network.
- A **Web App Manifest** with icons allows "Add to Home Screen" (standalone, no
  Safari chrome, more room for the board). Recommended in the README, not forced.
- iOS caveat: Safari may purge caches of sites that are not used for a long time
  (≈ 7 days without a visit). "Add to Home Screen" exempts the app. I'll mention
  this in the README.
- Requires HTTPS (or `localhost`) to register the service worker – GitHub Pages provides it.

### 6.1 Hosting on GitHub Pages

- Served as a static folder, e.g. `https://<user>.github.io/niceties/Sudoku/`. No build
  step, so Pages serves the folder as is.
- **All URLs are relative** (`./css/base.css`, manifest `start_url`/`scope` `"./"`),
  because the app lives in a sub-path.
- **Shared origin:** all projects in the repo share one origin, hence one
  `localStorage` and one cache storage. Sudoku prefixes its keys with `sudoku.`,
  its caches with `sudoku-`, and its service worker controls only `/niceties/Sudoku/`.
- Pages caches files for a few minutes; the cache version in `sw.js` is bumped per release.

## 7. Implementation sketch (high level)

Same style as the other projects in this repo (`untangleMe`, `ColorSudoku`):
plain HTML/CSS/JavaScript with ES modules, **no framework, no build step**,
tests with `node --test` (unit) and Playwright (e2e).

### 7.1 Files

```
Sudoku/
  index.html            page shell, manifest link, viewport meta
  manifest.webmanifest  name, icons, standalone, theme colour
  sw.js                 service worker (precache list + versioned cache)
  css/
    base.css            layout, board, highlights, responsive rules
    themes.css          colour schemes as CSS variable sets
  js/
    main.js             wiring: load settings, start game, register service worker
    config.js           levels (clue range, techniques), max mistakes, long-press threshold, symmetry list
    rng.js              seeded random (so tests are reproducible)
    solver.js           bitmask backtracking solver, solution counter (stop at 2)
    techniques.js       human solving techniques (singles … fish, wings), used for grading + hints
    symmetry.js         symmetry types -> orbit lists
    generator.js        full grid + symmetric dig + grade (pure functions)
    generator.worker.js runs the generator off the main thread
    pool.js             pre-generated puzzle per level (storage)
    game.js             game state: givens, solution, entries, notes, mistakes, locking, hint, win/lose
    highlight.js        computes highlight classes for a selection and for conflicts
    view.js             renders the board and controls, handles taps/keys
    numpad.js           tap vs. long press on the number buttons
    settings.js         scheme + level in localStorage (safe wrappers)
    store.js            save/restore of the complete game state after every move
  icons/                192, 512, maskable, apple-touch-icon
  design/               this PRD, screenshots
  tests/
    unit/               solver, generator uniqueness, symmetry, grading, game rules
    e2e/                phone + iPad viewports, offline test
```

### 7.2 Key design points

- **Model / view split.** `game.js` is pure (no DOM): easy to unit-test locking,
  mistakes, hints and highlighting.
- **Board rendering:** a CSS-grid of 81 `<button>`-like cells (`role="grid"` / `gridcell`,
  with ARIA labels such as "row 3, column 5, 7, given"). Thick box borders via CSS.
  Highlights are classes (`.sel`, `.same`, `.peer`, `.conflict`, `.wrong`) driven
  by CSS variables from the active scheme.
- **Digit entry** validates against the stored solution (for mistakes); conflict
  highlighting uses the rules only, so it works without the solution.
- **State shape:** `givens[81]`, `solution[81]`, `entries[81]`, `notes[81]` (9-bit
  masks), `mistakes`, `level`, `selected`, `dialogOpen`. No history stack: nothing
  correct is ever undone. A cell is *locked* when `entries[i] === solution[i]`,
  *editable* when empty or wrong. Plain JSON, so save/restore is trivial.
- **Number buttons** (`numpad.js`): pointer events; `pointerdown` starts a ~350 ms
  timer, firing it toggles the note, `pointerup` before it enters the digit.
- **Generator isolation:** `generator.js` is plain ES module code, imported by
  the worker and by the node tests, with no DOM or worker APIs inside.
- **Colour schemes:** `data-scheme="bw"` on `<html>`; `themes.css` defines
  variables only. Adding a scheme = adding one block + one dropdown entry.
- **Responsive:** `min(100vw − gutters, 100dvh − chrome)` for the board size,
  `@media (orientation: landscape) and (min-width: 700px)` for the side-panel layout.
- **Worker support:** module workers are supported in Safari 15+. If creating the
  worker fails, fall back to generating on the main thread.

### 7.3 Testing plan (for the implementation phase)

- **Unit:** every generated puzzle has exactly one solution; symmetry holds;
  clue count in range; graded technique matches the level (e.g. 200 puzzles per
  level, seeded); mistake / locking / hint / game-over rules; highlight sets;
  save → restore round trip of the game state.
- **E2E (Playwright):** iPhone and iPad viewports, tap flows (select cell → digit →
  highlight → error → 3 mistakes → dialog → Hint), **long press** on a number
  (pointer down, wait, up) vs. short tap, scheme/level/game persistence after
  reload, **offline test** (load once, `context.setOffline(true)`, reload, play,
  start a new game).
- **Manual:** on a real iPhone and iPad, including Add to Home Screen.

## 8. Accessibility and polish

- Visible focus and keyboard play on desktop (Shift+digit = note); ARIA labels on cells and buttons.
- Colour is never the only signal: errors also get a bolder digit / a different
  background pattern in the B/W scheme (red alone is weak for colour-blind users).
- `prefers-reduced-motion`: no animation. Otherwise only subtle ones (selection fade, solved message).
- Haptics: none (apart from an optional vibrate on a long press where supported). Sound: none.
- All text in English (UI strings in one place, so a German version would be easy).

## 9. Acceptance criteria (summary)

1. No ads, no network requests after the first load, no timer, no score anywhere.
2. Tap an empty cell → its row, column and box are highlighted.
3. Tap a filled cell → all identical digits are highlighted.
4. A wrong digit (≠ solution) is red and increments the mistake counter; a correct digit is locked and cannot be changed or noted; there are no Undo/Erase buttons.
5. At 3 mistakes the dialog offers **New Game** or **Hint**; Hint empties the wrong cell in slow motion and continues at 2/3. The Hint button works at any time.
5a. Tap enters a digit, long press toggles a note; both only in an editable cell that is selected.
5b. Reloading the page restores the complete game, including notes, mistakes and an open game-over dialog.
6. Levels Beginner/Expert/Master produce puzzles with the clue ranges and techniques of section 4; every puzzle is unique and (by default) 180° symmetric.
7. A colour-scheme dropdown with B/W as default; the choice and the level survive a reload.
8. Layout fits an iPhone (6") and an iPad (10") in portrait without scrolling; iPad landscape uses the side panel.
9. After one online load, the game can be played to completion and a new game started with the device in airplane mode.
10. *New Game* appears in < 300 ms in the normal case (from the pool).

## 10. Out of scope / future ideas

Statistics, daily puzzle, share-a-puzzle link (a seed in the URL would be easy, as
in untangleMe), auto-notes, more symmetries picker, German UI, printing.

## 11. Decisions

### Decided (review round 1)

| Topic | Decision |
|---|---|
| Hosting | GitHub Pages (6.1) |
| What is a mistake | Any digit that differs from the final solution, even if not visibly wrong yet (3.4) |
| Correct digits | Locked at once: cannot be changed, erased or annotated (3.2) |
| Undo / Erase buttons | Dropped – not needed (3.2) |
| Notes | No mode button; **long press** on a number toggles a note (3.2.1) |
| Hint | Button always active, unlimited; empties a wrong digit in slow motion, then reveals on the next press (3.4) |
| Game state | The complete game is saved and resumed (3.7) |
| Tap on a filled cell | Highlights identical digits **and** row, column, box (3.3) |
| Entry order | Cell first, then number; a number tap without a selected editable cell does nothing |
| Language / colours | English only; start with B/W, Classic Blue, Sepia, Dark, Forest (3.6) |
| Clue ranges | Taken as proposed in section 4 (38–42 / 30–34 / 24–28), symmetry as in 5.3 |

### Confirmed (review round 2)

| Topic | Decision |
|---|---|
| Counter after game-over → Hint | Back to **2/3**. The next wrong digit shows the New Game / Hint dialog again. |
| Hint reveal | The hint **slowly fades in** the correct digit, with a brief pulsing outline on the cell, so the user sees where it was given. No textual explanation. |
| Long press | ~350 ms threshold and the first-run tip are accepted; they will be tuned after testing on a real device (the threshold lives in `config.js`). |
