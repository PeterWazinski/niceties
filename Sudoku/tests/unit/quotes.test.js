import test from "node:test";
import assert from "node:assert/strict";
import { QUOTES, QUOTE_LISTS, quoteText, createQuoteDeck } from "../../js/quotes.js";
import { createRng } from "../../js/rng.js";
import { readQuotes, parseQuotes } from "../../tools/quotes-md.mjs";

const DESIGN = new URL("../../design/", import.meta.url);

test("js/quotes.js matches design/quotes-en.md and quotes-de.md (run tools/make-quotes.mjs after editing them)", () => {
  assert.deepEqual(QUOTES, readQuotes(DESIGN));
});

test("four lists: won, lost, mistake 1, mistake 2 – each with quotes in both languages", () => {
  assert.deepEqual(QUOTE_LISTS, ["won", "lost", "mistake1", "mistake2"]);
  for (const list of QUOTE_LISTS) {
    assert.ok(QUOTES[list].length >= 5, `${list}: ${QUOTES[list].length}`);
    for (const [i, q] of QUOTES[list].entries()) {
      const where = `${list} no. ${i + 1}`;
      for (const lang of ["en", "de"]) {
        assert.ok(q[lang] && q[lang].trim() === q[lang], `${where} ${lang} filled, no stray spaces`);
        assert.ok(q[lang].length <= 120, `${where} ${lang} short enough for the popup`);
        assert.ok(!q[lang].includes(" — "), `${where} ${lang}: speaker not split off`);
      }
      if (q.by) for (const lang of ["en", "de"]) assert.ok(q.by[lang], `${where} speaker in ${lang}`);
    }
  }
});

test("the draft has 25 quotes per list and real film lines in every list", () => {
  for (const list of QUOTE_LISTS) {
    assert.equal(QUOTES[list].length, 25, list);
    assert.ok(QUOTES[list].some((q) => q.by), `${list} has real lines`);
    assert.ok(QUOTES[list].some((q) => !q.by), `${list} has parodies`);
  }
});

test("parser: speaker after ' — ', numbering, sections in order", () => {
  const md = "# x\n\n## A\n\n1. Hello there. — Obi-Wan Kenobi\n2. Plain line.\n\n## B\n\n1. One\n## C\n## D\n";
  const p = parseQuotes(md);
  assert.deepEqual(p.won, [{ n: 1, text: "Hello there.", by: "Obi-Wan Kenobi" }, { n: 2, text: "Plain line.", by: null }]);
  assert.deepEqual(p.lost, [{ n: 1, text: "One", by: null }]);
  assert.deepEqual(p.mistake1, []);
});

test("quoteText: text and speaker per language, English fallback, unknown entries", () => {
  const real = QUOTES.won.findIndex((q) => q.by);
  const en = quoteText("won", real, "en"), de = quoteText("won", real, "de");
  assert.equal(en.text, QUOTES.won[real].en);
  assert.equal(de.text, QUOTES.won[real].de);
  assert.equal(de.by, QUOTES.won[real].by.de);
  const parody = QUOTES.won.findIndex((q) => !q.by);
  assert.equal(quoteText("won", parody, "en").by, null);
  assert.equal(quoteText("won", real, "fr").text, QUOTES.won[real].en);
  assert.equal(quoteText("won", 999, "en"), null);
  assert.equal(quoteText("nope", 0, "en"), null);
});

test("deck: every quote once per round, no repeat across rounds, per list", () => {
  const deck = createQuoteDeck(createRng(5));
  for (const list of QUOTE_LISTS) {
    const n = QUOTES[list].length;
    let prev = -1;
    for (let round = 0; round < 6; round++) {
      const seen = new Set();
      for (let k = 0; k < n; k++) {
        const i = deck.draw(list);
        assert.ok(i >= 0 && i < n);
        assert.notEqual(i, prev, `${list}: the same quote twice in a row`);
        seen.add(i);
        prev = i;
      }
      assert.equal(seen.size, n, `${list}: round ${round} uses every quote once`);
    }
  }
});

test("deck: reproducible with the same seed, different with another", () => {
  const draw = (seed) => { const d = createQuoteDeck(createRng(seed)); return Array.from({ length: 10 }, () => d.draw("lost")); };
  assert.deepEqual(draw(42), draw(42));
  assert.notDeepEqual(draw(42), draw(43));
});
