import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { reducedMotion } from '../brand/motion.js';

/**
 * Smooth scrolling, with Lenis.
 *
 * The wheel no longer jumps the page a notch at a time: Lenis eases the real
 * window scroll toward where the wheel sends it, so everything the site
 * scrubs against `window.scrollY` — the rope leaving the word, the coin, the
 * ring — glides with it. It runs on GSAP's ticker, before anything else that
 * reads the scroll, so a frame never sees a stale position. Touch keeps the
 * device's own scrolling. Nothing is started for a reader who asked for less
 * motion; `scrollToY` then scrolls the plain way.
 *
 * Anything that scrolls the page by itself goes through here, so it moves with
 * Lenis rather than against it.
 */

let lenis = null;
/**
 * Whatever is gliding the page by itself just now (a link, the coin's hop) and since when; forgotten after
 * GLIDE_FOR s even if the glide never finished (a wheel can cut one short, and then nothing says it is done).
 */
let glider = null;
const GLIDE_FOR = 2.5;
/**
 * How much of the way to the target the page moves each frame, at 60 fps.
 * Higher follows the wheel more tightly; lower glides more but trails the hand.
 * A light ease keeps wheel steps continuous through the rope's tight bends.
 */
export const SMOOTHING = .1;

const tickScroll = time => lenis?.raf(time * 1000);

/** The Lenis instance, or null (for logging). */
export function getLenis() {
  return lenis;
}

/** Whether the page's scroll is already eased: anything scrubbed against it should follow it directly. */
export function smoothScrolling() {
  return Boolean(lenis);
}

export function startSmoothScroll() {
  if (lenis || reducedMotion) return lenis;
  lenis = new Lenis({ lerp: SMOOTHING, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, autoRaf: false });
  // Always advance the page before the WebGL scenes read its position.
  gsap.ticker.add(tickScroll, false, true);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  gsap.ticker.remove(tickScroll);
  lenis?.destroy();
  lenis = null;
});

/** Hold the page still (while the loader is up), and let it go again. */
export function holdScroll(held) {
  if (!lenis) return;
  if (held) lenis.stop(); else lenis.start();
}

/** What is gliding the page by itself just now (`by` of the scrollToY that began it), or null. */
export function gliding() {
  if (glider && performance.now() - glider.at > GLIDE_FOR * 1000) glider = null;
  return glider?.by ?? null;
}

/**
 * Scroll to `top`: gliding unless `immediate`, as the plain page would without Lenis. A glide may take
 * `duration` s with `easing` (Lenis's own, by default), `lock` the wheel until it is done, and say who it is
 * `by` (for gliding()).
 */
export function scrollToY(top, { immediate = false, duration, easing, lock = false, by = 'page' } = {}) {
  if (lenis) {
    const glide = immediate ? null : { by, at: performance.now() };
    if (glide) glider = glide;
    lenis.scrollTo(top, {
      immediate, force: true, lock, ...(duration ? { duration, easing } : {}),
      onComplete: () => { if (glider === glide) glider = null; },
    });
    return;
  }
  window.scrollTo({ top, behavior: immediate || reducedMotion ? 'instant' : 'smooth' });
}

/** Scroll to an element's top. */
export function scrollToElement(element) {
  if (lenis) {
    const glide = glider = { by: 'page', at: performance.now() };
    lenis.scrollTo(element, { force: true, onComplete: () => { if (glider === glide) glider = null; } });
    return;
  }
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}
