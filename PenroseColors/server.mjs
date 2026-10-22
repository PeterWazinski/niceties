// Tiny static file server for local use and for the e2e tests (ES modules and service workers need http, not file://).
// Start with start.cmd, or: node server.mjs   (PORT=1234 node server.mjs for another port)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4175;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store" // always the current files while developing
    });
    res.end(data);
  });
}).on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? "Port " + PORT + " is already in use (is the server already running?)" : e.message);
  process.exit(1);
}).listen(PORT, () => console.log("Penrose Colors: http://localhost:" + PORT + "/   (Ctrl+C or close this window to stop)"));
