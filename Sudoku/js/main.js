// Entry point.
import { startApp } from "./controller.js";

startApp(document.getElementById("app"));

// Offline support: the service worker caches the app (needs https or localhost).
const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
if ("serviceWorker" in navigator && secure) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
}
