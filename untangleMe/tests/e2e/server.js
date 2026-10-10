// Tiny static file server for the e2e tests (the game itself needs no server).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".ico": "image/x-icon"
};

if (process.env.LOG_REQUESTS) {
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (now - last > 1000) console.log(now, "EVENT LOOP BLOCKED for", now - last, "ms");
    last = now;
  }, 100);
}

http.createServer((req, res) => {
  if (process.env.LOG_REQUESTS) {
    const t0 = Date.now();
    console.log(t0, "->", req.url);
    res.on("finish", () => console.log(Date.now(), "<-", req.url, Date.now() - t0 + "ms"));
    res.on("close", () => { if (!res.writableFinished) console.log(Date.now(), "ABORTED", req.url); });
  }
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("serving " + ROOT + " on http://localhost:" + PORT));
