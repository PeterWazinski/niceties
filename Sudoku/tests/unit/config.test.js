import test from "node:test";
import assert from "node:assert/strict";
import { MAX_MISTAKES, LONG_PRESS_MS, LEVELS, LEVEL_CONFIG, DEFAULT_LEVEL, DEFAULT_SCHEME } from "../../js/config.js";

test("game constants match the PRD", () => {
  assert.equal(MAX_MISTAKES, 3);
  assert.equal(LONG_PRESS_MS, 350);
  assert.equal(DEFAULT_SCHEME, "bw");
  assert.equal(DEFAULT_LEVEL, "beginner");
});

test("three levels with ascending difficulty and descending clues", () => {
  assert.deepEqual(LEVELS, ["beginner", "expert", "master"]);
  assert.deepEqual(LEVEL_CONFIG.beginner, { minClues: 38, maxClues: 42 });
  assert.deepEqual(LEVEL_CONFIG.expert, { minClues: 30, maxClues: 34 });
  assert.deepEqual(LEVEL_CONFIG.master, { minClues: 24, maxClues: 28 });
  for (const l of LEVELS) assert.ok(LEVEL_CONFIG[l].minClues <= LEVEL_CONFIG[l].maxClues);
});
