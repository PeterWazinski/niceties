// Settings <-> URL query (PRD 4.3). Invalid or unknown values fall back to the defaults.
import { DEFAULTS, SLIDERS, SEEDS, MAPS, CENTRES, MAX_DEPTH } from "./config.js";

/** @typedef {import("./config.js").Settings} Settings */

const num = (text, lo, hi) => {
  if (text === null || text === "" || !isFinite(Number(text))) return null;
  return Math.min(hi, Math.max(lo, Number(text)));
};

/**
 * @param {string} search e.g. "?seed=half&depth=4"
 * @returns {Settings}
 */
export function parseParams(search) {
  const q = new URLSearchParams(search);
  /** @type {Settings} */
  const st = { ...DEFAULTS };
  const seed = q.get("seed");
  if (seed && SEEDS.includes(seed)) st.seed = seed;
  const map = q.get("map");
  if (map && MAPS.includes(map)) st.map = map;
  const ctr = q.get("ctr");
  if (ctr && CENTRES.includes(ctr)) st.ctr = ctr;
  const depth = num(q.get("depth"), 1, MAX_DEPTH);
  if (depth !== null) st.depth = Math.round(depth);
  for (const sl of SLIDERS) {
    const v = num(q.get(sl.key), sl.min, sl.max);
    if (v !== null) st[sl.key] = v;
  }
  const shuffle = num(q.get("shuffle"), 0, 4294967295);
  if (shuffle !== null) st.shuffle = Math.round(shuffle);
  const sw = num(q.get("sw"), 0, 1000);
  if (sw !== null) st.sw = Math.round(sw);
  const anchors = q.get("anchors");
  if (anchors && /^(none|\d+(,\d+)*)$/.test(anchors)) st.anchors = anchors;
  return st;
}

/**
 * Only the values that differ from the defaults are written.
 * @param {Settings} st
 * @returns {string} query without the leading "?"
 */
export function serializeParams(st) {
  const q = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS)) {
    if (st[key] !== DEFAULTS[key]) q.set(key, String(st[key]));
  }
  return q.toString();
}

/**
 * Names of the URL parameters that were ignored or changed (unknown names, invalid or out-of-range values).
 * @param {string} search
 * @returns {string[]}
 */
export function ignoredParams(search) {
  const q = new URLSearchParams(search);
  const parsed = parseParams(search);
  /** @type {string[]} */
  const bad = [];
  for (const [key, value] of q.entries()) {
    if (!(key in DEFAULTS)) { bad.push(key); continue; }
    const same = String(parsed[key]) === value || (typeof DEFAULTS[key] === "number" && Number(value) === parsed[key]);
    if (!same) bad.push(key);
  }
  return bad;
}
