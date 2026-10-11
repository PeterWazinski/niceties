const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/settings.js");
const UM = globalThis.UM;
const S = UM.settings;

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    data: data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); }
  };
}

const throwing = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("quota"); }
};

test("defaults: Blueprint, 8 nodes, timer visible", () => {
  assert.deepEqual(S.load(memoryStorage()), {
    theme: "blueprint", nodes: 8, showTimer: true
  });
});

test("save then load round trips", () => {
  const st = memoryStorage();
  const value = { theme: "neon", nodes: 14, showTimer: false };
  assert.equal(S.save(value, st), true);
  assert.deepEqual(S.load(st), value);
});

test("corrupt JSON falls back to defaults", () => {
  const st = memoryStorage({ [S.KEY]: "{not json" });
  assert.deepEqual(S.load(st), S.defaults());
});

test("storage that throws gives defaults and does not throw", () => {
  assert.deepEqual(S.load(throwing), S.defaults());
  assert.equal(S.save(S.defaults(), throwing), false);
});

test("missing storage (null) is tolerated", () => {
  assert.deepEqual(S.load(null), S.defaults());
  assert.equal(S.save(S.defaults(), null), false);
});

test("unknown theme falls back to Blueprint", () => {
  const st = memoryStorage({ [S.KEY]: JSON.stringify({ theme: "rainbow", nodes: 10 }) });
  const r = S.load(st);
  assert.equal(r.theme, "blueprint");
  assert.equal(r.nodes, 10);
});

test("node count is clamped; wrong types are ignored field by field", () => {
  const st = memoryStorage({
    [S.KEY]: JSON.stringify({ theme: "neon", nodes: 500, showTimer: false })
  });
  assert.deepEqual(S.load(st), { theme: "neon", nodes: 30, showTimer: false });
  const st2 = memoryStorage({ [S.KEY]: JSON.stringify({ nodes: "12" }) });
  assert.equal(S.load(st2).nodes, 8);
  const st3 = memoryStorage({ [S.KEY]: JSON.stringify({ nodes: 2 }) });
  assert.equal(S.load(st3).nodes, 6);
});

test("non-object stored values are ignored", () => {
  for (const v of ["null", "42", "\"text\"", "[1,2]"]) {
    assert.deepEqual(S.load(memoryStorage({ [S.KEY]: v })), S.defaults());
  }
});

test("save sanitises what it stores", () => {
  const st = memoryStorage();
  S.save({ theme: "bogus", nodes: 1000, showTimer: false, extra: "x" }, st);
  assert.deepEqual(JSON.parse(st.data[S.KEY]),
    { theme: "blueprint", nodes: 30, showTimer: false });
});
