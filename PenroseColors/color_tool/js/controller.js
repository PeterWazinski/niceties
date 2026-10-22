// Connects settings, tiling, colouring, puzzle and view; keeps the URL in step.
import { generate } from "./penrose.js";
import { colourTiles, colourStats } from "./color.js";
import { parseParams, serializeParams } from "./params.js";
import { createPuzzle } from "./puzzle.js";
import { createRng } from "./rng.js";
import { createView } from "./view.js";
import { MAX_TILES, WARN_TILES } from "./config.js";

/** @typedef {import("./types.js").Tile} Tile */

const REFUSED = "Only tiles of the same shape can swap colours.";

/** @param {HTMLElement} root */
export function startApp(root) {
  let settings = parseParams(location.search);
  /** @type {Tile[]} */
  let tiles = [];
  /** @type {string[]} */
  let colours = [];
  let puzzle = createPuzzle([]);
  let selected = -1;      // tile selected for a two-tap swap
  let cursor = -1;        // keyboard position
  let preview = false;
  let tooMany = false;

  const view = createView(root, {
    onSetting: (key, value) => setSetting(key, value),
    onShuffle: () => { settings.shuffle = 1 + Math.floor(Math.random() * 1e9); applyShuffle(); syncUrl(); refresh(); },
    onReset: () => { settings.shuffle = 0; applyShuffle(); syncUrl(); refresh(); view.announce("Sorted."); },
    onUndo: () => { if (puzzle.undo()) { selected = -1; refresh(); view.announce("Swap undone."); } },
    onPreview: (on) => { preview = on; refresh(); },
    onCopy: copyLink,
    onTap: (id) => tap(id),
    onSwap: (a, b) => swap(a, b),
    onKey: (key) => keyboard(key)
  });

  function syncUrl() {
    const q = serializeParams(settings);
    history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
  }

  function applyShuffle() {
    selected = -1;
    puzzle.reset();
    if (!settings.shuffle) return;
    const rng = createRng(settings.shuffle);
    if (settings.sw > 0) puzzle.shuffleSwaps(rng, settings.sw); else puzzle.shuffleFull(rng);
  }

  /** A new tiling (seed or depth changed, or at the start). */
  function rebuild() {
    const patch = generate(settings.seed, settings.depth);
    tooMany = patch.tiles.length > MAX_TILES;
    tiles = tooMany ? [] : patch.tiles;
    puzzle = createPuzzle(tiles.map((t) => t.type));
    cursor = -1;
    view.setTiles(tiles);
    recolour();
    applyShuffle();
    refresh();
  }

  /** The colours changed (a slider moved), the tiling did not. */
  function recolour() {
    colours = colourTiles(tiles, settings);
    view.setGap(settings.gap);
    view.setSettings(settings, Math.max(1, puzzle.capacity()));
  }

  function refresh() {
    const fills = tiles.map((_, i) => colours[preview ? i : puzzle.perm[i]]);
    view.paint(fills, { selected, cursor, anchored: (i) => puzzle.isAnchored(i) });
    const thick = tiles.filter((t) => t.type === "thick").length;
    const stats = colourStats(colours);
    view.setInfo("tile-info", tooMany
      ? `More than ${MAX_TILES} tiles: lower the depth.`
      : `${tiles.length} tiles (${thick} thick, ${tiles.length - thick} thin)` +
        (tiles.length > WARN_TILES ? ` · more than ${WARN_TILES}: too many for a puzzle` : ""));
    view.setInfo("colour-info", `${stats.distinct} different colours · ${stats.ties.reduce((s, g) => s + g.length, 0)} tiles share a colour`);
    const shuffled = settings.shuffle > 0 || puzzle.moves > 0;
    const state = !shuffled ? "Sorted" : puzzle.solved(colours) ? "Solved!" : "Not solved";
    view.setInfo("puzzle-info", `${state} · swaps made ${puzzle.moves} · minimum swaps needed ${puzzle.minimumSwaps()}`);
    view.setUndoEnabled(puzzle.moves > 0);
    if (state === "Solved!" && shuffled && !preview) view.announce("Solved!");
  }

  /** @param {string} key @param {string | number} value */
  function setSetting(key, value) {
    settings[key] = value;
    if (key === "seed" || key === "depth") {
      syncUrl();
      rebuild();
      return;
    }
    if (key === "sw") {
      if (settings.shuffle) applyShuffle();
    }
    recolour();
    syncUrl();
    refresh();
  }

  function swap(a, b) {
    const r = puzzle.swap(a, b);
    if (r === "refused") { view.setMessage(REFUSED); view.announce(REFUSED); return; }
    if (r !== "ok") return;
    view.setMessage("");
    selected = -1;
    refresh();
    view.announce(puzzle.solved(colours) ? "Swapped. Solved!" : "Swapped.");
  }

  function tap(id) {
    cursor = id;
    if (puzzle.isAnchored(id)) return;
    if (selected < 0) { selected = id; refresh(); return; }
    if (selected === id) { selected = -1; refresh(); return; }
    swap(selected, id);
  }

  /** Arrow keys move to the neighbouring tile in that direction; Enter or Space selects/swaps. */
  function keyboard(key) {
    if (!tiles.length) return false;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (cursor < 0) {
      let best = 0, bestD = Infinity;
      tiles.forEach((t, i) => { const d = Math.hypot(t.cx, t.cy); if (d < bestD) { bestD = d; best = i; } });
      cursor = best;
      refresh();
      if (dirs[key] || key === "Enter" || key === " ") return true;
      return false;
    }
    if (dirs[key]) {
      const [dx, dy] = dirs[key];
      const here = tiles[cursor];
      let best = -1, bestScore = 0.2; // needs a clear lean towards the direction
      for (const id of here.neighbours) {
        const vx = tiles[id].cx - here.cx, vy = tiles[id].cy - here.cy;
        const score = (vx * dx + vy * dy) / Math.hypot(vx, vy);
        if (score > bestScore) { bestScore = score; best = id; }
      }
      if (best >= 0) { cursor = best; refresh(); view.announce(`${tiles[best].type} tile ${best + 1}`); }
      return true;
    }
    if (key === "Enter" || key === " ") { tap(cursor); return true; }
    if (key === "Escape") { selected = -1; refresh(); return true; }
    return false;
  }

  async function copyLink() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      view.setMessage("Link copied.");
    } catch (e) {
      try {
        const area = document.createElement("textarea");
        area.value = url;
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        view.setMessage(ok ? "Link copied." : "Could not copy: " + url);
      } catch (e2) {
        view.setMessage("Could not copy: " + url);
      }
    }
  }

  rebuild();
  root.dataset.ready = "true";
  return { view, getSettings: () => settings };
}
