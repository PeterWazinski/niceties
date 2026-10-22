// Colouring: HSL -> sRGB and the mappings from a tile position to a colour (PRD 5).
// The 8-bit sRGB value of a tile ("#rrggbb") is THE colour of the tile everywhere:
// display, comparison, ties.

/** @typedef {import("./types.js").Tile} Tile */
/** @typedef {import("./config.js").Settings} Settings */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * HSL to 8-bit sRGB.
 * @param {number} h hue in degrees (any value, wraps)
 * @param {number} s saturation 0..100
 * @param {number} l lightness 0..100
 * @returns {[number, number, number]}
 */
export function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100, ll = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** @param {[number, number, number]} rgb */
export function toHex(rgb) {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * RGB to HSL (degrees, percent), the inverse of hslToRgb.
 * @param {number} r @param {number} g @param {number} b 0..255
 * @returns {[number, number, number]}
 */
export function rgbToHsl(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [((h * 60) + 360) % 360, s * 100, l * 100];
}

/**
 * The colour of every tile (index = tile id) as "#rrggbb".
 *  - plane:   hue changes along u, saturation and lightness change along v (a plane through the HSL cone)
 *  - radial:  hue by the angle around the centre, saturation and lightness by the distance from it;
 *             `ctr` "bright" makes the centre light and the rim dark (for the default slopes), "dark" the opposite
 * (u, v) are the tile centre, centred and scaled by the larger half-extent into -1..1, then rotated by `rot`.
 * @param {Tile[]} tiles
 * @param {Settings} st
 * @returns {string[]}
 */
export function colourTiles(tiles, st) {
  if (!tiles.length) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) { x0 = Math.min(x0, t.cx); x1 = Math.max(x1, t.cx); y0 = Math.min(y0, t.cy); y1 = Math.max(y1, t.cy); }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const R = Math.max((x1 - x0) / 2, (y1 - y0) / 2) || 1;
  const rot = st.rot * Math.PI / 180, cos = Math.cos(rot), sin = Math.sin(rot);
  return tiles.map((t) => {
    const px = (t.cx - mx) / R, py = (t.cy - my) / R;
    const u = px * cos - py * sin, v = px * sin + py * cos;
    let hue, sat = st.s, lig = st.l;
    if (st.map === "plane") {
      hue = st.h0 + (st.h1 - st.h0) * (u + 1) / 2;
      sat += st.ds * v;
      lig += st.dl * v;
    } else {
      const angle = Math.atan2(v, u);                 // -pi..pi
      hue = st.h0 + (st.h1 - st.h0) * (angle / (2 * Math.PI) + 0.5);
      const r = clamp(Math.hypot(u, v), 0, 1);
      const k = (st.ctr === "dark" ? -1 : 1) * (2 * r - 1);
      sat += st.ds * k;
      lig += st.dl * k;
    }
    if (t.type === "thin") lig += st.dt;
    return toHex(hslToRgb(hue, sat, lig));
  });
}

/**
 * How many different colours there are, and which tiles share a colour.
 * @param {string[]} colours
 * @returns {{ distinct: number, ties: number[][] }}
 */
export function colourStats(colours) {
  /** @type {Map<string, number[]>} */
  const groups = new Map();
  colours.forEach((c, i) => {
    const g = groups.get(c);
    if (g) g.push(i); else groups.set(c, [i]);
  });
  return { distinct: groups.size, ties: [...groups.values()].filter((g) => g.length > 1) };
}
