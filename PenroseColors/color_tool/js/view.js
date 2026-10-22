// Renders the tool into the page: SVG board, controls, status. The view holds no rules;
// the controller passes handlers in and calls the setters.
import { SLIDERS, MAPS, CENTRES, SEEDS, MAX_DEPTH } from "./config.js";
import { fit } from "./penrose.js";

/** @typedef {import("./types.js").Tile} Tile */
/** @typedef {import("./config.js").Settings} Settings */

const SVG = "http://www.w3.org/2000/svg";
const DRAG_START_PX = 6;

const LABELS = {
  wheel: "Wheel", half: "Half wheel", fan: "Fan", plane: "Plane", radial: "Radial",
  bright: "Bright centre", dark: "Dark centre"
};

const SECTIONS_KEY = "penrose.sections"; // which panel sections are collapsed (a per-viewer convenience)

/** A panel section with a title that folds it. */
function section(id, title, body) {
  return `
        <section class="collapsible" data-section="${id}">
          <h2><button type="button" class="section-toggle" aria-expanded="true" aria-controls="body-${id}"><span>${title}</span><span class="chevron" aria-hidden="true"></span></button></h2>
          <div class="section-body" id="body-${id}">${body}</div>
        </section>`;
}

function template() {
  const options = (list) => list.map((v) => `<option value="${v}">${LABELS[v] || v}</option>`).join("");
  const depths = Array.from({ length: MAX_DEPTH }, (_, i) => i + 1).map((d) => `<option value="${d}">${d}</option>`).join("");
  const sliders = SLIDERS.map((s) => `
    <label class="slider" data-key="${s.key}">
      <span class="slider-head"><span>${s.label}</span><output id="out-${s.key}"></output></span>
      <input type="range" id="in-${s.key}" aria-label="${s.label}" min="${s.min}" max="${s.max}" step="${s.step}">
    </label>`).join("");
  const tiling = `
          <div class="row">
            <label class="field"><span>Seed</span><select id="seed" class="select">${options(SEEDS)}</select></label>
            <label class="field"><span>Depth</span><select id="depth" class="select">${depths}</select></label>
          </div>
          <p class="info" id="tile-info"></p>`;
  const colour = `
          <div class="row">
            <label class="field"><span>Mapping</span><select id="map" class="select">${options(MAPS)}</select></label>
            <label class="field" id="ctr-field"><span>Centre</span><select id="ctr" class="select">${options(CENTRES)}</select></label>
          </div>
          <label class="slider step-slider" id="step-field">
            <span class="slider-head"><span>Colour step between tiles</span><output id="out-step"></output></span>
            <input type="range" id="in-step" aria-label="Colour step between neighbouring tiles (saturation and lightness points)" min="0" max="20" step="0.1">
          </label>
          <div class="sliders">${sliders}</div>
          <p class="info" id="colour-info"></p>`;
  const anchors = `
          <div class="buttons">
            <button type="button" class="btn" id="edit-anchors" aria-pressed="false">Edit anchors</button>
            <button type="button" class="btn" id="default-anchors">Default anchors</button>
            <button type="button" class="btn" id="clear-anchors">Clear anchors</button>
          </div>
          <p class="info" id="unique-state"></p>
          <p class="info" id="unique-sym"></p>
          <p class="info" id="unique-anchors"></p>`;
  const puzzle = `
          <label class="slider">
            <span class="slider-head"><span>Target swaps (0 = full shuffle)</span><output id="out-sw"></output></span>
            <input type="range" id="in-sw" aria-label="Target swaps (0 = full shuffle)" min="0" max="100" step="1">
          </label>
          <div class="buttons one-row">
            <button type="button" class="btn primary" id="shuffle">Shuffle</button>
            <button type="button" class="btn" id="reset">Reset</button>
            <button type="button" class="btn" id="undo">Undo</button>
            <button type="button" class="btn" id="preview" aria-pressed="false" title="Show the sorted picture while on">Peek</button>
          </div>
          <p class="info" id="puzzle-info"></p>`;
  return `
    <div class="app">
      <div class="stage" id="stage">
        <svg id="board" role="group" aria-label="Penrose tiling" tabindex="0"></svg>
      </div>
      <aside class="panel">
        <h1>Penrose Colors</h1>${section("tiling", "Tiling", tiling)}${section("colour", "Colour", colour)}${section("anchors", "Anchors", anchors)}${section("puzzle", "Puzzle", puzzle)}
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
 *   onEditAnchors?: (on: boolean) => void, onDefaultAnchors?: () => void, onClearAnchors?: () => void,
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
  let editMode = false;
  /** @type {Map<number, SVGCircleElement>} */
  const dots = new Map();
  let lastFit = { scale: 1, dx: 0, dy: 0 };

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  // ---- controls ----
  $("#seed").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("seed", e.target.value));
  $("#depth").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("depth", Number(e.target.value)));
  $("#map").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("map", e.target.value));
  $("#ctr").addEventListener("change", (e) => handlers.onSetting && handlers.onSetting("ctr", e.target.value));
  for (const s of [...SLIDERS, { key: "sw" }]) {
    $("#in-" + s.key).addEventListener("input", (e) => {
      $("#out-" + s.key).textContent = e.target.value;
      if (handlers.onSetting) handlers.onSetting(s.key, Number(e.target.value));
    });
  }
  $("#in-step").addEventListener("input", (e) => {
    $("#out-step").textContent = Number(e.target.value).toFixed(1);
    if (handlers.onSetting) handlers.onSetting("step", Number(e.target.value));
  });
  $("#shuffle").addEventListener("click", () => handlers.onShuffle && handlers.onShuffle());
  $("#reset").addEventListener("click", () => handlers.onReset && handlers.onReset());
  $("#undo").addEventListener("click", () => handlers.onUndo && handlers.onUndo());
  $("#copy").addEventListener("click", () => handlers.onCopy && handlers.onCopy());
  $("#default-anchors").addEventListener("click", () => handlers.onDefaultAnchors && handlers.onDefaultAnchors());
  $("#clear-anchors").addEventListener("click", () => handlers.onClearAnchors && handlers.onClearAnchors());
  $("#edit-anchors").addEventListener("click", () => {
    editMode = !editMode;
    $("#edit-anchors").setAttribute("aria-pressed", String(editMode));
    board.classList.toggle("editing", editMode);
    if (handlers.onEditAnchors) handlers.onEditAnchors(editMode);
  });
  $("#preview").addEventListener("click", () => {
    preview = !preview;
    $("#preview").setAttribute("aria-pressed", String(preview));
    if (handlers.onPreview) handlers.onPreview(preview);
  });

  // ---- collapsible sections; the state is remembered in the browser if it allows ----
  /** @type {Record<string, boolean>} */
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(SECTIONS_KEY) || "{}") || {}; } catch (e) { collapsed = {}; }
  const fold = (name, closed) => {
    const sec = $(`.collapsible[data-section="${name}"]`);
    sec.classList.toggle("collapsed", closed);
    sec.querySelector(".section-toggle").setAttribute("aria-expanded", String(!closed));
    sec.querySelector(".section-body").hidden = closed;
  };
  for (const sec of root.querySelectorAll(".collapsible")) {
    const name = /** @type {HTMLElement} */ (sec).dataset.section;
    fold(name, !!collapsed[name]);
    sec.querySelector(".section-toggle").addEventListener("click", () => {
      const closed = !sec.classList.contains("collapsed");
      fold(name, closed);
      collapsed[name] = closed;
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(collapsed)); } catch (e) { /* not remembered */ }
    });
  }

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
    const draggable = !editMode && !polys[press.id].classList.contains("anchored");
    if (draggable && !press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_START_PX) {
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

  // ---- anchors are drawn as a dot on the tile ----
  /** @param {SVGCircleElement} dot @param {number} id */
  function placeDot(dot, id) {
    const t = tiles[id];
    dot.setAttribute("cx", (t.cx * lastFit.scale + lastFit.dx).toFixed(2));
    dot.setAttribute("cy", (t.cy * lastFit.scale + lastFit.dy).toFixed(2));
  }
  /** Black or white, whichever is readable on the colour. @param {string} hex */
  function contrast(hex) {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#000" : "#fff";
  }

  // ---- layout ----
  function layout() {
    const w = Math.max(50, stage.clientWidth), h = Math.max(50, stage.clientHeight);
    board.setAttribute("viewBox", `0 0 ${w} ${h}`);
    board.setAttribute("width", String(w));
    board.setAttribute("height", String(h));
    const f = fit(tiles, w, h);
    lastFit = f;
    tiles.forEach((t, i) => {
      polys[i].setAttribute("points", t.pts.map((p) => (p.x * f.scale + f.dx).toFixed(2) + "," + (p.y * f.scale + f.dy).toFixed(2)).join(" "));
    });
    for (const [id, dot] of dots) placeDot(dot, id);
  }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(layout).observe(stage);
  window.addEventListener("resize", layout);

  return {
    el: { board, stage },

    /** Builds the polygons for a new tiling. @param {Tile[]} list */
    setTiles(list) {
      for (const p of polys) p.remove();
      for (const d of dots.values()) d.remove();
      dots.clear();
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
        const anchored = !!(marks.anchored && marks.anchored(i));
        p.classList.toggle("anchored", anchored);
        let dot = dots.get(i);
        if (anchored && !dot) {
          dot = /** @type {SVGCircleElement} */ (document.createElementNS(SVG, "circle"));
          dot.setAttribute("class", "anchor-dot");
          dot.setAttribute("r", "5");
          board.insertBefore(dot, ghost);
          dots.set(i, dot);
          placeDot(dot, i);
        } else if (!anchored && dot) {
          dot.remove();
          dots.delete(i);
        }
        if (dot) dot.setAttribute("fill", contrast(fills[i]));
      });
    },

    /** @param {number} gap stroke width in px between tiles */
    setGap(gap) { board.style.setProperty("--gap", gap + "px"); },

    /**
     * Shows the settings in the controls.
     * @param {Settings} st @param {number} swMax
     * @param {{ value: number, max: number }} [step] the colour step between neighbouring tiles the slopes give
     */
    setSettings(st, swMax, step) {
      $("#seed").value = st.seed;
      $("#depth").value = String(st.depth);
      $("#map").value = st.map;
      $("#ctr").value = st.ctr;
      $("#ctr-field").hidden = st.map !== "radial";
      for (const s of SLIDERS) {
        $("#in-" + s.key).value = String(st[s.key]);
        $("#out-" + s.key).textContent = String(st[s.key]);
        $(`.slider[data-key="${s.key}"]`).hidden = !s.maps.includes(st.map);
      }
      if (step) {
        const input = $("#in-step");
        input.max = String(step.max);
        // the slider the user is moving keeps its position (the slopes are rounded to half points)
        if (document.activeElement !== input) input.value = String(step.value);
        $("#out-step").textContent = step.value.toFixed(1);
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
