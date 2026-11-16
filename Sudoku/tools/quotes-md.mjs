// Reads the quote lists from design/quotes-en.md and design/quotes-de.md (PRD 3.9).
// Shared by tools/make-quotes.mjs (writes js/quotes.js) and the unit test that keeps
// js/quotes.js and the two files in sync.
import fs from "node:fs";

// The "## " sections of each file, in this order.
export const LISTS = ["won", "lost", "mistake1", "mistake2"];

// { won: [{ text, by }], ... } from one file; by = speaker after " — " or null.
export function parseQuotes(markdown) {
  const out = {};
  let k = -1;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) { k++; out[LISTS[k]] = []; continue; }
    const m = /^(\d+)\.\s+(.*)$/.exec(line);
    if (!m || k < 0) continue;
    const dash = m[2].lastIndexOf(" — ");
    const text = (dash < 0 ? m[2] : m[2].slice(0, dash)).trim();
    const by = dash < 0 ? null : m[2].slice(dash + 3).trim();
    out[LISTS[k]].push({ n: Number(m[1]), text, by });
  }
  return out;
}

// Both files merged: { won: [{ en, de, by: { en, de } | null }], ... }.
export function readQuotes(designDir) {
  const en = parseQuotes(fs.readFileSync(new URL("quotes-en.md", designDir), "utf8"));
  const de = parseQuotes(fs.readFileSync(new URL("quotes-de.md", designDir), "utf8"));
  const merged = {};
  for (const list of LISTS) {
    if (!en[list] || !de[list]) throw new Error(`list "${list}" missing`);
    if (en[list].length !== de[list].length) throw new Error(`list "${list}": ${en[list].length} English, ${de[list].length} German entries`);
    merged[list] = en[list].map((q, i) => {
      const g = de[list][i];
      if (q.n !== i + 1 || g.n !== i + 1) throw new Error(`list "${list}": numbering broken at ${i + 1}`);
      if (!q.by !== !g.by) throw new Error(`list "${list}" no. ${i + 1}: speaker in one language only`);
      return { en: q.text, de: g.text, by: q.by ? { en: q.by, de: g.by } : null };
    });
  }
  return merged;
}
