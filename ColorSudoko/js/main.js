(function () {
  "use strict";

  const PALETTES = ["classic", "glass", "autumn", "harbor"];
  const STORAGE_KEY = "colorSudoku.palette";
  const SCALE = 2; // canvas backing store pixels per logical pixel (45 units * 15px * 2 = 1350)
  const UNIT = 15 * SCALE;
  const POP_MS = 900;

  const ADJUST_KEY = "colorSudoku.adjust";
  const SLIDERS = ["saturation", "vibrance", "tint"];
  const LIMITS = { saturation: 100, vibrance: 100, tint: 180 };

  const $ = (id) => document.getElementById(id);
  const canvas = $("pattern");
  const ctx = canvas.getContext("2d");

  const state = {
    sudokus: null,
    layers: [true, true, true],
    numbers: false,
    focus: 0,
    anim: 0,
    adjust: { saturation: 0, vibrance: 0, tint: 0 },
  };

  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const p = [null];
    for (let d = 1; d <= 9; d++) {
      p.push(ColorSudokuColor.adjust(cs.getPropertyValue("--d" + d).trim(), state.adjust));
    }
    return p;
  }

  function render(progress) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ColorSudokuRender.draw(ctx, state.sudokus, {
      palette: palette(),
      unit: UNIT,
      layers: state.layers,
      numbers: state.numbers,
      focus: state.focus,
      progress: progress,
    });
  }

  function animate() {
    cancelAnimationFrame(state.anim);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return render(1);
    const t0 = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - t0) / POP_MS);
      render(p);
      if (p < 1) state.anim = requestAnimationFrame(frame);
    })(t0);
  }

  function newPattern() {
    state.sudokus = Sudoku.generate();
    animate();
  }

  function redraw() {
    cancelAnimationFrame(state.anim);
    render(1);
  }

  // ---- legend ----
  function buildLegend() {
    const legend = $("legend");
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d;
      b.dataset.digit = d;
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-label", "Highlight digit " + d);
      legend.appendChild(b);
    }
    legend.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const d = Number(b.dataset.digit);
      state.focus = state.focus === d ? 0 : d;
      legend.querySelectorAll("button").forEach((x) =>
        x.setAttribute("aria-pressed", String(Number(x.dataset.digit) === state.focus)));
      redraw();
    });
  }

  function paintLegend() {
    const p = palette();
    $("legend").querySelectorAll("button").forEach((b) => {
      const c = p[Number(b.dataset.digit)];
      b.style.background = c;
      b.style.color = ColorSudokuRender.luminance(c) > 0.6 ? "#1b1b1b" : "#fff";
    });
  }

  // ---- colour set ----
  function setPalette(name, persist) {
    document.documentElement.dataset.palette = name;
    $("palette").value = name;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* storage blocked */ }
    }
    paintLegend();
    if (state.sudokus) redraw();
  }

  // ---- saturation / vibrance / tint ----
  function loadAdjust() {
    try {
      const raw = JSON.parse(localStorage.getItem(ADJUST_KEY) || "null");
      if (raw && typeof raw === "object") {
        SLIDERS.forEach((k) => {
          const v = Number(raw[k]);
          if (Number.isFinite(v)) state.adjust[k] = Math.max(-LIMITS[k], Math.min(LIMITS[k], Math.round(v)));
        });
      }
    } catch (e) { /* storage blocked or corrupt */ }
  }

  function showAdjust() {
    SLIDERS.forEach((k) => {
      $(k).value = state.adjust[k];
      $(k + "-value").textContent = state.adjust[k] + (k === "tint" ? "°" : "");
    });
  }

  function applyAdjust(persist) {
    showAdjust();
    paintLegend();
    redraw();
    if (persist) {
      try { localStorage.setItem(ADJUST_KEY, JSON.stringify(state.adjust)); } catch (e) { /* ignore */ }
    }
  }

  // ---- PNG export ----
  function savePng() {
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext("2d");
    o.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff";
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "color-sudoku-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      $("status").textContent = "Saved.";
      setTimeout(() => { $("status").textContent = ""; }, 2000);
    }, "image/png");
  }

  // ---- wiring ----
  buildLegend();

  $("new").addEventListener("click", newPattern);
  $("save").addEventListener("click", savePng);
  $("numbers").addEventListener("change", (e) => { state.numbers = e.target.checked; redraw(); });
  document.querySelectorAll(".layer").forEach((cb) =>
    cb.addEventListener("change", () => { state.layers[Number(cb.dataset.layer)] = cb.checked; redraw(); }));
  $("palette").addEventListener("change", (e) => setPalette(e.target.value, true));
  document.addEventListener("keydown", (e) => {
    if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) newPattern();
  });

  SLIDERS.forEach((k) => $(k).addEventListener("input", (e) => {
    state.adjust[k] = Number(e.target.value);
    applyAdjust(true);
  }));
  $("reset-colours").addEventListener("click", () => {
    state.adjust = { saturation: 0, vibrance: 0, tint: 0 };
    applyAdjust(true);
  });

  loadAdjust();
  showAdjust();
  const initial = document.documentElement.dataset.palette;
  setPalette(PALETTES.indexOf(initial) >= 0 ? initial : "classic", false);
  newPattern();
})();
