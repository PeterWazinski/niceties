import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { t, detectLang, isLang, LANGS, DEFAULT_LANG, keysOf } from "../../js/i18n.js";
import { TECHNIQUES } from "../../js/techniques.js";
import { LEVELS } from "../../js/config.js";
import { SCHEMES } from "../../js/schemes.js";

const JS = new URL("../../js/", import.meta.url);

test("languages: English and German, English is the default", () => {
  assert.deepEqual(LANGS, ["en", "de"]);
  assert.equal(DEFAULT_LANG, "en");
  assert.ok(isLang("en") && isLang("de"));
  assert.ok(!isLang("fr") && !isLang("") && !isLang(undefined) && !isLang("DE"));
});

test("device language: de, de-DE, de-AT → German; everything else → English", () => {
  for (const l of [["de"], ["de-DE"], ["de-AT", "en"], ["DE-ch"]]) assert.equal(detectLang(l), "de", String(l));
  for (const l of [["en-US"], ["fr-FR", "de-DE"], [], undefined, [""], [null, "en"]]) assert.equal(detectLang(l), "en", String(l));
  assert.equal(detectLang(["", "de-DE"]), "de", "the first non-empty entry decides");
});

test("t: plain strings, values, fallback to English, unknown keys", () => {
  assert.equal(t("en", "newGame"), "New Game");
  assert.equal(t("en", "help", { n: 2, max: 4 }), "Help: 2 of 4 used");
  assert.equal(t("en", "dlg.mistake.title", { n: 1, max: 3 }), "Mistake 1/3");
  assert.equal(t("fr", "newGame"), "New Game", "unknown language → English");
  assert.equal(t("de", "newGame"), t("de", "newGame"), "German falls back to English while a key is missing");
  assert.equal(t("en", "no.such.key"), "no.such.key");
});

test("every text key used in js/ exists in the English table", () => {
  const keys = new Set(keysOf("en"));
  const used = new Set();
  for (const f of readdirSync(JS).filter((n) => n.endsWith(".js"))) {
    const src = readFileSync(new URL(f, JS), "utf8");
    for (const m of src.matchAll(/\btr\(\s*"([\w.]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/\bt\(\s*\w+,\s*"([\w.]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/data-t(?:-label)?="([\w.]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/(?:title|text|primary): "([\w.]+)"/g)) used.add(m[1]);
    // ternaries: tr(cond ? "a" : "b")
    for (const m of src.matchAll(/\btr\([^()]*?\?\s*"([\w.]+)"\s*:\s*"([\w.]+)"/g)) { used.add(m[1]); used.add(m[2]); }
  }
  assert.ok(used.size > 30, `found ${used.size} keys`);
  for (const k of used) {
    if (k.endsWith(".")) continue; // prefix of a dynamic key ("tech." + name): next test
    assert.ok(keys.has(k), `missing English text "${k}"`);
  }
});

test("dynamic keys exist: every technique, level and colour scheme has a name", () => {
  const keys = new Set(keysOf("en"));
  for (const tech of TECHNIQUES) assert.ok(keys.has("tech." + tech.name), tech.name);
  for (const l of LEVELS) assert.ok(keys.has("level." + l), l);
  for (const s of SCHEMES) assert.ok(keys.has("scheme." + s.id), s.id);
});

test("no English text is empty", () => {
  for (const k of keysOf("en")) {
    const v = t("en", k, { n: 1, max: 4, r: 1, c: 1, u: 0, units: [0, 1], items: ["a", "b"], digits: "1 2", d: 5, k: 1, where: "x" });
    assert.ok(typeof v === "string" && v.length > 0, k);
  }
});
