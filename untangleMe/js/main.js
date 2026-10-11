// Wiring: boot, puzzle lifecycle, DOM controls, persistence.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  const root = document.documentElement;
  const cfg = UM.config;

  // Phones are too small for the board: show the notice and do not start.
  if (Math.min(screen.width, screen.height) < cfg.MIN_SCREEN_SIDE) {
    root.classList.add("too-small");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const els = {
    timer: $("timer"), moves: $("moves"), crossings: $("crossings"),
    presets: $("presets"), nodes: $("nodes"), nodesValue: $("nodes-value"),
    newPuzzle: $("new-puzzle"), reset: $("reset"),
    hints: $("hints"), hint: $("hint"), solve: $("solve"),
    copyLink: $("copy-link"), copyStatus: $("copy-status"), linkField: $("link-field"),
    markers: $("toggle-markers"), timerToggle: $("toggle-timer"), theme: $("theme")
  };

  const settings = UM.settings.load();
  const boardView = UM.view.createBoardView($("board"));
  const confetti = UM.confetti.createConfetti($("confetti"), {
    reducedMotion: () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)
  });
  const assistant = UM.assist.createAssistant();
  const BASE_TITLE = "Untangle Me";
  let game = null;
  let tickId = null;
  let copyTimer = null;

  function formatTime(ms) { return (ms / 1000).toFixed(1); }

  function saveSettings() { UM.settings.save(settings); }

  // ---- stats ----
  function renderStats(state) {
    els.moves.textContent = state.moves;
    els.crossings.textContent = state.crossings;
    els.hints.textContent = state.hints;
    const locked = state.status === "solved" || state.assisting;
    els.hint.disabled = els.solve.disabled = locked;
    els.timer.textContent = formatTime(state.elapsed);
    root.setAttribute("data-status", state.status);
    document.title = state.status === "solved" ? "✓ " + BASE_TITLE : BASE_TITLE;
  }

  // ---- puzzle lifecycle ----
  function syncSizeControls(n) {
    els.nodes.value = n;
    els.nodesValue.textContent = n;
    [].forEach.call(els.presets.children, (b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.n) === n));
    });
  }

  function startPuzzle(n, seed) {
    const puzzle = UM.puzzle.createPuzzle(n, seed);
    game = UM.game.createGame(puzzle);
    if (document.hidden) game.pause();
    assistant.cancel();
    confetti.stop();
    boardView.show(game);
    game.subscribe((e) => {
      renderStats(e.state);
      // A puzzle solved by the Solve button is not a win: no confetti.
      if (e.type === "solved" && !e.state.assisted) confetti.fire();
    });
    renderStats(game.getState());
    syncSizeControls(n);
    if (settings.nodes !== n) { settings.nodes = n; saveSettings(); }
    hideCopyFeedback();
  }

  // Makes (n, seed) the current puzzle and mirrors it into the URL hash.
  function go(n, seed) {
    const hash = UM.urlstate.serialise({ n: n, seed: seed });
    if (location.hash !== hash) history.replaceState(null, "", hash);
    startPuzzle(n, seed);
  }

  function newPuzzle(n) {
    const size = n === undefined ? game.puzzle.n : n;
    let seed = UM.rng.randomSeed();
    if (size === game.puzzle.n && seed === game.puzzle.seed) seed = (seed % cfg.MAX_RANDOM_SEED) + 1;
    go(size, seed);
  }

  // ---- copy link ----
  function hideCopyFeedback() {
    clearTimeout(copyTimer);
    els.copyStatus.textContent = "";
    els.linkField.hidden = true;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function copyLink() {
    const url = location.href;
    copyText(url).then((ok) => {
      if (ok) {
        els.linkField.hidden = true;
        els.copyStatus.textContent = "Copied";
        clearTimeout(copyTimer);
        copyTimer = setTimeout(hideCopyFeedback, 2000);
      } else {
        // Last resort: show the link so it can be copied by hand.
        els.copyStatus.textContent = "Copy this link:";
        els.linkField.hidden = false;
        els.linkField.value = url;
        els.linkField.focus();
        els.linkField.select();
      }
    });
  }

  // ---- view settings ----
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    els.theme.value = theme;
  }
  function applyTimerVisibility(show) {
    if (show) root.removeAttribute("data-timer"); else root.setAttribute("data-timer", "hidden");
    els.timerToggle.checked = show;
  }
  function applyMarkers(show) {
    els.markers.checked = show;
    boardView.setMarkers(show);
  }

  // ---- build static controls ----
  els.nodes.min = cfg.MIN_NODES;
  els.nodes.max = cfg.MAX_NODES;
  cfg.PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label + " · " + p.n;
    b.dataset.n = p.n;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => newPuzzle(p.n));
    els.presets.appendChild(b);
  });

  // ---- events ----
  els.newPuzzle.addEventListener("click", () => newPuzzle());
  els.reset.addEventListener("click", () => game.reset());
  els.hint.addEventListener("click", () => assistant.hint(game));
  els.solve.addEventListener("click", () => assistant.solve(game));
  els.copyLink.addEventListener("click", copyLink);

  els.nodes.addEventListener("input", () => { els.nodesValue.textContent = els.nodes.value; });
  els.nodes.addEventListener("change", () => newPuzzle(Number(els.nodes.value)));

  els.markers.addEventListener("change", () => {
    settings.showMarkers = els.markers.checked;
    saveSettings();
    applyMarkers(settings.showMarkers);
  });
  els.timerToggle.addEventListener("change", () => {
    settings.showTimer = els.timerToggle.checked;
    saveSettings();
    applyTimerVisibility(settings.showTimer);
  });
  els.theme.addEventListener("change", () => {
    settings.theme = els.theme.value;
    saveSettings();
    applyTheme(settings.theme);
  });

  document.addEventListener("visibilitychange", () => {
    if (!game) return;
    if (document.hidden) game.pause(); else game.resume();
  });

  window.addEventListener("hashchange", () => {
    const id = UM.urlstate.parse(location.hash, { defaultN: game.puzzle.n });
    if (id.seedFromUrl && (id.n !== game.puzzle.n || id.seed !== game.puzzle.seed)) go(id.n, id.seed);
  });

  // ---- boot ----
  applyTheme(settings.theme);
  applyTimerVisibility(settings.showTimer);
  applyMarkers(settings.showMarkers);
  const id = UM.urlstate.parse(location.hash, { defaultN: settings.nodes });
  go(id.n, id.seed);

  tickId = setInterval(() => {
    if (game) els.timer.textContent = formatTime(game.elapsed());
  }, 100);

  UM.app = {
    getGame: () => game,
    confetti: confetti,
    assistant: assistant,
    getSettings: () => Object.assign({}, settings),
    newPuzzle: newPuzzle,
    go: go
  };
})();
