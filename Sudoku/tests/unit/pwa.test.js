import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const norm = (from, ref) => path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));

// The PRECACHE array of sw.js.
function precacheList() {
  const m = /const PRECACHE = \[([\s\S]*?)\];/.exec(read("sw.js"));
  assert.ok(m, "PRECACHE not found in sw.js");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// Every file the app really uses: what index.html, the manifest and the module graph reference.
function usedFiles() {
  const files = new Set(["index.html"]);
  const html = read("index.html");
  const queue = [];
  for (const m of html.matchAll(/(?:href|src)="([^":]+)"/g)) { files.add(m[1]); queue.push(m[1]); }
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons) files.add(icon.src);
  while (queue.length) {
    const f = queue.pop();
    if (!f.endsWith(".js")) continue;
    const src = read(f);
    for (const m of src.matchAll(/(?:from\s+|import\s+|new URL\()\s*"(\.{1,2}\/[^"]+)"/g)) {
      const dep = norm(f, m[1]);
      if (!files.has(dep)) { files.add(dep); queue.push(dep); }
    }
  }
  return files;
}

test("the precache list is exactly the set of files the app uses", () => {
  const list = precacheList();
  assert.ok(list.includes("./"), "the app shell URL ./ must be cached");
  const cached = new Set(list.filter((f) => f !== "./"));
  const used = usedFiles();
  assert.deepEqual([...cached].sort(), [...used].sort());
  assert.equal(list.length, new Set(list).size, "no duplicates");
});

test("every precached file exists", () => {
  for (const f of precacheList()) {
    if (f === "./") continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
});

test("the worker script is part of the used files (found through new URL)", () => {
  assert.ok(usedFiles().has("js/generator.worker.js"));
});

test("all js files of the app are used (no dead module forgotten in js/)", () => {
  const used = usedFiles();
  for (const f of fs.readdirSync(path.join(ROOT, "js"))) assert.ok(used.has("js/" + f), "js/" + f + " is not referenced");
});

test("sw.js: versioned cache name, cleans up old caches, only same-origin GET, scope-relative URLs", () => {
  const sw = read("sw.js");
  assert.match(sw, /const VERSION = "\d+";/);
  assert.match(sw, /"sudoku-v"/);
  assert.match(sw, /k\.startsWith\("sudoku-"\) && k !== CACHE/);
  assert.match(sw, /req\.method !== "GET"/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.doesNotMatch(sw, /"\/[a-z]/, "no root-absolute URLs (the app lives in a sub-path)");
  assert.doesNotMatch(sw, /https?:\/\//, "no external URLs");
});

test("no root-absolute or external URLs anywhere in the app files", () => {
  for (const f of ["index.html", "manifest.webmanifest", "css/base.css", "css/themes.css", ...fs.readdirSync(path.join(ROOT, "js")).map((x) => "js/" + x)]) {
    const src = read(f);
    assert.doesNotMatch(src, /(?:href|src|url\()\s*=?\s*["']?\/[a-z]/i, f + ": root-absolute URL");
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f + ": external URL");
  }
});

test("manifest: required fields, relative start_url and scope, icons exist", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  assert.equal(m.name, "Sudoku");
  assert.equal(m.start_url, "./");
  assert.equal(m.scope, "./");
  assert.equal(m.display, "standalone");
  assert.ok(m.background_color && m.theme_color);
  const sizes = m.icons.map((i) => i.sizes + ":" + i.purpose).sort();
  assert.deepEqual(sizes, ["192x192:any", "512x512:any", "512x512:maskable"]);
  for (const icon of m.icons) {
    assert.equal(icon.type, "image/png");
    assert.ok(!icon.src.startsWith("/"), "relative src");
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)), icon.src);
  }
});

test("icons are real PNGs of the declared size", () => {
  const dims = (f) => {
    const b = fs.readFileSync(path.join(ROOT, f));
    assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], f + " signature");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  assert.deepEqual(dims("icons/icon-192.png"), [192, 192]);
  assert.deepEqual(dims("icons/icon-512.png"), [512, 512]);
  assert.deepEqual(dims("icons/icon-maskable-512.png"), [512, 512]);
  assert.deepEqual(dims("icons/apple-touch-icon.png"), [180, 180]);
});

test("index.html links the manifest and the touch icon and has the iOS app meta tags", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="theme-color"/);
});
