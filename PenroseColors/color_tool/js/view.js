// Renders the tool into the page: SVG board, controls, status. The view holds no rules;
// the controller passes handlers in and calls the setters.
import { SLIDERS, MAPS, SEEDS, MAX_DEPTH } from "./config.js";
import { fit } from "./penrose.js";

/** @typedef {import("./types.js").Tile} Tile */
/** @typedef {import("./config.js").Settings} Settings */

const SVG = "http://www.w3.org/2000/svg";
const DRAG_START_PX = 6;

const LABELS = { wheel: "Wheel", half: "Half wheel", fan: "Fan", plane: "Plane", radial: "Radial", angular: "Angular" };

function template() {
  const options = (list) => list.map((v) => `<option value="${v}">${LABELS[v] || v}</option>`).join("");
  const depths = Array.from({ length: MAX_DEPTH }, (_, i) => i + 1).map((d) => `<option value="${d}">${d}</option>`).join("");
  const sliders = SLIDERS.map((s) => `
    <label class="slider" data-key="${s.key}">
      <span class="slider-head"><span>${s.label}</span><output id="out-${s.key}"></output></span>
      <input type="range" id="in-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
    </label>`).join("");
  return `
    <div class="app">
      <div class="stage" id="stage">
        <svg id="board" role="group" aria-label="Penrose tiling" tabindex="0"></svg>
      </div>
      <aside class="panel">
        <h1>Penrose Colors</h1>
        <section>
          <h2>Tiling</h2>
          <div class="row">
            <label class="field"><span>Seed</span><select id="seed" class="select">${options(SEEDS)}</select></label>
            <label class="field"><span>Depth</span><select id="depth" class="select">${depths}</select></label>
          </div>
          <p class="info" id="tile-info"></p>
        </section>
        <section>
          <h2>Colour</h2>
          <label class="field"><span>Mapping</span><select id="map" class="select">${options(MAPS)}</select></label>
          <div class="sliders">${sliders}</div>
          <p class="info" id="colour-info"></p>
        </section>
        <section>
          <h2>Puzzle</h2>
          <label class="slider">
            <span class="slider-head"><span>Target swaps (0 = full shuffle)</span><output id="out-sw"></output></span>
            <input type="range" id="in-sw" min="0" max="100" step="1">
          </label>
          <div class="buttons">
            <button type="button" class="btn primary" id="shuffle">Shuffle</button>
            <button type="button" class="btn" id="reset">Reset</button>
            <button type="button" class="btn" id="undo">Undo</button>
            <button type="button" class="btn" id="preview" aria-pressed="false">Sorted preview</button>
          </div>
          <p class="info" id="puzzle-info"></p>
        </section>
        <section>
          <button type="button" class="btn" id="copy">Copy link</button>
          <p class="info" id="message" role="status"></p>
        </section>
      </aside>
      <div class="sr-only" id="live" role="status" aria-live="polite"></div>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onSetting?: (key: string, value: string | number) => void,
 *   onShuffle?: () => void, onReset?: () => void, onUndo?: () => void,
 *   onPreview?: (on: boolean) => void, onCopy?: () => void,
 *   onTap?: (id: number) => void, onSwap?: (a: number, b: number) => void,
 *   onKey?: (key: string) => boolean
 * }} handlers
 */
export function createView(root, handlers = {}) {
  root.innerHTML = template();
  /** @type {(sel: string) => any} */
  const $ = (sel) => root.querySelector(sel);
  const board = /** @type {SVGSVGElement} */ ($("#board"));
  const stage = /** @type {HTMLElement} */ ($("#stage"));
  const ghost = document.createElementNS(SVG, "circle");
  ghost.setAttribute("class", "ghost");
  ghost.setAttribute("r", "18");
  ghost.setAttribute("visibility", "hidden");
  board.appendChild(ghost);

  /** @type {Tile[]} */
  let tiles = [];
  /** @type {SVGPolygonElement[]} */
  let polys = [];
  let announceFlip = false;
  let preview = false;

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  // ---- controls ----
  $("#seed").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("seed", e.target.value));
  $("#depth").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("depth", Number(e.target.value)));
  $("#map").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("map", e.target.value));
  for (const s of [...SLIDERS, { key: "sw" }]) {
    $("#in-" + s.key).addEventListener("input", (e) => {
      $("#out-" + s.key).textContent = e.target.value;
      if (handlers.onSetting) handlers.onSetting(s.key, Number(e.target.value));
    });
  }
  $("#shuffle").addEventListener("click", () => handlers.onShuffle && handlers.onShuffle());
  $("#reset").addEventListener("click", () => handlers.onReset && handlers.onReset());
  $("#undo").addEventListener("click", () => handlers.onUndo && handlers.onUndo());
  $("#copy").addEventListener("click", () => handlers.onCopy && handlers.onCopy());
  $("#preview").addEventListener("click", () => {
    preview = !preview;
    $("#preview").setAttribute("aria-pressed", String(preview));
    if (handlers.onPreview) handlers.onPreview(preview);
  });

  // ---- board: drag and drop, tap ----
  /** @type {{ id: number, x: number, y: number, pointerId: number, dragging: boolean } | null} */
  let press = null;
  const tileAt = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    const poly = el && el.closest ? el.closest(".tile") : null;
    return poly ? Number(poly.getAttribute("data-id")) : -1;
  };
  const toBoard = (e) => {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const clearDrag = () => {
    ghost.setAttribute("visibility", "hidden");
    for (const p of polys) p.classList.remove("dragging", "target");
  };

  board.addEventListener("pointerdown", (e) => {
    const poly = /** @type {Element} */ (e.target).closest(".tile");
    if (!poly || press) return;
    press = { id: Number(poly.getAttribute("data-id")), x: e.clientX, y: e.clientY, pointerId: e.pointerId, dragging: false };
    board.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_START_PX) {
      press.dragging = true;
      const from = polys[press.id];
      from.classList.add("dragging");
      ghost.setAttribute("fill", from.getAttribute("fill") || "#888");
      ghost.setAttribute("visibility", "visible");
      for (const p of polys) {
        const id = Number(p.getAttribute("data-id"));
        if (id !== press.id && tiles[id].type === tiles[press.id].type && !p.classList.contains("anchored")) p.classList.add("target");
      }
    }
    if (press.dragging) {
      const p = toBoard(e);
      ghost.setAttribute("cx", String(p.x));
      ghost.setAttribute("cy", String(p.y));
    }
  });
  const endPress = (e, cancelled) => {
    if (!press || e.pointerId !== press.pointerId) return;
    const was = press;
    press = null;
    if (board.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId);
    clearDrag();
    if (cancelled) return;
    if (was.dragging) {
      const to = tileAt(e.clientX, e.clientY);
      if (to >= 0 && to !== was.id && handlers.onSwap) handlers.onSwap(was.id, to);
    } else if (handlers.onTap) {
      handlers.onTap(was.id);
    }
  };
  board.addEventListener("pointerup", (e) => endPress(e, false));
  board.addEventListener("pointercancel", (e) => endPress(e, true));

  board.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (handlers.onKey && handlers.onKey(e.key)) e.preventDefault();
  });

  // ---- layout ----
  function layout() {
    const w = Math.max(50, stage.clientWidth), h = Math.max(50, stage.clientHeight);
    board.setAttribute("viewBox", `0 0 ${w} ${h}`);
    board.setAttribute("width", String(w));
    board.setAttribute("height", String(h));
    const f = fit(tiles, w, h);
    tiles.forEach((t, i) => {
      polys[i].setAttribute("points", t.pts.map((p) => (p.x * f.scale + f.dx).toFixed(2) + "," + (p.y * f.scale + f.dy).toFixed(2)).join(" "));
    });
  }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(layout).observe(stage);
  window.addEventListener("resize", layout);

  return {
    el: { board, stage },

    /** Builds the polygons for a new tiling. @param {Tile[]} list */
    setTiles(list) {
      for (const p of polys) p.remove();
      tiles = list;
      polys = list.map((t) => {
        const p = document.createElementNS(SVG, "polygon");
        p.setAttribute("class", "tile");
        p.setAttribute("data-id", String(t.id));
        p.setAttribute("data-type", t.type);
        board.insertBefore(p, ghost);
        return p;
      });
      layout();
    },

    /**
     * Sets the fill of every tile and the highlight classes.
     * @param {string[]} fills colour per tile id
     * @param {{ selected?: number, cursor?: number, anchored?: (i: number) => boolean }} [marks]
     */
    paint(fills, marks = {}) {
      polys.forEach((p, i) => {
        if (p.getAttribute("fill") !== fills[i]) p.setAttribute("fill", fills[i]);
        p.classList.toggle("selected", i === marks.selected);
        p.classList.toggle("cursor", i === marks.cursor);
        p.classList.toggle("anchored", !!(marks.anchored && marks.anchored(i)));
      });
    },

    /** @param {number} gap stroke width in px between tiles */
    setGap(gap) { board.style.setProperty("--gap", gap + "px"); },

    /** Shows the settings in the controls. @param {Settings} st @param {number} swMax */
    setSettings(st, swMax) {
      $("#seed").value = st.seed;
      $("#depth").value = String(st.depth);
      $("#map").value = st.map;
      for (const s of SLIDERS) {
        $("#in-" + s.key).value = String(st[s.key]);
        $("#out-" + s.key).textContent = String(st[s.key]);
        $(`.slider[data-key="${s.key}"]`).hidden = !s.maps.includes(st.map);
      }
      const sw = $("#in-sw");
      sw.max = String(Math.max(1, swMax));
      sw.value = String(st.sw);
      $("#out-sw").textContent = st.sw ? String(st.sw) : "full";
    },

    setInfo(which, text) { setText($("#" + which), text); },
    setMessage(text) { setText($("#message"), text); },
    setPreview(on) { preview = on; $("#preview").setAttribute("aria-pressed", String(on)); },
    setUndoEnabled(on) { $("#undo").setAttribute("aria-disabled", on ? "false" : "true"); },

    // Spoken by screen readers (polite live region); the zero-width flip repeats identical messages.
    announce(text) {
      announceFlip = !announceFlip;
      $("#live").textContent = text + (announceFlip ? "​" : "");
    },

    layout,
    focusBoard() { board.focus(); }
  };
}
