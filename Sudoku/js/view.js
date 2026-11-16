// Renders the game into the page (PRD 3.1, 3.3, 3.4.1). The view only reads the game
// state; all rules live in game.js. Handlers are passed in by the controller.
import { highlights } from "./highlight.js";
import { cellValue, isGiven, isWrong, isEditable, remaining, coachAvailable } from "./game.js";
import { UNITS } from "./grid.js";
import { t, DEFAULT_LANG } from "./i18n.js";
import { quoteText } from "./quotes.js";
import { MAX_MISTAKES, MAX_HINTS, LEVELS } from "./config.js";
import { attachNumpad } from "./numpad.js";
import { SCHEMES } from "./schemes.js";

export { SCHEMES };


const BULB = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21h6M10 17h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const GLOBE = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const CAP = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function template() {
  // Texts are filled in by setLanguage(): data-t = text content, data-t-label = aria-label.
  const options = (list) => list.map(([v, key]) => `<option value="${v}" data-t="${key}"></option>`).join("");
  const cells = Array.from({ length: 81 }, (_, i) => {
    const notes = Array.from({ length: 9 }, () => "<span></span>").join("");
    return `<button type="button" class="cell" tabindex="-1" data-i="${i}" data-r="${Math.floor(i / 9)}" data-c="${i % 9}" data-box="${Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)}">` +
      `<span class="digit"></span><span class="notes" aria-hidden="true">${notes}</span>` +
      `<span class="cands" aria-hidden="true">${notes}</span></button>`;
  }).join("");
  const nums = Array.from({ length: 9 }, (_, k) =>
    `<button type="button" class="num" data-digit="${k + 1}">${k + 1}</button>`).join("");
  return `
    <div class="app">
      <div class="head">
        <h1 class="title">Sudoku</h1>
        <button type="button" class="btn lang" id="lang" data-t-label="lang.label">${GLOBE}<span id="lang-code" data-t="lang.code"></span></button>
      </div>
      <button type="button" class="btn primary" id="new-game" data-t="newGame"></button>
      <div class="status">
        <label class="field"><span class="field-label" data-t="level"></span>
          <select id="level" class="select">${options(LEVELS.map((l) => [l, "level." + l]))}</select></label>
        <div class="field mistakes"><span class="field-label" data-t="mistakes"></span>
          <span class="mistakes-value" id="mistakes" aria-live="polite">0/${MAX_MISTAKES}</span></div>
        <label class="field"><span class="field-label" data-t="colours"></span>
          <select id="scheme" class="select">${options(SCHEMES.map((s) => [s.id, "scheme." + s.id]))}</select></label>
      </div>
      <div class="board" id="board" role="group" data-t-label="board">${cells}<div class="preparing" id="preparing" hidden data-t="preparing"></div></div>
      <div class="tools" id="tools">
        <button type="button" class="btn tool" id="hint">${BULB}<span data-t="hint"></span></button>
        <button type="button" class="btn tool" id="coach-close" hidden data-t="close"></button>
        <div class="help-dots" id="help-dots" data-used="0">${"<span></span>".repeat(MAX_HINTS)}<span class="sr-only" id="help-text"></span></div>
        <button type="button" class="btn tool" id="coach">${CAP}<span data-t="coach"></span></button>
        <button type="button" class="btn tool primary" id="coach-next" hidden></button>
      </div>
      <div class="numpad" id="numpad" role="group" data-t-label="numbers">${nums}</div>
      <section class="coach-panel" id="coach-panel" data-t-label="coach" hidden>
        <p class="coach-title" id="coach-title"></p>
        <p class="coach-text" id="coach-text" tabindex="0"><span class="coach-note" id="coach-note"></span><span id="coach-body"></span></p>
      </section>
      <p class="tip" id="tip" hidden data-t="tip"></p>
      <p class="notice" id="notice" hidden></p>
    </div>
    <canvas id="confetti" hidden aria-hidden="true"></canvas>
    <div class="sr-only" id="live" role="status" aria-live="polite"></div>
    <div class="overlay" id="overlay" hidden>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text dialog-by">
        <h2 id="dialog-title"></h2>
        <p id="dialog-text"></p>
        <p id="dialog-by" class="dialog-by" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="btn primary" id="dialog-new"></button>
          <button type="button" class="btn" id="dialog-cancel" data-t="cancel"></button>
        </div>
      </div>
    </div>`;
}

// Text keys of the dialogs (i18n.js); the mistake title takes the mistake number.
// Mistake, lost and solved show a Star Wars quote as their text (PRD 3.9, quotes.js).
const DIALOGS = {
  mistake: { title: "dlg.mistake.title", primary: "ok" },
  lost: { title: "dlg.lost.title", primary: "dlg.lost.primary" },
  solved: { title: "dlg.solved.title", primary: "newGame" },
  confirm: { title: "dlg.confirm.title", text: "dlg.confirm.text", primary: "newGame", cancel: true }
};

const digitsIn = (mask) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << (d - 1)));

// coach = the step on screen (or null): while coaching, involved cells name their
// candidates instead of the (hidden) notes.
function cellLabel(lang, state, i, coach) {
  const tr = (key, values) => t(lang, key, values);
  const pos = tr("cell.pos", { r: Math.floor(i / 9) + 1, c: (i % 9) + 1 });
  const v = cellValue(state, i);
  if (v) return `${pos}, ${v}, ${tr(isGiven(state, i) ? "cell.given" : isWrong(state, i) ? "cell.wrong" : "cell.correct")}`;
  const empty = `${pos}, ${tr("cell.empty")}`;
  if (coach) {
    if (!(i in coach.shown)) return empty;
    const removed = coach.removed.filter((e) => e.cell === i).map((e) => e.digit);
    return `${empty}, ${tr("cell.cands", { digits: digitsIn(coach.shown[i]).join(" ") })}` +
      (removed.length ? `, ${tr("cell.removed", { digits: removed.join(" ") })}` : "");
  }
  const notes = digitsIn(state.notes[i]);
  return empty + (notes.length ? `, ${tr("cell.notes", { digits: notes.join(" ") })}` : "");
}

export function createView(root, handlers = {}) {
  root.innerHTML = template();
  const $ = (sel) => root.querySelector(sel);
  const cells = [...root.querySelectorAll(".cell")];
  const parts = cells.map((c) => ({
    digit: c.querySelector(".digit"), marks: [...c.querySelectorAll(".notes span")], cands: [...c.querySelectorAll(".cands span")]
  }));
  const nums = [...root.querySelectorAll(".num")];
  // Writes to the DOM only when a value really changes (cheap renders).
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
  const el = {
    app: $(".app"), board: $("#board"), numpad: $("#numpad"), mistakes: $("#mistakes"),
    level: $("#level"), scheme: $("#scheme"), newGame: $("#new-game"), hint: $("#hint"), tip: $("#tip"), notice: $("#notice"),
    coach: $("#coach"), coachClose: $("#coach-close"), coachNext: $("#coach-next"), coachPanel: $("#coach-panel"),
    coachTitle: $("#coach-title"), coachText: $("#coach-text"), coachNote: $("#coach-note"), coachBody: $("#coach-body"), helpDots: $("#help-dots"), helpText: $("#help-text"),
    confetti: $("#confetti"), live: $("#live"), overlay: $("#overlay"), dialogTitle: $("#dialog-title"), dialogText: $("#dialog-text"), dialogBy: $("#dialog-by"),
    dialogNew: $("#dialog-new"), dialogCancel: $("#dialog-cancel"), preparing: $("#preparing")
  };
  let playingLoss = false, dialogKind = null, focusBeforeDialog = null, announceFlip = false, lastClicked = null, tipWanted = false;
  let coachStep = null; // the decorated Coach step on screen, or null
  let lastState = null;
  let lang = DEFAULT_LANG, dialogN = 0, dialogQuote = null;
  const tr = (key, values) => t(lang, key, values);

  // Fills every text of the page in the current language (first render and every switch).
  function applyTexts() {
    for (const e of root.querySelectorAll("[data-t]")) setText(e, tr(e.dataset.t));
    for (const e of root.querySelectorAll("[data-t-label]")) setAttr(e, "aria-label", tr(e.dataset.tLabel));
    document.documentElement.lang = lang;
  }

  // quote = { list, index } for mistake / lost / solved (PRD 3.9): the same entry in
  // either language, so a language switch shows the same quote translated
  function fillDialog(kind, n, quote) {
    const d = DIALOGS[kind];
    dialogN = n;
    dialogQuote = quote || null;
    setText(el.dialogTitle, tr(d.title, { n, max: MAX_MISTAKES }));
    const q = quote ? quoteText(quote.list, quote.index, lang) : null;
    setText(el.dialogText, q ? q.text : d.text ? tr(d.text) : "");
    el.dialogText.classList.toggle("quote", !!q);
    setText(el.dialogBy, q && q.by ? `— ${q.by}` : "");
    el.dialogBy.hidden = !(q && q.by);
    setText(el.dialogNew, tr(d.primary));
    el.dialogCancel.hidden = !d.cancel;
  }
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
  el.coach.addEventListener("click", () => handlers.onCoach && handlers.onCoach());
  el.coachNext.addEventListener("click", () => handlers.onCoachNext && handlers.onCoachNext());
  el.coachClose.addEventListener("click", () => handlers.onCoachClose && handlers.onCoachClose());
  $("#lang").addEventListener("click", () => handlers.onLang && handlers.onLang());
  applyTexts();

  // Coach marks on the board: units, key cells, candidates of the involved cells.
  function paintCoach() {
    const unitCells = new Set(coachStep ? coachStep.units.flatMap((u) => UNITS[u]) : []);
    const keyCells = new Set(coachStep ? coachStep.keyCells : []);
    cells.forEach((cell, i) => {
      cell.classList.toggle("coach-unit", unitCells.has(i) && !keyCells.has(i));
      cell.classList.toggle("coach-key", keyCells.has(i));
      const shown = coachStep && i in coachStep.shown ? coachStep.shown[i] : 0;
      parts[i].cands.forEach((m, k) => {
        const d = k + 1, on = (shown & (1 << k)) !== 0;
        const removed = on && coachStep.removed.some((e) => e.cell === i && e.digit === d);
        const key = on && !removed && coachStep.key.some((e) => e.cell === i && e.digit === d);
        setText(m, on ? String(d) : "");
        m.classList.toggle("removed", removed);
        m.classList.toggle("key", key);
      });
    });
  }
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

    // Coach (PRD 3.4.1): show = { title, level, text, last, step, counter, note } for the
    // current step (counter "Step 1 of 3" and note only for chains of several steps),
    // or null to close. The panel replaces the number pad; the tool row turns into
    // Close · dots · Next/Fill.
    showCoach(show) {
      const open = !!show;
      coachStep = open ? show.step : null;
      el.app.dataset.coach = open ? "open" : "";
      el.coachPanel.hidden = !open;
      el.numpad.hidden = open;
      el.hint.hidden = open;
      el.coach.hidden = open;
      el.coachClose.hidden = !open;
      el.coachNext.hidden = !open;
      if (open) {
        const name = show.level ? `${show.title} · ${show.level}` : show.title;
        setText(el.coachTitle, show.counter ? `${show.counter} · ${name}` : name);
        setText(el.coachNote, show.note || "");
        el.coachNote.hidden = !show.note;
        setText(el.coachBody, show.text);
        el.coachText.scrollTop = 0;
        setText(el.coachNext, tr(show.last ? "fill" : "next"));
      }
      paintCoach();
      cells.forEach((c, i) => setAttr(c, "aria-label", lastState ? cellLabel(lang, lastState, i, coachStep) : c.getAttribute("aria-label")));
    },
    focusCoachNext() { el.coachNext.focus(); },
    focusCoachButton() { el.coach.focus(); },

    // Moves the keyboard focus to a cell (arrow-key navigation).
    focusCell(i) { cells[i].focus(); },

    // Switches every text to `lang` (PRD 3.8); the controller redraws the Coach panel
    // and calls render() afterwards for the cell labels and the help text.
    setLanguage(next) {
      lang = next;
      applyTexts();
      if (dialogKind) fillDialog(dialogKind, dialogN, dialogQuote);
    },

    // kind: "mistake" | "lost" | "solved" | "confirm" | null (hide); `n` is the mistake number;
    // quote = { list, index } of the quote to show (drawn by the controller when the dialog opens)
    showDialog(kind, n, quote) {
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
      fillDialog(kind, n, quote);
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
      lastState = state;
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
        setAttr(cell, "aria-label", cellLabel(lang, state, i, coachStep));
        setAttr(cell, "aria-pressed", h.sel.has(i) ? "true" : "false");
        // roving tab stop: one cell is reachable by Tab, the arrow keys move inside the board
        setAttr(cell, "tabindex", i === (state.selected >= 0 ? state.selected : 0) ? "0" : "-1");
        parts[i].marks.forEach((m, k) => { setText(m, !v && (state.notes[i] & (1 << k)) ? String(k + 1) : ""); });
      });
      setText(el.mistakes, `${state.mistakes}/${MAX_MISTAKES}`);
      // help dots: Hint and Coach share MAX_HINTS helps, a filled dot is a used help
      setAttr(el.helpDots, "data-used", String(state.hints));
      [...el.helpDots.children].slice(0, MAX_HINTS).forEach((dot, k) => dot.classList.toggle("used", k < state.hints));
      setText(el.helpText, tr("help", { n: state.hints, max: MAX_HINTS }));
      const noHelp = !coachAvailable(state) ? "true" : "false";
      setAttr(el.hint, "aria-disabled", noHelp);
      setAttr(el.coach, "aria-disabled", noHelp);
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
      paintCoach();
    }
  };
}
