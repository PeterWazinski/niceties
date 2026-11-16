# Sudoku – Product Requirements Document

Status: **Final – ready for the implementation plan** · 2026-10-18 ·
change request **Coach** (3.4.1, decisions round 3) added 2026-11-15 ·
change request **German** (3.8, decisions round 4) added 2026-11-16

A small, ad-free Sudoku for the browser. It follows the clean look of sudoku.com
(see the screenshots in this folder) but has no ads, no scoring and no timer. It
runs offline once loaded and is made for a 6-inch phone and a 10-inch iPad.

Reference images (same folder):
`portrait-layout-6inch.jpg`, `screenshot01-number-highlight.jpg`,
`screenshot02-error.jpg`, `screenshot03-cell-highlight.jpg`.

All review decisions are recorded in section 11. Open: one assumption of the Coach
change request (no peeking without a help left, see section 11, round 3).

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
| Input | Touch first (tap = digit, long press = note); keyboard on desktop (arrows, 1–9 = digit, Shift+1–9 = note, H = hint, C = coach) |
| Network | Needed only for the first load; never afterwards |

## 3. User experience

### 3.1 Screen layout

One screen, no navigation. Plain, flat, lots of white space, like sudoku.com.

**Portrait (phone, and iPad portrait)** – modelled on `portrait-layout-6inch.jpg`:

```
┌──────────────────────────────┐
│ Sudoku        [🌐 EN][New Game]│  header (language toggle, 3.8)
├──────────────────────────────┤
│ Level ▾     Mistakes   Colours ▾│  status row
│              0/3                │
│ ┌────────────────────────────┐ │
│ │                            │ │
│ │          9 × 9 board       │ │  square, full width
│ │                            │ │
│ └────────────────────────────┘ │
│  💡 Hint    ● ● ○ ○   🎓 Coach  │  tool row: Hint, help dots (3.4), Coach
│  1  2  3  4  5  6  7  8  9     │  number row (tap = digit, hold = note)
└──────────────────────────────┘
```

While the Coach is open (3.4.1) the tool row becomes **Close · dots · Next/Fill**
and the **number row is replaced by the Coach panel** (technique and level,
explanation); header, status row and board stay as they are.

Differences from the sudoku.com screenshot: the *Time* slot is replaced by the
**colour-scheme dropdown**; there is no pause button, no score, no menu bubble,
and no Undo / Erase / Notes buttons (see 3.2 for why they are not needed).

**Landscape (iPad, wide desktop)** – modelled on screenshots 1–3: board on the left,
a side panel on the right with the status row, the Hint and Coach buttons with
the help dots between them, a 3×3 number pad and **New Game** at the bottom. While
the Coach is open, the tool row becomes Close · dots · Next/Fill and the Coach panel
takes the place of the number pad. On short landscape
screens (up to 520 px high, one-row number strip) the explanation text **scrolls**
inside the panel; the buttons stay visible.

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
     be changed, erased or annotated. The same digit is removed from the notes of
     all cells in its row, column and box automatically (also when the digit was
     placed by Hint). A **wrong** digit never removes any notes.
   - **Wrong**: the mistake counter goes up and the digit is shown in red. What
     happens next depends on the mistake number (3.4): for mistake 1 and 2 a modal
     popup appears and, after **OK**, the wrong digit fades out slowly and the cell
     is empty again; mistake 3 loses the game. Meanwhile nothing else reacts.
     (If a wrong digit is on the board after a reload, only that cell accepts
     input until it is changed or cleared – tap the same digit again, Backspace /
     Delete, or Hint; a short line says so. This is a safety net, not the normal flow.)
4. **Hold a number** (long press) → the digit is toggled as a **pencil note** in
   the selected empty cell (details in 3.2.1). Cells with a digit – right or wrong –
   take no notes. Entering a digit replaces the cell's notes. Holding a digit whose
   note is already on **turns it off**, otherwise it turns it on. **A note may be set
   even if that digit already stands in the cell's row, column or box** – no
   validation, so the user sees the situation as it is when annotating.
5. **Hint** and **Coach** buttons share one help counter: at most four helps per
   game in total (3.4). Hint fills a cell silently, Coach explains the technique
   first and then fills the cell (3.4.1).
6. A digit whose nine copies are all placed is greyed out in the number row.
7. Filling the last cell ends the game: a short "Solved!" message with **New Game**.
   No score, no time.

**Why no Undo and no Erase button:** Undo would only matter for wrong digits. A
wrong digit is removed automatically after the mistake popup, and the mistake stays
counted anyway. Nothing correct can be taken
back. Notes are toggled off by holding the same digit again. Hence neither button
earns its place.

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

**Mistake 1 and 2.** A modal popup appears (it closes only with **OK**; Escape or a
tap outside do nothing):

> **Mistake 1/3**
> You may consider taking a hint next time.
> [ OK ]

After OK the wrong digit **fades out slowly** (~1.2 s) and the cell is empty (and
still selected). Input is blocked while it fades.

**Mistake 3: the game is lost.** The wrong digit is shown, the board **shakes**
(~0.6 s), then the whole page **fades slowly to grey** (~1.8 s). Only then a modal
popup appears:

> **You lost the game.**
> Play again?
> [ Play Again ]

Play Again starts a new puzzle at the current level (mistakes 0/3, hints 0/4).
There is no way to carry on a lost game, and no hint can be taken. With reduced
motion the shake is skipped and the fade is short. A lost game is saved: after a
reload the grey board and the popup are shown again (3.7).

**Help counter, shared by Hint and Coach.** **At most four helps per game in
total**, any mix of Hint and Coach (e.g. 3 hints + 1 coach). The counter is a row of
four dots **between the two buttons** in the tool row (in one row, so the board
keeps its size on the iPhone). A **filled dot is a used help**, counted like
the mistake counter (`● ● ○ ○` = 2 of 4 used). Accessible name: "Help: 2 of 4 used".
After the fourth help both buttons look inactive (`aria-disabled`) and further taps
(or `H`, `C`) are ignored. Helps are not refunded and reset with a new game.
(Supersedes the label `Hint n/4` of the first release.)

| Situation | What Hint does |
|---|---|
| Board has a **wrong digit** (normally only after a reload, see 3.2) | The wrong digit is **emptied in slow motion**. That cell is selected afterwards. |
| No wrong digit, a cell is **selected and empty** | The correct digit is **slowly faded in** there and locked. The cell is selected and gets a brief pulsing outline so the user notices where the hint landed. |
| No wrong digit, **nothing useful selected** | The cell the logical solver would fill next is selected and filled the same way. |

A hint never counts as a mistake; every hint that does something counts as one help.

#### 3.4.1 Coach

The Coach teaches instead of just revealing: it finds the **easiest next move on
the whole board**, explains the technique step by step on the board, and then
fills the cell.

**Which move.** The techniques of section 4 are tried from easy to hard
(Beginner → Expert → Master, in the order of `techniques.js`). The selected cell
is ignored: the Coach always starts with the easiest cell/technique. Only the
singles place a digit; every other technique only removes candidates. So the
Coach computes a **chain**: zero or more elimination steps, ending with the single
that places a digit. Elimination steps that are not needed for that final
placement are dropped from the chain, so the user only sees what matters.

**Flow.**

1. Tap **Coach** (or `C`). Board taps and the number row/pad are blocked until
   the Coach is closed. The selection highlight is replaced by the coaching marks.
   The user's own pencil notes are **hidden** while the Coach is open and come
   back unchanged afterwards (the Coach never writes into them).
2. The Coach panel replaces the number row/pad and shows the first step:
   technique name and level (e.g. "Naked Pair · Padawan") and one to three
   sentences of explanation with the concrete cells and digits; a long text
   scrolls inside the panel. When the chain has several steps, the title starts
   with a **step counter** ("Step 1 of 3 · Pointing · Padawan"), and every
   elimination step starts with the note **"This step removes candidates; no cell
   can be filled yet."** (change request 2026-11-15, after testing on the iPad:
   without it a preparing step looked like the solution). The tool row turns into **Close · dots · Next/Fill**.
3. On the board, for the current step:
   - the **unit(s)** the step is about (row, column, box) get the light highlight;
   - the **key cells** of the pattern (the pair, the X-Wing corners, the wing
     pivot and pincers …) get the medium highlight;
   - **computed candidates are shown only in the cells involved** in the step
     (key cells and the cells losing candidates), not on the whole board.
     Candidates that are **removed** by the step are **red and struck through**;
     the **deciding candidates** (the pattern's digits, the single that is placed)
     are in a neutral accent colour of the scheme. Colour is never the only signal:
     removed ones are struck through, deciding ones are bold.
4. An elimination step has the button **Next**: each elimination must be confirmed.
   After Next the removed candidates are gone and the next step is shown.
5. The last step (the single) has the button **Fill**: the digit is **slowly faded
   in** and locked, with the pulsing outline, exactly like a Hint (3.4); the cell is
   selected afterwards and the panel closes. **Only Fill uses a help.**
6. **Close** (or `Esc`) is available at every step and ends coaching without
   filling: no help is used, nothing on the board changes. **Peeking is allowed.**

**Cell names in the text.** The first time a cell appears in one coaching session
it is written in full ("row 4, column 6"), every later mention as "r4c6". Units are
written "row 4", "column 6", "box 5" (boxes numbered 1–9, left to right, top to
bottom).

**Explanation templates** (English; `d` digit, `A`, `B` cells, `U` unit):

| Technique | Level | Text (shape) |
|---|---|---|
| Naked single | Beginner | "A can only be d: every other digit already stands in its row, column or box." (after eliminations in the chain: "A can only be d: all other candidates are gone.") |
| Hidden single | Beginner | "In U, the d fits only into A." |
| Pointing | Expert | "In box b, the d can only be in U. So d is removed from the rest of U." |
| Claiming | Expert | "In U, the d can only be in box b. So d is removed from the rest of box b." |
| Naked pair / triple | Expert | "A and B can only hold d1 and d2 (between them). So d1 and d2 are removed from the other cells of U." |
| Hidden pair / triple | Expert | "In U, d1 and d2 fit only into A and B. So all other candidates are removed from A and B." |
| X-Wing / Swordfish | Master | "In rows r1 and r2, the d fits only into columns c1 and c2. So in columns c1 and c2 the d must be in rows r1 and r2, and it is removed from the rest of columns c1 and c2." (and transposed) |
| XY-Wing | Master | "A can only be x or y. If it is x, B must be z; if it is y, C must be z. Either way one of B and C is z, so the z is removed from every cell that sees both." |

**Situations.**

| Situation | What Coach does |
|---|---|
| A **wrong digit** is on the board (only after a reload, see 3.2) | In normal play this cannot happen: the mistake popup must be confirmed with OK (one mistake) and the digit fades out before Coach can be pressed. After a reload the wrong digit is **cleared first** (slow fade-out, no extra help), then coaching starts as usual. |
| No technique of the catalogue applies (not expected: every generated puzzle is solvable with them) | The panel says "No technique from the list applies here." and offers **Fill** with the digit of the cell the Hint would choose; Fill uses one help. |
| All four helps used, game lost or solved | Coach is inactive (no peeking without a help left). |

A reload while the Coach is open closes it (coaching is not saved); the game
itself is saved as before.

### 3.5 New game and levels

- **New Game** button: starts a new puzzle at the current level. If a game is in
  progress, ask for confirmation first ("Abandon this game?").
- **Level dropdown**: `Youngling`, `Padawan`, `Jedi` (German: `Jüngling`, `Padawan`,
  `Jedi`; change request 2026-11-16, before: Beginner / Expert / Master). The ids in
  code and storage stay `beginner`, `expert`, `master`. Choosing a different level
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
| Neon | Near-black background, cyan grid lines and white givens with a soft glow, pink player digits, coral red for errors (change request 2026-11-16) |
| Rainbow | Light page, each 3×3 box its own pastel tint (red → pink), dark givens, violet player digits; highlights in lilac layers instead of the tint; rainbow title and New Game button (change request 2026-11-16) |

Every scheme must keep givens, player digits, the three highlight levels and the
error red clearly distinguishable (minimum contrast 4.5:1 for digits; in Rainbow
on every box tint). Neon's glow was halved after the first proposal so the digits
stay sharp.
The colour scheme switches live, with no reload. The browser's
`theme-color` meta tag follows the scheme.

### 3.7 Persistence

`localStorage`:

| Key | Value |
|---|---|
| `sudoku.scheme` | scheme id, default `bw` |
| `sudoku.level` | `beginner` \| `expert` \| `master`, default `beginner` |
| `sudoku.lang` | `en` \| `de`; missing or invalid → device language (3.8) |
| `sudoku.game` | the **complete game state**: givens, solution, entries, notes, mistakes, hints used, selected cell, level, lost or not. Written after every move; restored when the page is opened again, also after an iOS tab eviction. Deleted when the game is solved. |
| `sudoku.pool` | pre-generated puzzles (5.4) |
| `sudoku.tipShown` | the long-press tip has been dismissed by a first note |

All reads/writes are wrapped in try/catch (private mode, quota); the game works
without storage.

### 3.8 Language (English / German)

The whole UI exists in **English** and **German**: visible texts, dialogs, the tip,
notices, the Coach explanations and all screen-reader texts (labels, announcements).

**Choosing the language.**
- **First start:** the device language decides: `navigator.languages[0]` (or
  `navigator.language`) starting with `de` → German, anything else → English.
- **Globe button** in the header, left of **New Game** (portrait), and in the title row
  of the side panel (landscape): a globe icon plus the code of the **current** language
  (`🌐 EN` / `🌐 DE`). **One tap toggles** English ↔ German. Accessible name:
  "Language: English. Switch to German" / "Sprache: Deutsch. Auf Englisch umschalten".
  Same size rules as the other buttons (≥ 44 px).
- The choice is saved (`sudoku.lang`, like the colour scheme) and wins over the device
  language from then on. An invalid stored value falls back to the device language.
- Switching is **live**, no reload: every text redraws, the dropdown options too,
  `<html lang>` switches (so VoiceOver pronounces German correctly), and the new
  language is announced ("Deutsch" / "English"). The game itself is not affected.
- **During coaching** the open Coach panel redraws in the new language: the current
  step is explained again from the start of the session's naming, so cell names start
  in long form again. The globe stays usable while the Coach is open (it does not
  change the board).
- The app name stays **Sudoku** (title, Home Screen) in both languages.

**Fixed terms.**
- **Levels:** **Jüngling / Padawan / Jedi** (English: Youngling / Padawan / Jedi;
  first decided as Leicht / Mittel / Schwer, changed the same day), also in the Coach
  title, e.g. "Naked Pair · Padawan".
- **Technique names stay English** in both languages (Naked Single, Hidden Single,
  Pointing, Claiming, Naked/Hidden Pair/Triple, X-Wing, Swordfish, XY-Wing); only the
  explanations are German. The texts are kept per language anyway, so German
  technique names can be added later by filling in the German table.
- **Cells:** "Reihe 4, Spalte 6" at first mention, then **"r4s6"** (r = Reihe,
  s = Spalte). Units: "Reihe 4", "Spalte 6", "Block 5"; plural "Reihen 2 und 7",
  "Spalten 1, 4 und 8". Lists: "4 und 8", "1, 2 und 3".
- **Colour schemes:** B/W, Klassisch Blau, Sepia, Nacht, Wald, Neon, Regenbogen.

**German texts (UI).**

| English | German |
|---|---|
| New Game | Neues Spiel |
| Level / Mistakes / Colours | Stufe / Fehler / Farben |
| Black & White, Classic Blue, Sepia, Dark, Forest, Neon, Rainbow | B/W, Klassisch Blau, Sepia, Nacht, Wald, Neon, Regenbogen |
| Hint / Coach | Hinweis / Coach |
| Close / Next / Fill | Schließen / Weiter / Eintragen |
| Help: n of 4 used | Hilfe: n von 4 genutzt |
| Sudoku board / Numbers | Sudoku-Spielfeld / Zahlen |
| Preparing puzzle… | Rätsel wird vorbereitet … |
| Tip: hold a number to add a note | Tipp: Zahl lang drücken für eine Notiz (shortened in L2: the longer text wrapped on 375 px phones) |
| Fix or clear the red digit first. | Zuerst die rote Ziffer korrigieren oder löschen. |
| Tap the same digit again to clear it. | Dieselbe Ziffer noch einmal tippen, um sie zu löschen. |
| Mistake n/3 · You may consider taking a hint next time. · OK | Fehler n/3 · Beim nächsten Mal hilft vielleicht ein Hinweis. · OK |
| You lost the game. · Play again? · Play Again | Spiel verloren. · Noch einmal spielen? · Neu spielen |
| Solved! · Well done. · New Game | Gelöst! · Gut gemacht. · Neues Spiel |
| Abandon this game? · Your progress in this game will be lost. · New Game · Cancel | Spiel beenden? · Der Fortschritt in diesem Spiel geht verloren. · Neues Spiel · Abbrechen |
| Step k of n | Schritt k von n |
| This step removes candidates; no cell can be filled yet. | Dieser Schritt entfernt Kandidaten; noch kann kein Feld gefüllt werden. |
| No technique from the list applies here. | Hier hilft keine Technik aus der Liste. |

**German texts (screen readers).**

| English | German |
|---|---|
| row r, column c, d, given / wrong / correct | Reihe r, Spalte c, d, vorgegeben / falsch / richtig |
| …, empty · notes 1 4 · candidates 4 8, 8 removed | …, leer · Notizen 1 4 · Kandidaten 4 8, 8 entfernt |
| Correct. · Wrong digit. n of 3 mistakes. · Three mistakes. You lost the game. · Solved! | Richtig. · Falsche Ziffer. n von 3 Fehlern. · Drei Fehler. Spiel verloren. · Gelöst! |
| Note added. · Note removed. · Digit cleared. | Notiz gesetzt. · Notiz entfernt. · Ziffer gelöscht. |
| Hint: d in X. · Hint: the wrong digit in X is removed. | Hinweis: d in X. · Hinweis: Die falsche Ziffer in X wird entfernt. |
| Coach: d in X. · The wrong digit in X is removed. | Coach: d in X. · Die falsche Ziffer in X wird entfernt. |
| (step announcement) "Step k of n. Title, Level. Note Text Next/Fill." | "Schritt k von n. Titel, Stufe. Hinweistext Text Weiter/Eintragen." |

**German Coach explanations** (same shapes as 3.4.1; `d` digit, `A`, `B`, `C` cells,
`U` unit; examples with real values):

| Technique | German text (shape) |
|---|---|
| Naked single | "A kann nur d sein: Jede andere Ziffer steht schon in ihrer Reihe, Spalte oder ihrem Block." (after eliminations: "A kann nur d sein: Alle anderen Kandidaten sind entfernt.") |
| Hidden single | "In U passt die d nur in A." – "In Block 5 passt die 7 nur in Reihe 4, Spalte 6." |
| Pointing | "In Block b kann die d nur in U stehen. Also wird die d aus dem Rest von U entfernt." |
| Claiming | "In U kann die d nur in Block b stehen. Also wird die d aus dem Rest von Block b entfernt." |
| Naked pair / triple | "A und B können nur d1 und d2 enthalten. Also werden d1 und d2 aus den anderen Feldern von U entfernt." (triple: "… können zusammen nur 1, 2 und 3 enthalten …") |
| Hidden pair / triple | "In U passen d1 und d2 nur in A und B. Also werden alle anderen Kandidaten aus diesen Feldern entfernt." |
| X-Wing / Swordfish | "In den Reihen 2 und 5 passt die 7 nur in die Spalten 2 und 9. Also steht die 7 in den Spalten 2 und 9 in diesen Reihen und wird aus dem Rest der Spalten 2 und 9 entfernt." (and transposed) |
| XY-Wing | "A kann nur x oder y sein. Ist es x, muss B die z sein; ist es y, muss C die z sein. In jedem Fall ist B oder C die z, also wird die z aus jedem Feld entfernt, das beide sieht." |

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

The step-4 solver doubles as the **hint engine** and the **Coach engine** (3.4.1):
it can name the next logical move, the technique and the cells involved.

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
    techniques.js       human solving techniques (singles … fish, wings), used for grading, hints and Coach
    coach.js            Coach chain (steps up to the next placement, pruned) and explanation texts (pure)
    i18n.js             text tables English / German, t(key, values), Coach phrases per language (pure)
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
  masks), `mistakes`, `hints`, `level`, `selected`, `lost`, `solved`. No history stack: nothing
  correct is ever undone. A cell is *locked* when `entries[i] === solution[i]`,
  *editable* when empty or wrong. Plain JSON, so save/restore is trivial.
- **Number buttons** (`numpad.js`): pointer events; `pointerdown` starts a ~350 ms
  timer, firing it toggles the note, `pointerup` before it enters the digit.
- **Generator isolation:** `generator.js` is plain ES module code, imported by
  the worker and by the node tests, with no DOM or worker APIs inside.
- **Colour schemes:** `data-scheme="bw"` on `<html>`; `themes.css` defines
  variables. Adding a scheme = adding one block + one dropdown entry. Neon and
  Rainbow add a few scheme-scoped effect rules at the end of `themes.css` (glow;
  box tints through a per-cell `--cell-bg` and the cell's `data-box`).
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
  highlight → error → popup → OK → 3 mistakes → lost → Play Again; Hint limit), **long press** on a number
  (pointer down, wait, up) vs. short tap, scheme/level/game persistence after
  reload, **offline test** (load once, `context.setOffline(true)`, reload, play,
  start a new game).
- **Manual:** on a real iPhone and iPad, including Add to Home Screen.

## 8. Accessibility and polish

- Visible focus and keyboard play on desktop (Shift+digit = note); ARIA labels on cells and buttons.
- Coach: the panel text is announced through the `aria-live` region; focus moves to
  **Next** / **Fill**; `Enter` activates it, `Esc` closes. Cell labels mention coaching
  candidates ("candidates 4 8, 8 removed").
- Colour is never the only signal: errors also get a bolder digit / a different
  background pattern in the B/W scheme (red alone is weak for colour-blind users).
- `prefers-reduced-motion`: no animation. Otherwise only subtle ones (selection fade, solved message).
- Haptics: none (apart from an optional vibrate on a long press where supported). Sound: none.
- All text in English and German (3.8), every string in the text tables of `i18n.js`;
  `<html lang>` follows the language.

## 9. Acceptance criteria (summary)

1. No ads, no network requests after the first load, no timer, no score anywhere.
2. Tap an empty cell → its row, column and box are highlighted.
3. Tap a filled cell → all identical digits are highlighted.
4. A wrong digit (≠ solution) is red and increments the mistake counter; a correct digit is locked and cannot be changed or noted; there are no Undo/Erase buttons.
5. Mistake 1 and 2 show a modal popup "Mistake i/3"; after **OK** the wrong digit fades out slowly. Mistake 3 loses the game: the board shakes, the page fades to grey, then a popup offers **Play Again**. At most **four hints** per game; the Hint button shows `n/4` and ignores taps after the fourth.
5a. Tap enters a digit, long press toggles a note; both only in an editable cell that is selected.
5b. Reloading the page restores the complete game, including notes, mistakes, hints used and a lost game.
6. Levels Beginner/Expert/Master produce puzzles with the clue ranges and techniques of section 4; every puzzle is unique and (by default) 180° symmetric.
7. A colour-scheme dropdown with B/W as default; the choice and the level survive a reload.
8. Layout fits an iPhone (6") and an iPad (10") in portrait without scrolling; iPad landscape uses the side panel.
9. After one online load, the game can be played to completion and a new game started with the device in airplane mode.
10. *New Game* appears in < 300 ms in the normal case (from the pool).
11. **Coach** (3.4.1): explains the easiest next move step by step (Next per
    elimination, Fill at the end), shows computed candidates only in the involved
    cells (removed ones red and struck through), hides and restores the user's notes,
    blocks input while open, and fills the cell like a Hint. Hint and Coach share
    one counter of four helps (dots); Close before Fill costs nothing. Works offline.
12. **German** (3.8): a German device starts in German, any other in English; the
    globe button (`🌐 EN` / `🌐 DE`) toggles live, also with the Coach open; every
    visible and screen-reader text is translated, technique names stay English;
    the choice survives a reload; works offline.

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
| Wrong digit | Mistake popup (1, 2) → OK → the digit fades out automatically; mistake 3 loses the game (3.4). After a reload a wrong digit still blocks all other cells until changed or cleared (3.2) |
| Undo / Erase buttons | Dropped – not needed (3.2) |
| Notes | No mode button; **long press** on a number toggles a note (3.2.1) |
| Hint | At most 4 per game, counter `n/4` on the button; reveals a digit (or empties a wrong one) in slow motion (3.4) |
| Game state | The complete game is saved and resumed (3.7) |
| Tap on a filled cell | Highlights identical digits **and** row, column, box (3.3) |
| Entry order | Cell first, then number; a number tap without a selected editable cell does nothing |
| Language / colours | English only at first (German added 2026-11-16, 3.8); start with B/W, Classic Blue, Sepia, Dark, Forest (3.6); Neon and Rainbow added 2026-11-16 |
| Clue ranges | Taken as proposed in section 4 (38–42 / 30–34 / 24–28), symmetry as in 5.3 |

### Confirmed (review round 2)

| Topic | Decision |
|---|---|
| Third mistake | The game is lost (shake, fade to grey, "Play Again"). Superseded: the earlier rule "Hint after game over → back to 2/3" is dropped. |
| Hint reveal | The hint **slowly fades in** the correct digit, with a brief pulsing outline on the cell, so the user sees where it was given. No textual explanation. |
| Long press | ~350 ms threshold and the first-run tip are accepted; they will be tuned after testing on a real device (the threshold lives in `config.js`). |

### Change request Coach (review round 3, 2026-11-15)

| Topic | Decision |
|---|---|
| Buttons | The tool row has two buttons, **Hint** and **Coach** (3.1). |
| Help limit | Hint and Coach together at most **4 per game**; one shared counter shown as four dots between the buttons, filled = used (3.4). |
| Which move | Always the easiest cell/technique on the whole board; the selection is ignored (3.4.1). |
| Filling | Coach fills the cell after the explanation (**Fill**), like a Hint. |
| Wrong digit | The mistake popup is confirmed first (one mistake); then Coach costs one help. After a reload a wrong digit is cleared first without extra cost. |
| Candidates | Computed candidates only in the cells involved; removed ones red and struck through, deciding ones in a neutral accent colour, bold. |
| User notes | Hidden while coaching, restored unchanged; the Coach never writes into them. |
| Chains | Every elimination step is confirmed with **Next**. |
| Close | Allowed at every step; costs nothing (peeking is allowed). Uses a help only on Fill. |
| Input while coaching | Board and number taps are blocked. |
| Cell names | First mention long ("row 4, column 6"), later short ("r4c6"). |
| Keyboard | `C` opens the Coach; `Enter` = Next/Fill, `Esc` = Close. |
| Short landscape | The explanation scrolls inside the panel. |
| No help left | Coach inactive, also for peeking (assumption, confirm in review). |

### Change request German (review round 4, 2026-11-16)

| Topic | Decision |
|---|---|
| Switch | Globe button in the header, label = current language (`🌐 EN` / `🌐 DE`), one tap toggles. |
| First start | Device language: `de…` → German, otherwise English; a saved choice wins. |
| Levels | Leicht / Mittel / Schwer (superseded the same day, see round 5). |
| Technique names | Stay English; the German table is ready for German names later. |
| Cell names | "Reihe 4, Spalte 6", short "r4s6" (r = Reihe, s = Spalte; confirmed). |
| During coaching | The panel redraws in the new language; names start long again. |
| Colour schemes | B/W, Klassisch Blau, Sepia, Nacht, Wald, Neon, Regenbogen. |
| Docs | README and design docs stay English. |
| Wording | German texts as listed in 3.8, reviewed; the New Game question is "Spiel beenden?". |

### Change request level names (review round 5, 2026-11-16)

| Topic | Decision |
|---|---|
| Level names | Star Wars flavour: **Youngling / Padawan / Jedi** in English, **Jüngling / Padawan / Jedi** in German (3.5, 3.8). |
| Coach title | Shows the same names ("Naked Pair · Padawan"). |
| Ids | `beginner` / `expert` / `master` unchanged in code, storage and tests; only the display names change. |
| Note | "Jedi" and "Padawan" are Lucasfilm trademarks; used only as level names in a free, ad-free hobby app, without logos, pictures or characters (owner's decision). |
