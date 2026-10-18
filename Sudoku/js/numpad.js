// Tap vs. long press on the number buttons (PRD 3.2.1): a short tap enters the
// digit, holding for LONG_PRESS_MS toggles a note. The note is applied when the
// threshold is reached, not on release, so the user gets feedback while holding.
import { LONG_PRESS_MS } from "./config.js";

// DOM-free core, driven by down/up/cancel; timers are injectable for tests.
export function createPressTracker({ onTap, onHold, onChange, threshold = LONG_PRESS_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) }) {
  let active = null; // { id, digit, timer, held }
  const notify = (type, digit) => { if (onChange) onChange(type, digit); };

  return {
    isActive: () => active !== null,
    // Starts a press. Returns false if another press is already running.
    down(id, digit) {
      if (active) return false;
      const a = { id, digit, timer: null, held: false };
      active = a;
      a.timer = setTimer(() => {
        a.timer = null;
        a.held = true;
        notify("hold", digit);
        onHold(digit);
      }, threshold);
      notify("press", digit);
      return true;
    },
    // Releases the press: a tap if the threshold was not reached, nothing after a hold.
    up(id) {
      if (!active || active.id !== id) return;
      const a = active;
      active = null;
      if (a.timer !== null) { clearTimer(a.timer); a.timer = null; notify("release", a.digit); onTap(a.digit); }
      else notify("release", a.digit);
    },
    // Aborts the press (pointer cancelled or left the button): no tap, and no note if still pending.
    cancel(id) {
      if (!active || (id !== undefined && active.id !== id)) return;
      const a = active;
      active = null;
      if (a.timer !== null) { clearTimer(a.timer); a.timer = null; }
      notify("cancel", a.digit);
    }
  };
}

// Wires the tracker to the DOM buttons (pointer events; keyboard clicks count as taps).
export function attachNumpad(buttons, { onTap, onHold }) {
  const byButton = new Map(buttons.map((b) => [b, Number(b.dataset.digit)]));
  const tracker = createPressTracker({
    onTap, onHold,
    onChange(type, digit) {
      const b = buttons.find((x) => Number(x.dataset.digit) === digit);
      if (!b) return;
      b.classList.toggle("pressing", type === "press" || type === "hold");
      if (type === "hold") {
        b.classList.add("held");
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* not supported */ } }
      } else if (type === "release" || type === "cancel") {
        b.classList.remove("held", "pressing");
      }
    }
  });

  for (const b of buttons) {
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (tracker.down(e.pointerId, byButton.get(b))) {
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    });
    b.addEventListener("pointerup", (e) => tracker.up(e.pointerId));
    b.addEventListener("pointercancel", (e) => tracker.cancel(e.pointerId));
    b.addEventListener("pointermove", (e) => {
      if (!tracker.isActive()) return;
      const r = b.getBoundingClientRect(), slop = 12;
      if (e.clientX < r.left - slop || e.clientX > r.right + slop || e.clientY < r.top - slop || e.clientY > r.bottom + slop) {
        tracker.cancel(e.pointerId);
      }
    });
    // No context menu / callout while holding.
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    // Keyboard activation (Enter / Space) arrives as a click without pointer: count it as a tap.
    b.addEventListener("click", (e) => { if (e.detail === 0) onTap(byButton.get(b)); });
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) tracker.cancel(); });
  return tracker;
}
