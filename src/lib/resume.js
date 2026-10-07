/**
 * Coming back to where the reader was.
 *
 * The page opens at the top, on purpose (main.jsx): the introduction and the
 * rope start from the word. But a phone throws a heavy tab away when the
 * reader leaves it (a project's site opened in a new tab, the mail app for
 * "Let's talk") and loads it again from scratch when they come back; a reload
 * does the same. Then, within the same visit, the page goes straight back to
 * where they were, without the introduction, instead of starting them over.
 *
 * Where they are is kept in sessionStorage (this tab, this visit only) as the
 * page is hidden or left; it is used only when this load is a reload, a
 * return through history, or a discarded tab coming back, and only if it is
 * recent (FRESH).
 */
const KEY = 'saad:resume';
const FRESH = 30 * 60 * 1000;

function again() {
  if (document.wasDiscarded) return true;
  const type = performance.getEntriesByType?.('navigation')?.[0]?.type;
  return type === 'reload' || type === 'back_forward';
}

function read() {
  if (typeof window === 'undefined' || !again()) return null;
  try {
    const kept = JSON.parse(window.sessionStorage.getItem(KEY));
    return kept && Date.now() - kept.at < FRESH && kept.y > 0 ? kept.y : null;
  } catch {
    return null;
  }
}

/** Where to go back to once the page has loaded (page px), or null to start at the top. */
export const RESUME_Y = read();

/** Keep where the reader is whenever the page is hidden or left. */
export function keepPlace() {
  const keep = () => {
    try { window.sessionStorage.setItem(KEY, JSON.stringify({ y: Math.round(window.scrollY), at: Date.now() })); } catch { /* storage off: start over */ }
  };
  window.addEventListener('pagehide', keep);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keep(); });
}
