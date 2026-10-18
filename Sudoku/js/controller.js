// Connects model and view: taps, long presses, keyboard, hint animation, dialogs,
// new games (pool + worker), settings and the saved game.
import { createView } from "./view.js";
import { newGame, select, enterDigit, toggleNote, hint } from "./game.js";
import { createGeneratorClient } from "./generator-client.js";
import { createPool } from "./pool.js";
import { loadSettings, saveScheme, saveLevel } from "./settings.js";
import { loadGame, saveGame, clearGame } from "./store.js";
import { safeGet, safeSet } from "./storage.js";
import { LEVELS, HINT_ANIM_MS, HINT_ANIM_REDUCED_MS, TIP_KEY } from "./config.js";

const safeStorage = { getItem: safeGet, setItem: safeSet };

// Something to lose? An untouched board (or a finished game) needs no confirmation.
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
  let animating = false;   // a hint animation is running
  let loading = false;     // a new puzzle is being prepared
  let pending = null;      // { run, cancel }: New Game waiting for the "abandon?" answer
  let tipShown = safeGet(TIP_KEY) === "1";
  const blocked = () => !state || animating || loading;

  const view = createView(root, {
    onCell: (i) => { if (!blocked() && !pending) { select(state, i); sync(); } },
    onDigit: (d) => act(() => enterDigit(state, state.selected, d)),
    onNote: (d) => act(() => {
      const r = toggleNote(state, state.selected, d);
      if (r === "on" && !tipShown) { tipShown = true; safeSet(TIP_KEY, "1"); }
      return r;
    }),
    onHint: () => doHint(),
    onNewGame: () => requestNewGame(state && state.level),
    onDialogNew: () => {
      if (pending) { const p = pending; pending = null; p.run(); } else startNewGame(state.level);
    },
    onDialogCancel: () => cancelPending(),
    onScheme: (id) => { view.setScheme(id); saveScheme(id); },
    onLevel: (level) => requestNewGame(level)
  });

  function sync() {
    view.render(state);
    view.setTipVisible(!tipShown);
    view.showDialog(pending ? "confirm" : state.solved ? "solved" : state.dialogOpen ? "gameOver" : null);
    if (state.solved) clearGame(); else saveGame(state);
  }

  // Runs an input action unless the game is busy.
  function act(fn) {
    if (blocked() || pending) return;
    fn();
    sync();
  }

  function doHint() {
    if (blocked() || pending) return;
    const r = hint(state);
    if (r.kind === "ignored") { sync(); return; }
    const ms = reducedMotion() ? HINT_ANIM_REDUCED_MS : HINT_ANIM_MS;
    animating = true;
    view.setBusy(true);
    sync();
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
    saveLevel(level);
    // Show the "Preparing" note only if it takes a moment.
    const spinner = setTimeout(() => view.setPreparing(true), 150);
    try {
      state = newGame(await nextPuzzle(level));
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
    if (blocked() || pending || e.ctrlKey || e.metaKey || e.altKey || state.dialogOpen || state.solved) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      const d = Number(m[1]);
      act(() => (e.shiftKey ? toggleNote(state, state.selected, d) : enterDigit(state, state.selected, d)));
      return;
    }
    if (e.key === "h" || e.key === "H") { e.preventDefault(); doHint(); return; }
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
    if (move) {
      e.preventDefault();
      const cur = state.selected;
      if (cur < 0) { select(state, 40); sync(); return; }
      const next = cur + move;
      if (next < 0 || next > 80 || (Math.abs(move) === 1 && Math.floor(next / 9) !== Math.floor(cur / 9))) return;
      select(state, next);
      sync();
    }
  });

  // Start: colour scheme, then the saved game or a new one.
  view.setScheme(settings.scheme);
  const saved = loadGame();
  if (saved) {
    state = saved;
    sync();
    root.dataset.ready = "true";
    refillPool(state.level);
  } else {
    startNewGame(paramLevel || settings.level);
  }
  return { view, getState: () => state };
}
