// Renders the game into the page (PRD 3.1, 3.3). The view only reads the game
// state; all rules live in game.js. Handlers are passed in by the controller.
import { highlights } from "./highlight.js";
import { cellValue, isGiven, isWrong, isEditable, remaining } from "./game.js";
import { MAX_MISTAKES, MAX_HINTS, LEVELS } from "./config.js";
import { attachNumpad } from "./numpad.js";
import { SCHEMES } from "./schemes.js";

export { SCHEMES };

const LEVEL_NAMES = { beginner: "Beginner", expert: "Expert", master: "Master" };

const BULB = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21h6M10 17h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function template() {
  const options = (list) => list.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  const cells = Array.from({ length: 81 }, (_, i) => {
    const notes = Array.from({ length: 9 }, () => "<span></span>").join("");
    return `<button type="button" class="cell" tabindex="-1" data-i="${i}" data-r="${Math.floor(i / 9)}" data-c="${i % 9}">` +
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
      <div class="board" id="board" role="group" aria-label="Sudoku board">${cells}<div class="preparing" id="preparing" hidden>Preparing puzzle…</div></div>
      <button type="button" class="btn tool" id="hint">${BULB}<span>Hint</span><span class="hint-count" id="hint-count">0/${MAX_HINTS}</span></button>
      <div class="numpad" id="numpad" role="group" aria-label="Numbers">${nums}</div>
      <p class="tip" id="tip" hidden>Tip: hold a number to add a note</p>
      <p class="notice" id="notice" hidden></p>
    </div>
    <canvas id="confetti" hidden aria-hidden="true"></canvas>
    <div class="sr-only" id="live" role="status" aria-live="polite"></div>
    <div class="overlay" id="overlay" hidden>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text">
        <h2 id="dialog-title"></h2>
        <p id="dialog-text"></p>
        <div class="dialog-actions">
          <button type="button" class="btn primary" id="dialog-new">New Game</button>
          <button type="button" class="btn" id="dialog-cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

const DIALOGS = {
  mistake: { title: (n) => `Mistake ${n}/${MAX_MISTAKES}`, text: "You had better consider taking a hint next time.", primary: "OK" },
  lost: { title: "You lost the game.", text: "Play again?", primary: "Play Again" },
  solved: { title: "Solved!", text: "Well done.", primary: "New Game" },
  confirm: { title: "Abandon this game?", text: "Your progress in this game will be lost.", primary: "New Game", cancel: true }
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
  const parts = cells.map((c) => ({ digit: c.querySelector(".digit"), marks: [...c.querySelectorAll(".notes span")] }));
  const nums = [...root.querySelectorAll(".num")];
  // Writes to the DOM only when a value really changes (cheap renders).
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
  const el = {
    app: $(".app"), board: $("#board"), numpad: $("#numpad"), mistakes: $("#mistakes"), hintCount: $("#hint-count"),
    level: $("#level"), scheme: $("#scheme"), newGame: $("#new-game"), hint: $("#hint"), tip: $("#tip"), notice: $("#notice"),
    confetti: $("#confetti"), live: $("#live"), overlay: $("#overlay"), dialogTitle: $("#dialog-title"), dialogText: $("#dialog-text"),
    dialogNew: $("#dialog-new"), dialogCancel: $("#dialog-cancel"), preparing: $("#preparing")
  };
  let playingLoss = false, dialogKind = null, focusBeforeDialog = null, announceFlip = false, lastClicked = null, tipWanted = false;
  // Safari does not focus a button when it is clicked: remember the last clicked control as a fallback.
  el.app.addEventListener("click", (e) => { lastClicked = e.target.closest("button, select"); }, true);

  el.board.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (cell && handlers.onCell) handlers.onCell(Number(cell.dataset.i));
  });
  el.scheme.addEventListener("change", () => handlers.onScheme && handlers.onScheme(el.scheme.value));
  el.level.addEventListener("change", () => handlers.onLevel && handlers.onLevel(el.level.value));
  el.newGame.addEventListener("click", () => handlers.onNewGame && handlers.onNewGame());
  el.dialogCancel.addEventListener("click", () => handlers.onDialogCancel && handlers.onDialogCancel());
  el.hint.addEventListener("click", () => handlers.onHint && handlers.onHint());
  el.dialogNew.addEventListener("click", () => handlers.onDialogNew && handlers.onDialogNew());
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

    // the tip is hidden while the notice (a short warning in the same place) is showing
    setTipVisible(visible) { tipWanted = visible; el.tip.hidden = !visible || !el.notice.hidden; },
    setNotice(text) {
      el.notice.hidden = !text;
      setText(el.notice, text || "");
      el.tip.hidden = !tipWanted || !el.notice.hidden;
    },
    setPreparing(on) { el.preparing.hidden = !on; },
    setBusy(busy) { el.app.dataset.busy = busy ? "true" : "false"; },

    // Spoken by screen readers (polite live region); the zero-width flip repeats identical messages.
    announce(text) {
      announceFlip = !announceFlip;
      el.live.textContent = text + (announceFlip ? "​" : "");
    },

    // Moves the keyboard focus to a cell (arrow-key navigation).
    focusCell(i) { cells[i].focus(); },

    // kind: "mistake" | "lost" | "solved" | "confirm" | null (hide); `n` is the mistake number
    showDialog(kind, n) {
      if (kind === dialogKind) return;
      const wasOpen = dialogKind !== null;
      dialogKind = kind;
      const open = kind !== null;
      // remember the focus before the page behind the dialog becomes inert (inert drops the focus)
      if (open && !wasOpen) {
        const a = document.activeElement;
        focusBeforeDialog = a && a !== document.body ? a : lastClicked;
      }
      el.overlay.hidden = !open;
      el.app.inert = open;
      if (!open) {
        // give the focus back to where it was
        if (wasOpen && focusBeforeDialog && document.contains(focusBeforeDialog)) focusBeforeDialog.focus();
        focusBeforeDialog = null;
        return;
      }
      const d = DIALOGS[kind];
      el.dialogTitle.textContent = typeof d.title === "function" ? d.title(n) : d.title;
      el.dialogText.textContent = d.text;
      el.dialogNew.textContent = d.primary;
      el.dialogCancel.hidden = !d.cancel;
      el.overlay.dataset.kind = kind;
      el.dialogNew.focus();
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

    // The lost game: the board shakes, then the whole page fades slowly to grey; `done` runs afterwards.
    playLoss(shakeMs, dimMs, done) {
      playingLoss = true;
      el.board.style.setProperty("--shake", shakeMs + "ms");
      el.app.style.setProperty("--dim", dimMs + "ms");
      el.board.classList.add("shake");
      setTimeout(() => {
        el.board.classList.remove("shake");
        playingLoss = false;
        el.app.classList.add("lost");
        setTimeout(done, dimMs);
      }, shakeMs);
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
        setText(parts[i].digit, v ? String(v) : "");
        cell.classList.toggle("sel", h.sel.has(i));
        cell.classList.toggle("peer", h.peer.has(i));
        cell.classList.toggle("same", h.same.has(i));
        cell.classList.toggle("conflict", h.conflict.has(i));
        setAttr(cell, "aria-label", cellLabel(state, i));
        setAttr(cell, "aria-pressed", h.sel.has(i) ? "true" : "false");
        // roving tab stop: one cell is reachable by Tab, the arrow keys move inside the board
        setAttr(cell, "tabindex", i === (state.selected >= 0 ? state.selected : 0) ? "0" : "-1");
        parts[i].marks.forEach((m, k) => { setText(m, !v && (state.notes[i] & (1 << k)) ? String(k + 1) : ""); });
      });
      setText(el.mistakes, `${state.mistakes}/${MAX_MISTAKES}`);
      setText(el.hintCount, `${state.hints}/${MAX_HINTS}`);
      setAttr(el.hint, "aria-disabled", state.hints >= MAX_HINTS || state.lost || state.solved ? "true" : "false");
      if (!playingLoss) el.app.classList.toggle("lost", state.lost);
      el.level.value = state.level;
      // Number buttons only act on an editable selected cell (shown by a flat look, text contrast
      // stays); digits that are completely placed are dimmed and marked disabled.
      const active = state.selected >= 0 && isEditable(state, state.selected);
      nums.forEach((n) => {
        const done = remaining(state, Number(n.dataset.digit)) === 0;
        n.classList.toggle("done", done);
        setAttr(n, "aria-disabled", done ? "true" : "false");
      });
      el.numpad.classList.toggle("inactive", !active);
    }
  };
}
