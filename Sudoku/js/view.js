// Renders the game into the page (PRD 3.1, 3.3). The view only reads the game
// state; all rules live in game.js. Handlers are passed in by the controller.
import { highlights } from "./highlight.js";
import { cellValue, isGiven, isWrong, isEditable, remaining } from "./game.js";
import { MAX_MISTAKES, LEVELS } from "./config.js";
import { attachNumpad } from "./numpad.js";

export const SCHEMES = [
  { id: "bw", name: "Black & White", themeColor: "#ffffff" },
  { id: "blue", name: "Classic Blue", themeColor: "#ffffff" },
  { id: "sepia", name: "Sepia", themeColor: "#f4ecd8" },
  { id: "dark", name: "Dark", themeColor: "#121417" },
  { id: "forest", name: "Forest", themeColor: "#f3f7f1" }
];

const LEVEL_NAMES = { beginner: "Beginner", expert: "Expert", master: "Master" };

const BULB = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21h6M10 17h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function template() {
  const options = (list) => list.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  const cells = Array.from({ length: 81 }, (_, i) => {
    const notes = Array.from({ length: 9 }, () => "<span></span>").join("");
    return `<button type="button" class="cell" data-i="${i}" data-r="${Math.floor(i / 9)}" data-c="${i % 9}">` +
      `<span class="digit"></span><span class="notes" aria-hidden="true">${notes}</span></button>`;
  }).join("");
  const nums = Array.from({ length: 9 }, (_, k) =>
    `<button type="button" class="num" data-digit="${k + 1}">${k + 1}</button>`).join("");
  return `
    <div class="app">
      <h1 class="title">Sudoku</h1>
      <button type="button" class="btn primary" id="new-game">New Game</button>
      <div class="status">
        <label class="field"><span class="field-label">Level</span>
          <select id="level" class="select">${options(LEVELS.map((l) => [l, LEVEL_NAMES[l]]))}</select></label>
        <div class="field mistakes"><span class="field-label">Mistakes</span>
          <span class="mistakes-value" id="mistakes" aria-live="polite">0/${MAX_MISTAKES}</span></div>
        <label class="field"><span class="field-label">Colours</span>
          <select id="scheme" class="select">${options(SCHEMES.map((s) => [s.id, s.name]))}</select></label>
      </div>
      <div class="board" id="board" role="group" aria-label="Sudoku board">${cells}</div>
      <button type="button" class="btn tool" id="hint">${BULB}<span>Hint</span></button>
      <div class="numpad" id="numpad" role="group" aria-label="Numbers">${nums}</div>
      <p class="tip" id="tip" hidden>Tip: hold a number to add a note</p>
    </div>
    <div class="overlay" id="overlay" hidden>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text">
        <h2 id="dialog-title"></h2>
        <p id="dialog-text"></p>
        <div class="dialog-actions">
          <button type="button" class="btn primary" id="dialog-new">New Game</button>
          <button type="button" class="btn" id="dialog-hint">Hint</button>
        </div>
      </div>
    </div>`;
}

const DIALOGS = {
  gameOver: { title: "Three mistakes.", text: "Start a new game, or take a hint and carry on.", hint: true },
  solved: { title: "Solved!", text: "Well done.", hint: false }
};

function cellLabel(state, i) {
  const pos = `row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}`;
  const v = cellValue(state, i);
  if (v) return `${pos}, ${v}, ${isGiven(state, i) ? "given" : isWrong(state, i) ? "wrong" : "correct"}`;
  const notes = [];
  for (let d = 1; d <= 9; d++) if (state.notes[i] & (1 << (d - 1))) notes.push(d);
  return `${pos}, empty` + (notes.length ? `, notes ${notes.join(" ")}` : "");
}

export function createView(root, handlers = {}) {
  root.innerHTML = template();
  const $ = (sel) => root.querySelector(sel);
  const cells = [...root.querySelectorAll(".cell")];
  const nums = [...root.querySelectorAll(".num")];
  const el = {
    app: $(".app"), board: $("#board"), numpad: $("#numpad"), mistakes: $("#mistakes"),
    level: $("#level"), scheme: $("#scheme"), newGame: $("#new-game"), hint: $("#hint"), tip: $("#tip"),
    overlay: $("#overlay"), dialogTitle: $("#dialog-title"), dialogText: $("#dialog-text"),
    dialogNew: $("#dialog-new"), dialogHint: $("#dialog-hint")
  };
  let dialogKind = null;

  el.board.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (cell && handlers.onCell) handlers.onCell(Number(cell.dataset.i));
  });
  el.scheme.addEventListener("change", () => handlers.onScheme && handlers.onScheme(el.scheme.value));
  el.level.addEventListener("change", () => handlers.onLevel && handlers.onLevel(el.level.value));
  el.newGame.addEventListener("click", () => handlers.onNewGame && handlers.onNewGame());
  el.hint.addEventListener("click", () => handlers.onHint && handlers.onHint());
  el.dialogNew.addEventListener("click", () => handlers.onNewGame && handlers.onNewGame());
  el.dialogHint.addEventListener("click", () => handlers.onHint && handlers.onHint());
  attachNumpad(nums, {
    onTap: (d) => handlers.onDigit && handlers.onDigit(d),
    onHold: (d) => handlers.onNote && handlers.onNote(d)
  });

  // Keep Tab inside the dialog while it is open.
  el.overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const buttons = [...el.overlay.querySelectorAll("button")].filter((b) => !b.hidden);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  return {
    cells, nums, el,

    setScheme(id) {
      const scheme = SCHEMES.find((s) => s.id === id) || SCHEMES[0];
      document.documentElement.dataset.scheme = scheme.id;
      el.scheme.value = scheme.id;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", scheme.themeColor);
    },

    setTipVisible(visible) { el.tip.hidden = !visible; },
    setBusy(busy) { el.app.dataset.busy = busy ? "true" : "false"; },

    // kind: "gameOver" | "solved" | null (hide)
    showDialog(kind) {
      if (kind === dialogKind) return;
      dialogKind = kind;
      const open = kind !== null;
      el.overlay.hidden = !open;
      el.app.inert = open;
      if (!open) return;
      const d = DIALOGS[kind];
      el.dialogTitle.textContent = d.title;
      el.dialogText.textContent = d.text;
      el.dialogHint.hidden = !d.hint;
      el.overlay.dataset.kind = kind;
      (d.hint ? el.dialogHint : el.dialogNew).focus();
    },

    // The wrong digit fades out slowly while the cell is already empty in the state.
    animateClear(cell, digit, ms) {
      const ghost = document.createElement("span");
      ghost.className = "ghost";
      ghost.textContent = String(digit);
      ghost.style.setProperty("--anim", ms + "ms");
      cells[cell].appendChild(ghost);
      setTimeout(() => ghost.remove(), ms);
    },

    // The revealed digit fades in slowly and the cell pulses so the user sees where it landed.
    animateReveal(cell, ms) {
      const c = cells[cell];
      c.style.setProperty("--anim", ms + "ms");
      c.classList.add("reveal");
      setTimeout(() => c.classList.remove("reveal"), ms + 600);
    },

    render(state) {
      const h = highlights(state);
      cells.forEach((cell, i) => {
        const v = cellValue(state, i);
        const kind = isGiven(state, i) ? "given" : v ? (isWrong(state, i) ? "wrong" : "locked") : "empty";
        cell.dataset.state = kind;
        cell.dataset.value = v ? String(v) : "";
        cell.querySelector(".digit").textContent = v ? String(v) : "";
        cell.classList.toggle("sel", h.sel.has(i));
        cell.classList.toggle("peer", h.peer.has(i));
        cell.classList.toggle("same", h.same.has(i));
        cell.classList.toggle("conflict", h.conflict.has(i));
        cell.setAttribute("aria-label", cellLabel(state, i));
        cell.setAttribute("aria-pressed", h.sel.has(i) ? "true" : "false");
        const marks = cell.querySelectorAll(".notes span");
        marks.forEach((m, k) => { m.textContent = !v && (state.notes[i] & (1 << k)) ? String(k + 1) : ""; });
      });
      el.mistakes.textContent = `${state.mistakes}/${MAX_MISTAKES}`;
      el.level.value = state.level;
      nums.forEach((n) => n.classList.toggle("done", remaining(state, Number(n.dataset.digit)) === 0));
      // Number buttons only act on an editable selected cell: dim them otherwise.
      el.numpad.classList.toggle("inactive", !(state.selected >= 0 && isEditable(state, state.selected)));
    }
  };
}
