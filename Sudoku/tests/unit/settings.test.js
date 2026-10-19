import test from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { newGame, enterDigit, toggleNote, serialize } from "../../js/game.js";

function install(initial = {}) {
  const m = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
  return m;
}
function installBroken() {
  const boom = () => { throw new Error("denied"); };
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
}

const { loadSettings, saveScheme, saveLevel, SCHEME_KEY, LEVEL_KEY } = await import("../../js/settings.js");
const { loadGame, saveGame, clearGame, GAME_KEY } = await import("../../js/store.js");

test("settings: defaults on a clean profile", () => {
  install();
  assert.deepEqual(loadSettings(), { scheme: "bw", level: "beginner" });
});

test("settings: saved values come back", () => {
  const m = install();
  saveScheme("sepia"); saveLevel("master");
  assert.equal(m.get(SCHEME_KEY), "sepia");
  assert.equal(m.get(LEVEL_KEY), "master");
  assert.deepEqual(loadSettings(), { scheme: "sepia", level: "master" });
});

test("settings: invalid stored values fall back to the defaults, invalid values are not saved", () => {
  const m = install({ [SCHEME_KEY]: "neon", [LEVEL_KEY]: "easy" });
  assert.deepEqual(loadSettings(), { scheme: "bw", level: "beginner" });
  saveScheme("neon"); saveLevel("easy");
  assert.equal(m.get(SCHEME_KEY), "neon", "unchanged: invalid value ignored");
  assert.equal(m.get(LEVEL_KEY), "easy");
});

test("settings: only the sudoku. prefix is used", () => {
  const m = install();
  saveScheme("dark"); saveLevel("expert");
  for (const k of m.keys()) assert.ok(k.startsWith("sudoku."), k);
});

test("settings and store survive a storage that throws", () => {
  installBroken();
  assert.deepEqual(loadSettings(), { scheme: "bw", level: "beginner" });
  assert.doesNotThrow(() => { saveScheme("dark"); saveLevel("master"); });
  const s = newGame(generate("beginner", createRng(1)));
  assert.doesNotThrow(() => saveGame(s));
  assert.equal(loadGame(), null);
  assert.doesNotThrow(() => clearGame());
});

test("store: a saved game is restored exactly, with notes, mistakes and an open dialog", () => {
  const m = install();
  const s = newGame(generate("beginner", createRng(5)));
  const empties = s.givens.map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
  enterDigit(s, empties[0], s.solution[empties[0]]);
  toggleNote(s, empties[1], 4);
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== s.solution[empties[2]]).slice(0, 3)) enterDigit(s, empties[2], d);
  assert.equal(s.dialogOpen, true);
  saveGame(s);
  assert.ok(m.has(GAME_KEY));
  assert.deepEqual(loadGame(), s);
});

test("store: corrupt data is dropped and removed", () => {
  const m = install({ [GAME_KEY]: "{not json" });
  assert.equal(loadGame(), null);
  assert.equal(m.has(GAME_KEY), false);
  const s = newGame(generate("beginner", createRng(2)));
  const bad = JSON.parse(serialize(s));
  bad.mistakes = 7;
  m.set(GAME_KEY, JSON.stringify(bad));
  assert.equal(loadGame(), null);
});

test("store: a solved game is not restored", () => {
  const m = install();
  const s = newGame(generate("beginner", createRng(3)));
  for (let i = 0; i < 81; i++) if (!s.givens[i]) enterDigit(s, i, s.solution[i]);
  assert.equal(s.solved, true);
  m.set(GAME_KEY, serialize(s));
  assert.equal(loadGame(), null);
  assert.equal(m.has(GAME_KEY), false);
});

test("store: nothing saved gives null", () => {
  install();
  assert.equal(loadGame(), null);
});
