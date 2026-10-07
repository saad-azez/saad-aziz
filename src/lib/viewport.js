/**
 * The screen's height for everything pinned or drawn on it: the full height,
 * with the browser's bars out of the way (CSS `100vh`, the large viewport).
 *
 * On a phone the address bar comes and goes as the reader scrolls, and
 * `window.innerHeight` with it. Anything sized or laid out from that changes
 * size mid-scroll (a canvas stretched, a pinned screen with a strip of the page
 * showing under it, the scroll's choreography jumping). So the pinned screen
 * (Journey.css), the canvases (Hero.css, Stage.css) and the code that draws on
 * them and paces the scroll all take this one height instead, which never moves
 * with the bars; what has to stay in sight keeps clear of the bars' strip at
 * the bottom (`barInset`, CSS `100vh - 100svh`).
 */
let full = null;
let small = null;

function probe(height) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;left:0;top:0;width:0;height:${height};visibility:hidden;pointer-events:none`;
  document.body.append(el);
  return el;
}

/** The full screen height (px): CSS 100vh. */
export function viewHeight() {
  full ??= probe('100vh');
  return full.offsetHeight || window.innerHeight;
}

/** How much of the bottom of that the browser's bars can cover (px): CSS 100vh - 100svh. */
export function barInset() {
  small ??= probe('100svh');
  return Math.max(0, viewHeight() - (small.offsetHeight || viewHeight()));
}
