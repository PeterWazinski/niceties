(function () {
  "use strict";

  const W = 1000, H = 800, SCALE = 2; // logical size and backing store scale
  const DEGREES = [1, 2, 3, 4, 5];
  const PALETTES = ["classic", "sunset", "ink"];
  const SPEEDS = { instant: 0, fast: 2500, normal: 6000, slow: 12000 }; // whole tiling, ms
  const KEY = "ammannBeenker.settings";

  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");

  const state = { degree: 3, palette: "classic", speed: "fast", edges: true, tiles: [], drawn: 0, anim: 0 };

  // ---- settings ----
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s === "object") {
        if (DEGREES.indexOf(s.degree) >= 0) state.degree = s.degree;
        if (s.speed in SPEEDS) state.speed = s.speed;
        if (typeof s.edges === "boolean") state.edges = s.edges;
      }
    } catch (e) { /* storage blocked or corrupt */ }
    const p = document.documentElement.dataset.palette;
    if (PALETTES.indexOf(p) >= 0) state.palette = p;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ degree: state.degree, speed: state.speed, edges: state.edges }));
      localStorage.setItem("ammannBeenker.palette", state.palette);
    } catch (e) { /* ignore */ }
  }

  // ---- drawing ----
  function colours() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { sq: v("--sq"), rh: v("--rh"), edge: v("--edge"), paper: v("--paper") };
  }

  function drawTiles(from, to, c) {
    ctx.lineWidth = state.degree >= 5 ? 0.8 : state.degree === 4 ? 1.1 : 1.5; // finer lines for denser tilings
    ctx.lineJoin = "round";
    ctx.strokeStyle = c.edge;
    for (let i = from; i < to; i++) {
      const t = state.tiles[i], p = t.p;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      ctx.lineTo(p[4], p[5]);
      ctx.lineTo(p[6], p[7]);
      ctx.closePath();
      ctx.fillStyle = t.kind === AmmannBeenker.SQUARE ? c.sq : c.rh;
      ctx.fill();
      if (state.edges) ctx.stroke();
    }
  }

  function clear() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }

  // Redraws everything that has been revealed so far, without animation.
  function repaint() {
    clear();
    drawTiles(0, state.drawn, colours());
  }

  function animate() {
    cancelAnimationFrame(state.anim);
    clear();
    state.drawn = 0;
    const total = SPEEDS[state.speed];
    const n = state.tiles.length;
    if (!total || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.drawn = n;
      drawTiles(0, n, colours());
      return;
    }
    const c = colours();
    const t0 = performance.now();
    (function frame(now) {
      const target = Math.max(state.drawn, Math.min(n, Math.ceil(((now - t0) / total) * n)));
      drawTiles(state.drawn, target, c);
      state.drawn = target;
      if (target < n) state.anim = requestAnimationFrame(frame);
    })(t0);
  }

  function build() {
    state.tiles = AmmannBeenker.generate(state.degree, W, H);
    const squares = state.tiles.filter((t) => t.kind === AmmannBeenker.SQUARE).length;
    $("squares").textContent = squares;
    $("rhombi").textContent = state.tiles.length - squares;
    animate();
  }

  // ---- ui ----
  function paintSwatches() {
    const c = colours();
    $("sw-sq").style.background = c.sq;
    $("sw-rh").style.background = c.rh;
  }

  function showDegree() {
    document.querySelectorAll("#degrees button").forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.degree) === state.degree)));
  }

  function setDegree(d) {
    state.degree = d;
    showDegree();
    save();
    build();
  }

  function setPalette(name) {
    state.palette = name;
    document.documentElement.dataset.palette = name;
    $("palette").value = name;
    paintSwatches();
    save();
    // A running animation keeps its start colours; restart so the whole tiling matches.
    animate();
  }

  function savePng() {
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext("2d");
    o.fillStyle = colours().paper || "#fff";
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ammann-beenker-degree-" + state.degree + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      $("status").textContent = "Saved.";
      setTimeout(() => { $("status").textContent = ""; }, 2000);
    }, "image/png");
  }

  DEGREES.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d;
    b.dataset.degree = d;
    b.setAttribute("aria-label", "Degree " + d);
    b.addEventListener("click", () => setDegree(d));
    $("degrees").appendChild(b);
  });

  load();
  showDegree();
  $("speed").value = state.speed;
  $("edges").checked = state.edges;
  $("palette").value = state.palette;
  paintSwatches();

  $("redraw").addEventListener("click", animate);
  $("save").addEventListener("click", savePng);
  $("speed").addEventListener("change", (e) => { state.speed = e.target.value; save(); animate(); });
  $("edges").addEventListener("change", (e) => { state.edges = e.target.checked; save(); repaint(); });
  $("palette").addEventListener("change", (e) => setPalette(e.target.value));
  document.addEventListener("keydown", (e) => {
    if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) animate();
  });

  build();
})();
