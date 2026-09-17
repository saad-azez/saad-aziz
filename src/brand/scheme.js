/**
 * The colour scheme: day or night, by the clock in Islamabad.
 *
 * The page is porcelain while it is day where the work is made and graphite
 * while it is night there — whatever the reader's own device prefers. That is
 * the point: the site is a window onto one desk, and a reader in another
 * timezone can see at a glance whether it is morning or midnight here.
 *
 * `tokens.css` declares both palettes and switches on `data-scheme` on <html>;
 * this module is the only thing that sets it. The WebGL stage re-reads its
 * palette on the `brand:scheme` event (see palette.js).
 *
 * A reader can overrule the sun: the pull cord hanging over the right rail
 * (components/cord) calls `toggleScheme()`, and the choice is kept in
 * localStorage so the lights stay the way they were left. Until a reader
 * pulls it, the page follows the sun.
 */

import { sunState } from '../lib/sun.js';

const EVENT = 'brand:scheme';
const KEY = 'saad:scheme';

/** The reader's kept choice, if any. Storage may be blocked; that is 'auto'. */
function readChoice() {
  try {
    const kept = window.localStorage.getItem(KEY);
    return kept === 'day' || kept === 'night' ? kept : 'auto';
  } catch {
    return 'auto';
  }
}

function keepChoice(next) {
  try {
    if (next === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // Private mode or storage off: the choice lasts the visit and no longer.
  }
}

/** 'auto' follows the sun; 'day' / 'night' is a reader's override. */
let choice = readChoice();
let current = null;

/** The scheme the sun (or the reader) asks for at `now`. */
export function resolveScheme(now = Date.now()) {
  return choice === 'auto' ? (sunState(now).night ? 'night' : 'day') : choice;
}

/** The scheme the page is showing. */
export function currentScheme() {
  return current ?? resolveScheme();
}

/** What is deciding the scheme: 'auto' (the sun), or the reader's 'day' / 'night'. */
export function schemeChoice() {
  return choice;
}

/** Apply the scheme for `now` to the document, if it has changed. */
export function applyScheme(now = Date.now()) {
  const next = resolveScheme(now);
  if (next === current) return current;
  current = next;
  const root = document.documentElement;
  root.dataset.scheme = next;
  // The browser chrome follows the ground token, read back so it is never
  // written down a second time.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--ground').trim());
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { scheme: next } }));
  return next;
}

/** A reader's override, kept between visits. Anything but day or night hands back to the sun. */
export function setScheme(next) {
  choice = next === 'day' || next === 'night' ? next : 'auto';
  keepChoice(choice);
  return applyScheme();
}

/** The pull cord: whichever scheme is showing, show the other. */
export function toggleScheme() {
  return setScheme(currentScheme() === 'night' ? 'day' : 'night');
}

/** Call `callback(scheme)` whenever the page's scheme changes. Returns the stop. */
export function onSchemeChange(callback) {
  const handler = e => callback(e.detail.scheme);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Apply now and keep checking: once a minute, and whenever the tab comes back
 * (a laptop lid closed at dusk opens on the night palette). Returns the stop.
 */
export function startSchemeClock() {
  applyScheme();
  const id = window.setInterval(() => applyScheme(), 60000);
  const onVisible = () => { if (document.visibilityState === 'visible') applyScheme(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
