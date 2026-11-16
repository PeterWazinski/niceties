// Entry point.
import { startApp } from "./controller.js";

startApp(document.getElementById("app"));

// Offline support: the service worker caches the app (needs https or localhost).
const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
if ("serviceWorker" in navigator && secure) {
  // A new version takes over (skipWaiting + clients.claim in sw.js): reload once, so a
  // release shows on the first open instead of the next one. Not on the very first
  // visit (no worker controlled the page yet), and never twice. The game is saved
  // after every move, so nothing is lost.
  let controlled = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // the first worker taking control (first visit) is not a new version
    if (!controlled) { controlled = true; return; }
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
}
