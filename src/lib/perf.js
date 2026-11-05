/**
 * The performance monitor's switch, and the hooks the site calls into it.
 *
 * Off unless the address has `?perf` (which also keeps it on for later visits in this browser; `?perf=0` turns it
 * off). On, main.jsx loads lib/perfMonitor.js before anything else, and it reports in the console: the loader, long
 * tasks and dropped frames by section, the GPU's work, GSAP's listeners and tweens, each renderer and the models.
 * Off, every hook here does nothing and the monitor is never downloaded.
 */

function readSwitch() {
  try {
    const asked = new URLSearchParams(window.location.search).get('perf');
    if (asked !== null) {
      const on = asked !== '0' && asked !== 'off';
      if (on) window.localStorage.setItem('saad:perf', '1');
      else window.localStorage.removeItem('saad:perf');
      return on;
    }
    return window.localStorage.getItem('saad:perf') === '1';
  } catch {
    return false;
  }
}

export const PERF = typeof window !== 'undefined' && readSwitch();

let monitor = null;

/** main.jsx, once the monitor is loaded. */
export function attachMonitor(instance) { monitor = instance; }

export const perf = {
  /** A WebGL renderer to watch (`name`: 'hero', 'stage'): what each frame draws, and how long it takes. */
  renderer(name, renderer) { monitor?.renderer(name, renderer); },
  /** GSAP, before anything uses it: its ticker's listeners and its tweens' updates, timed. */
  gsap(gsap) { monitor?.gsap(gsap); },
  /** A model the site has loaded (`object`, a three.js Object3D): its size, for the list of the heaviest. */
  model(name, object) { monitor?.model(name, object); },
  /** Time `fn` as `label` (a job worth knowing the cost of); returns what it returns. */
  time(label, fn) { return monitor ? monitor.time(label, fn) : fn(); },
};
