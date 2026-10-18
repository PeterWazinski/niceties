// localStorage that never throws (private mode, blocked site data, quota).
export function safeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
export function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}
export function safeRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}
