// Entry point. Phase 5: a game from a seeded puzzle (?seed=&level=), cell selection
// and colour schemes. Input, new game flow and persistence follow in later phases.
import { createView } from "./view.js";
import { newGame, select } from "./game.js";
import { generate } from "./generator.js";
import { createRng } from "./rng.js";
import { LEVELS, DEFAULT_LEVEL, DEFAULT_SCHEME } from "./config.js";

const params = new URLSearchParams(location.search);
const level = LEVELS.includes(params.get("level")) ? params.get("level") : DEFAULT_LEVEL;
const seed = Number(params.get("seed")) || 12;

const state = newGame(generate(level, createRng(seed)));

const view = createView(document.getElementById("app"), {
  onCell(i) { select(state, i); view.render(state); },
  onScheme(id) { view.setScheme(id); }
});
view.setScheme(DEFAULT_SCHEME);
view.render(state);

document.getElementById("app").dataset.ready = "true";
