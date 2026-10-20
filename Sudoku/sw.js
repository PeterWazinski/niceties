// Service worker: makes the game load and play offline (PRD 6).
// All app files are cached when the worker installs; afterwards they are served
// cache-first and refreshed in the background. Bump VERSION with every release.
const VERSION = "4";
// ?v=... only exists for the update test; a normal registration uses VERSION.
const CACHE = "sudoku-v" + (new URL(self.location.href).searchParams.get("v") || VERSION);

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/base.css",
  "css/themes.css",
  "js/config.js",
  "js/confetti.js",
  "js/controller.js",
  "js/game.js",
  "js/generator-client.js",
  "js/generator.js",
  "js/generator.worker.js",
  "js/grid.js",
  "js/highlight.js",
  "js/main.js",
  "js/numpad.js",
  "js/pool.js",
  "js/rng.js",
  "js/schemes.js",
  "js/settings.js",
  "js/solver.js",
  "js/storage.js",
  "js/store.js",
  "js/symmetry.js",
  "js/techniques.js",
  "js/view.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sudoku-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache key without the query string (the page is opened as index.html?seed=... in tests).
const keyFor = (url) => new Request(url.origin + url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(respond(event, req, url));
});

async function respond(event, req, url) {
  const cache = await caches.open(CACHE);
  const key = keyFor(url);
  const cached = await cache.match(key);
  const refresh = fetch(req).then((res) => {
    if (res && res.ok && res.type === "basic") cache.put(key, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  if (res) return res;
  // Offline and not cached: a navigation falls back to the app shell.
  if (req.mode === "navigate") {
    const shell = await cache.match(new Request(new URL("./", self.location).href));
    if (shell) return shell;
  }
  return new Response("offline", { status: 503, statusText: "offline" });
}
