import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { t, detectLang, isLang, LANGS, DEFAULT_LANG, keysOf } from "../../js/i18n.js";
import { TECHNIQUES } from "../../js/techniques.js";
import { LEVELS } from "../../js/config.js";
import { SCHEMES } from "../../js/schemes.js";
import { generate } from "../../js/generator.js";
import { createRng } from "../../js/rng.js";
import { coachChain, explain, cellNamer } from "../../js/coach.js";

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
  assert.equal(t("de", "newGame"), "Neues Spiel");
  assert.equal(t("de", "tech.xWing"), "X-Wing", "technique names fall back to English");
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

// ---- German (L2) ------------------------------------------------------------------

const VALUES = { n: 2, max: 4, r: 4, c: 6, u: 22, units: [1, 4], items: ["a", "b", "c"], digits: "1 2", d: 5, k: 1, where: "x",
  cell: "A", unit: "U", box: "B", line: "L", cells: "C", triple: true, base: "Reihen 2 und 5", cover: "Spalten 2 und 9",
  P: "P", x: 1, y: 2, A: "A", B: "B", A2: "A2", B2: "B2", p1: 1, p2: 2 };

test("German has every English key except the technique names (they stay English, PRD 3.8)", () => {
  const en = keysOf("en"), de = new Set(keysOf("de"));
  for (const k of en) {
    if (k.startsWith("tech.")) assert.ok(!de.has(k), `${k} stays English`);
    else assert.ok(de.has(k), `missing German text "${k}"`);
  }
  for (const k of de) assert.ok(en.includes(k), `German-only key "${k}"`);
});

test("German texts are filled, take the same values as English, and contain no placeholders left over", () => {
  for (const k of keysOf("de")) {
    const v = t("de", k, VALUES);
    assert.ok(typeof v === "string" && v.length > 0, k);
    assert.doesNotMatch(v, /undefined|NaN|\$\{/, k);
    assert.equal(typeof t("en", k, VALUES), "string");
  }
});

test("German UI texts of PRD 3.8", () => {
  assert.equal(t("de", "help", { n: 2, max: 4 }), "Hilfe: 2 von 4 genutzt");
  assert.equal(t("de", "dlg.mistake.title", { n: 1, max: 3 }), "Fehler 1/3");
  assert.equal(t("de", "dlg.confirm.title"), "Spiel beenden?");
  assert.deepEqual(LEVELS.map((l) => t("de", "level." + l)), ["Leicht", "Mittel", "Schwer"]);
  assert.deepEqual(SCHEMES.map((s) => t("de", "scheme." + s.id)), ["B/W", "Klassisch Blau", "Sepia", "Nacht", "Wald", "Neon", "Regenbogen"]);
  assert.equal(t("de", "cell.pos", { r: 4, c: 6 }), "Reihe 4, Spalte 6");
  assert.equal(t("de", "coach.step", { k: 1, n: 3 }), "Schritt 1 von 3");
  assert.equal(t("de", "lang.code"), "DE");
  assert.equal(t("en", "lang.code"), "EN");
});

const at = (r, c) => r * 9 + c;
const de = (step, opts = {}) => explain(step, cellNamer("de"), { ...opts, lang: "de" });

test("German Coach: cell names long then short (r4s6), per session", () => {
  const name = cellNamer("de");
  assert.equal(name(at(3, 5)), "Reihe 4, Spalte 6");
  assert.equal(name(at(3, 5)), "r4s6");
  assert.equal(cellNamer("de")(at(3, 5)), "Reihe 4, Spalte 6");
});

test("German Coach: singles, pointing, claiming", () => {
  const ns = { technique: "nakedSingle", cell: at(3, 5), digit: 7 };
  assert.deepEqual(de(ns), {
    title: "Naked Single", level: "Leicht",
    text: "Reihe 4, Spalte 6 kann nur 7 sein: Jede andere Ziffer steht schon in ihrer Reihe, Spalte oder ihrem Block."
  });
  assert.equal(de(ns, { afterEliminations: true }).text, "Reihe 4, Spalte 6 kann nur 7 sein: Alle anderen Kandidaten sind entfernt.");
  assert.equal(de({ technique: "hiddenSingle", cell: at(3, 5), digit: 7, unit: 22 }).text, "In Block 5 passt die 7 nur in Reihe 4, Spalte 6.");
  const p = { technique: "pointing", digit: 5, box: 18, line: 9, cells: [], eliminations: [] };
  assert.deepEqual(de(p), { title: "Pointing", level: "Mittel",
    text: "In Block 1 kann die 5 nur in Spalte 1 stehen. Also wird die 5 aus dem Rest von Spalte 1 entfernt." });
  const c = { technique: "claiming", digit: 2, line: 4, box: 21, cells: [], eliminations: [] };
  assert.equal(de(c).text, "In Reihe 5 kann die 2 nur in Block 4 stehen. Also wird die 2 aus dem Rest von Block 4 entfernt.");
});

test("German Coach: subsets", () => {
  const np = { technique: "nakedPair", cells: [at(1, 2), at(1, 6)], digits: [4, 8], unit: 1, eliminations: [] };
  assert.equal(de(np).text,
    "Reihe 2, Spalte 3 und Reihe 2, Spalte 7 können nur 4 und 8 enthalten. Also werden 4 und 8 aus den anderen Feldern von Reihe 2 entfernt.");
  const nt = { technique: "nakedTriple", cells: [0, 1, 2], digits: [1, 2, 3], unit: 18, eliminations: [] };
  assert.match(de(nt).text, /können zusammen nur 1, 2 und 3 enthalten\. Also werden 1, 2 und 3 aus den anderen Feldern von Block 1 entfernt\.$/);
  const hp = { technique: "hiddenPair", cells: [at(0, 4), at(8, 4)], digits: [3, 9], unit: 13, eliminations: [] };
  assert.equal(de(hp).text,
    "In Spalte 5 passen 3 und 9 nur in Reihe 1, Spalte 5 und Reihe 9, Spalte 5. Also werden alle anderen Kandidaten aus diesen Feldern entfernt.");
});

test("German Coach: fish and XY-Wing", () => {
  const xw = { technique: "xWing", digit: 7, base: [1, 4], cover: [10, 17], cells: [], eliminations: [] };
  assert.deepEqual(de(xw), { title: "X-Wing", level: "Schwer",
    text: "In den Reihen 2 und 5 passt die 7 nur in die Spalten 2 und 9. Also steht die 7 in den Spalten 2 und 9 in diesen Reihen und wird aus dem Rest der Spalten 2 und 9 entfernt." });
  const sf = { technique: "swordfish", digit: 3, base: [9, 12, 16], cover: [0, 4, 8], cells: [], eliminations: [] };
  assert.equal(de(sf).text,
    "In den Spalten 1, 4 und 8 passt die 3 nur in die Reihen 1, 5 und 9. Also steht die 3 in den Reihen 1, 5 und 9 in diesen Spalten und wird aus dem Rest der Reihen 1, 5 und 9 entfernt.");
  const bits = (...ds) => ds.reduce((m, d) => m | (1 << (d - 1)), 0);
  const p = at(2, 2), a = at(2, 5), b = at(5, 2);
  const step = { technique: "xyWing", pivot: p, pincers: [a, b], digit: 6, cells: [p, a, b], eliminations: [],
    shown: { [p]: bits(2, 9), [a]: bits(9, 6), [b]: bits(2, 6) } };
  assert.equal(de(step).text,
    "Reihe 3, Spalte 3 kann nur 2 oder 9 sein. Ist es 9, muss Reihe 3, Spalte 6 die 6 sein; ist es 2, muss Reihe 6, Spalte 3 die 6 sein. " +
    "In jedem Fall ist r3s6 oder r6s3 die 6, also wird die 6 aus jedem Feld entfernt, das beide sieht.");
});

test("German Coach texts for real chains: no gaps, no English unit words", () => {
  for (const level of ["expert", "master"]) {
    for (let seed = 1; seed <= 8; seed++) {
      const g = generate(level, createRng(seed)).givens.slice();
      for (let k = 0; k < 25 && g.includes(0); k++) {
        const { steps, placement } = coachChain(g);
        const name = cellNamer("de");
        steps.forEach((s, i) => {
          const { text, level: lv } = explain(s, name, { afterEliminations: i > 0, lang: "de" });
          assert.doesNotMatch(text, /undefined|NaN|\brow\b|\bcolumn\b|\bbox\b| and /, text);
          assert.ok(["Leicht", "Mittel", "Schwer"].includes(lv));
        });
        g[placement.cell] = placement.digit;
      }
    }
  }
});
