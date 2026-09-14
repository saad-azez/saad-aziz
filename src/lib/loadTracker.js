const WEIGHTS = { boot: .2, fonts: .1, media: .15, dom: .3, hero: .25 };

// Real readiness, with a minimum display time and a stalled-resource timeout.
export function createLoadTracker({ minDuration = 2600, maxDuration = 14000 } = {}) {
  const values = Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, 0]));
  const listeners = new Set();
  const start = performance.now();
  let destroyed = false;
  const status = () => {
    const elapsed = performance.now() - start;
    const progress = Object.keys(WEIGHTS).reduce((sum, key) => sum + values[key] * WEIGHTS[key], 0);
    const done = elapsed >= Math.max(maxDuration, minDuration + 4000) || (progress >= .999 && elapsed >= minDuration);
    return [done ? 1 : progress, done];
  };
  const emit = () => { if (!destroyed) listeners.forEach(listener => listener(...status())); };
  const set = (key, value) => {
    if (destroyed || !(key in values)) return;
    values[key] = Math.max(values[key], Math.min(1, Math.max(0, value)));
    emit();
  };
  const loaded = () => set('dom', 1);
  if (document.readyState === 'complete') loaded();
  else window.addEventListener('load', loaded, { once: true });
  Promise.resolve(document.fonts?.ready).then(() => set('fonts', 1));
  const poll = window.setInterval(() => {
    const media = [...document.images, ...document.querySelectorAll('video')];
    const ready = media.filter(el => el.tagName === 'IMG' ? el.complete && el.naturalWidth > 0 : el.readyState >= 3);
    set('media', media.length ? ready.length / media.length : values.dom);
  }, 100);
  return {
    set,
    subscribe(listener) { listeners.add(listener); listener(...status()); return () => listeners.delete(listener); },
    destroy() { destroyed = true; clearInterval(poll); window.removeEventListener('load', loaded); listeners.clear(); },
  };
}
