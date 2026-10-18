// Connects model and view: taps, long presses, keyboard, hint animation, dialogs.
// Phase 6 starts new games on the main thread; phase 7 adds levels, pool and persistence.
import { createView } from "./view.js";
import { newGame, select, enterDigit, toggleNote, hint } from "./game.js";
import { generate } from "./generator.js";
import { createRng } from "./rng.js";
import { LEVELS, DEFAULT_LEVEL, DEFAULT_SCHEME, HINT_ANIM_MS, HINT_ANIM_REDUCED_MS, TIP_KEY } from "./config.js";
import { safeGet, safeSet } from "./storage.js";

export function startApp(root) {
  const params = new URLSearchParams(location.search);
  const level = LEVELS.includes(params.get("level")) ? params.get("level") : DEFAULT_LEVEL;
  // ?seed=N makes the games reproducible: N, N+1, ... for the following New Games.
  let seedCounter = params.has("seed") ? Number(params.get("seed")) || 1 : null;
  const nextSeed = () => (seedCounter !== null ? seedCounter++ : Math.floor(Math.random() * 4294967296));
  const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = null, busy = false, tipShown = safeGet(TIP_KEY) === "1";

  const view = createView(root, {
    onCell: (i) => { if (!busy) { select(state, i); sync(); } },
    onDigit: (d) => act(() => enterDigit(state, state.selected, d)),
    onNote: (d) => act(() => {
      const r = toggleNote(state, state.selected, d);
      if (r === "on" && !tipShown) { tipShown = true; safeSet(TIP_KEY, "1"); }
      return r;
    }),
    onHint: () => doHint(),
    onNewGame: () => startNewGame(),
    onScheme: (id) => view.setScheme(id),
    onLevel: () => {}
  });

  function sync() {
    view.render(state);
    view.setTipVisible(!tipShown);
    view.showDialog(state.solved ? "solved" : state.dialogOpen ? "gameOver" : null);
  }

  // Runs an input action unless the game is busy animating a hint.
  function act(fn) {
    if (busy) return;
    fn();
    sync();
  }

  function doHint() {
    if (busy) return;
    const r = hint(state);
    if (r.kind === "ignored") { sync(); return; }
    const ms = reducedMotion() ? HINT_ANIM_REDUCED_MS : HINT_ANIM_MS;
    busy = true;
    view.setBusy(true);
    sync();
    if (r.kind === "cleared") view.animateClear(r.cell, r.digit, ms);
    else view.animateReveal(r.cell, ms);
    setTimeout(() => { busy = false; view.setBusy(false); }, ms);
  }

  function startNewGame() {
    if (busy) return;
    state = newGame(generate(state ? state.level : level, createRng(nextSeed())));
    sync();
  }

  document.addEventListener("keydown", (e) => {
    if (busy || e.ctrlKey || e.metaKey || e.altKey || state.dialogOpen || state.solved) return;
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

  view.setScheme(DEFAULT_SCHEME);
  startNewGame();
  root.dataset.ready = "true";
  return { view, getState: () => state };
}

