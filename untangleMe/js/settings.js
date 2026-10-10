// Persisted player preferences (localStorage). Never throws: storage can be
// missing, full or blocked (private mode), and stored data can be corrupt.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") require("./config.js");

  const KEY = "untangleMe.settings";

  function defaults() {
    const c = UM.config;
    return { theme: c.DEFAULT_THEME, nodes: c.DEFAULT_NODES, showMarkers: true, showTimer: true };
  }

  function defaultStorage() {
    try { return globalThis.localStorage || null; } catch (e) { return null; }
  }

  // Merges untrusted data over the defaults, field by field.
  function sanitise(raw) {
    const c = UM.config, out = defaults();
    if (!raw || typeof raw !== "object") return out;
    if (c.THEMES.indexOf(raw.theme) >= 0) out.theme = raw.theme;
    if (Number.isInteger(raw.nodes)) out.nodes = Math.max(c.MIN_NODES, Math.min(c.MAX_NODES, raw.nodes));
    if (typeof raw.showMarkers === "boolean") out.showMarkers = raw.showMarkers;
    if (typeof raw.showTimer === "boolean") out.showTimer = raw.showTimer;
    return out;
  }

  function load(storage) {
    try {
      const s = storage === undefined ? defaultStorage() : storage;
      const text = s ? s.getItem(KEY) : null;
      return sanitise(text ? JSON.parse(text) : null);
    } catch (e) {
      return defaults();
    }
  }

  // Returns true if the settings were stored.
  function save(settings, storage) {
    try {
      const s = storage === undefined ? defaultStorage() : storage;
      if (!s) return false;
      s.setItem(KEY, JSON.stringify(sanitise(settings)));
      return true;
    } catch (e) {
      return false;
    }
  }

  UM.settings = { KEY: KEY, defaults: defaults, sanitise: sanitise, load: load, save: save };
})();
