// Connects model and view: taps, long presses, keyboard, hint animation, dialogs,
// new games (pool + worker), settings and the saved game.
import { createView } from "./view.js";
import { newGame, select, enterDigit, toggleNote, clearCell, hint, hasWrong, isWrong } from "./game.js";
import { createGeneratorClient } from "./generator-client.js";
import { createPool } from "./pool.js";
import { createConfetti } from "./confetti.js";
import { loadSettings, saveScheme, saveLevel } from "./settings.js";
import { loadGame, saveGame, clearGame } from "./store.js";
import { safeGet, safeSet } from "./storage.js";
import { LEVELS, MAX_MISTAKES, HINT_ANIM_REDUCED_MS, HINT_ANIM_MS, LOSS_SHAKE_MS, LOSS_DIM_MS, LOSS_REDUCED_MS, TIP_KEY } from "./config.js";

const safeStorage = { getItem: safeGet, setItem: safeSet };

// Something to lose? An untouched board (or a finished game) needs no confirmation.
const BLOCKED_TEXT = "Fix or clear the red digit first.";
const CLEAR_TEXT = "Tap the same digit again to clear it.";

const hasProgress = (s) => !s.solved && (s.mistakes > 0 || s.entries.some(Boolean) || s.notes.some(Boolean));

export function startApp(root) {
  const params = new URLSearchParams(location.search);
  // ?seed=N is a test hook: puzzles are generated from N, N+1, ... (no pool), so games are reproducible.
  const deterministic = params.has("seed");
  let seedCounter = deterministic ? Number(params.get("seed")) || 1 : 0;
  const settings = loadSettings();
  const paramLevel = LEVELS.includes(params.get("level")) ? params.get("level") : null;
  const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const client = createGeneratorClient();
  const pool = createPool({
    storage: safeStorage,
    generate: (level) => client.generate(level, { options: { symmetry: "random" } })
  });

  let state = null;
  let celebrated = false;  // confetti already fired for this solved game
  let animating = false;   // a hint animation is running
  let lastMistakes = 0;    // mistake count after the previous input (a rise means a new mistake)
  let loading = false;     // a new puzzle is being prepared
  let mistakeShown = 0;    // number of the mistake whose popup is open, else 0
  let losing = false;      // the losing effect is running
  let pending = null;      // { run, cancel }: New Game waiting for the "abandon?" answer
  let tipShown = safeGet(TIP_KEY) === "1";
  const blocked = () => !state || animating || loading || mistakeShown > 0 || losing;

  const view = createView(root, {
    onCell: (i) => { if (!blocked() && !pending) { select(state, i); sync(); } },
    onDigit: (d) => act(() => say(enterDigit(state, state.selected, d))),
    onNote: (d) => act(() => {
      const r = toggleNote(state, state.selected, d);
      if (r === "on" && !tipShown) { tipShown = true; safeSet(TIP_KEY, "1"); }
      say(r === "on" ? "note" : r === "off" ? "noteOff" : r);
    }),
    onHint: () => doHint(),
    onNewGame: () => requestNewGame(state && state.level),
    onDialogNew: () => {
      if (pending) { const p = pending; pending = null; p.run(); }
      else if (mistakeShown) removeMistake();
      else startNewGame(state.level);
    },
    onDialogCancel: () => cancelPending(),
    onScheme: (id) => { view.setScheme(id); saveScheme(id); },
    onLevel: (level) => requestNewGame(level)
  });

  const confetti = createConfetti(view.el.confetti, { reducedMotion });

  function sync() {
    view.render(state);
    // a wrong digit stops the game: tell the player how to go on (how to clear it, or why other cells do not react)
    const stopped = hasWrong(state) && !state.lost && !state.solved && !mistakeShown;
    view.setNotice(!stopped ? null : isWrong(state, state.selected) ? CLEAR_TEXT : BLOCKED_TEXT);
    // confetti rain when the game has just been solved (not for a restored game: solved games are never saved)
    if (state.solved && !celebrated) { celebrated = true; confetti.fire(); }
    if (!state.solved) celebrated = false;
    view.setTipVisible(!tipShown);
    view.showDialog(pending ? "confirm" : state.solved ? "solved" : mistakeShown ? "mistake" : state.lost && !losing ? "lost" : null, mistakeShown);
    if (state.solved) clearGame(); else saveGame(state);
  }

  // Screen reader feedback for what just happened.
  function say(result) {
    const text = {
      correct: "Correct.",
      wrong: () => `Wrong digit. ${state.mistakes} of ${MAX_MISTAKES} mistakes.`,
      gameOver: "Three mistakes. You lost the game.",
      solved: "Solved!",
      note: "Note added.",
      noteOff: "Note removed.",
      cleared: "Digit cleared.",
      blocked: BLOCKED_TEXT
    }[result];
    if (text) view.announce(typeof text === "function" ? text() : text);
  }

  // Runs an input action unless the game is busy.
  function act(fn) {
    if (blocked() || pending) return;
    fn();
    if (state.lost && !losing) { losing = true; view.setBusy(true); sync(); lose(); return; }
    if (!state.lost && state.wrongOrder.length && !mistakeShown && state.mistakes > lastMistakes) mistakeShown = state.mistakes;
    lastMistakes = state.mistakes;
    sync();
  }

  // Third mistake: shake, fade to grey, then the "lost" popup.
  function lose() {
    const reduced = reducedMotion();
    view.playLoss(reduced ? 0 : LOSS_SHAKE_MS, reduced ? LOSS_REDUCED_MS : LOSS_DIM_MS, () => {
      losing = false;
      view.setBusy(false);
      sync();
    });
  }

  // After "OK" in the mistake popup the wrong digit fades out slowly.
  function removeMistake() {
    mistakeShown = 0;
    const cell = state.wrongOrder[state.wrongOrder.length - 1];
    const digit = state.entries[cell];
    if (clearCell(state, cell) !== "cleared") { sync(); return; }
    fadeOut(cell, digit);
  }

  function fadeOut(cell, digit) {
    const ms = reducedMotion() ? HINT_ANIM_REDUCED_MS : HINT_ANIM_MS;
    animating = true;
    view.setBusy(true);
    sync();
    view.animateClear(cell, digit, ms);
    setTimeout(() => { animating = false; view.setBusy(false); }, ms);
  }

  function doHint() {
    if (blocked() || pending) return;
    const r = hint(state);
    if (r.kind === "ignored") { sync(); return; }
    const ms = reducedMotion() ? HINT_ANIM_REDUCED_MS : HINT_ANIM_MS;
    animating = true;
    view.setBusy(true);
    sync();
    const where = `row ${Math.floor(r.cell / 9) + 1}, column ${(r.cell % 9) + 1}`;
    view.announce(r.kind === "cleared" ? `Hint: the wrong digit in ${where} is removed.` : `Hint: ${r.digit} in ${where}.`);
    if (r.kind === "cleared") view.animateClear(r.cell, r.digit, ms);
    else view.animateReveal(r.cell, ms);
    setTimeout(() => { animating = false; view.setBusy(false); }, ms);
  }

  // New game at `level`, asking first if the current game has progress.
  function requestNewGame(level) {
    if (blocked() || pending) return;
    if (state && hasProgress(state)) {
      pending = { run: () => startNewGame(level), cancel: () => {} };
      sync();
    } else {
      startNewGame(level);
    }
  }

  function cancelPending() {
    if (!pending) return;
    pending.cancel();
    pending = null;
    sync(); // also puts the level dropdown back
  }

  async function nextPuzzle(level) {
    if (deterministic) return client.generate(level, { seed: seedCounter++ });
    return pool.take(level);
  }

  async function startNewGame(level) {
    if (loading) return;
    loading = true;
    confetti.stop();
    saveLevel(level);
    // Show the "Preparing" note only if it takes a moment.
    const spinner = setTimeout(() => view.setPreparing(true), 150);
    try {
      state = newGame(await nextPuzzle(level));
      lastMistakes = 0;
    } finally {
      clearTimeout(spinner);
      view.setPreparing(false);
      loading = false;
    }
    sync();
    root.dataset.ready = "true";
    refillPool(level);
  }

  // Keeps one puzzle per level ready, current level first, without blocking the UI.
  function refillPool(level) {
    if (deterministic) return;
    const order = [level, ...LEVELS.filter((l) => l !== level)];
    setTimeout(() => { pool.refill(order).catch(() => {}); }, 300);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pending) { cancelPending(); return; }
    if (blocked() || pending || e.ctrlKey || e.metaKey || e.altKey || state.lost || state.solved) return;
    // typing in a dropdown (type-ahead, arrow keys) must not play the game
    if (e.target && e.target.tagName === "SELECT") return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      const d = Number(m[1]);
      act(() => {
        if (e.shiftKey) { const r = toggleNote(state, state.selected, d); say(r === "on" ? "note" : r === "off" ? "noteOff" : r); }
        else say(enterDigit(state, state.selected, d));
      });
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); act(() => say(clearCell(state, state.selected))); return; }
    if (e.key === "h" || e.key === "H") { e.preventDefault(); doHint(); return; }
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
    if (move) {
      e.preventDefault();
      const cur = state.selected;
      if (cur < 0) { select(state, 40); sync(); view.focusCell(40); return; }
      const next = cur + move;
      if (next < 0 || next > 80 || (Math.abs(move) === 1 && Math.floor(next / 9) !== Math.floor(cur / 9))) return;
      select(state, next);
      sync();
      view.focusCell(next);
    }
  });

  // Start: colour scheme, then the saved game or a new one.
  view.setScheme(settings.scheme);
  const saved = loadGame();
  if (saved) {
    state = saved;
    lastMistakes = state.mistakes;
    sync();
    root.dataset.ready = "true";
    refillPool(state.level);
  } else {
    startNewGame(paramLevel || settings.level);
  }
  return { view, getState: () => state };
}
