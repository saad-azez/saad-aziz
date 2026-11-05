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
/**
 * The two heights, read once and kept until the window is resized: they are asked for every frame, and reading
 * an element's size makes the browser finish any layout it has pending. (Neither moves with the bars.)
 */
let fullHeight = 0;
let smallHeight = 0;
let pageHeightNow = 0;
if (typeof window !== 'undefined') window.addEventListener('resize', () => { fullHeight = smallHeight = pageHeightNow = 0; }, { passive: true });

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
  if (!fullHeight) fullHeight = full.offsetHeight;
  return fullHeight || window.innerHeight;
}

/** How much of the bottom of that the browser's bars can cover (px): CSS 100vh - 100svh. */
export function barInset() {
  small ??= probe('100svh');
  if (!smallHeight) smallHeight = small.offsetHeight;
  return Math.max(0, viewHeight() - (smallHeight || viewHeight()));
}

/** The page's whole height (px), kept current without reading it every frame. */
let pageWatch = null;
export function pageHeight() {
  if (!pageWatch && typeof ResizeObserver !== 'undefined') {
    pageWatch = new ResizeObserver(() => { pageHeightNow = 0; });
    pageWatch.observe(document.documentElement);
  }
  if (!pageHeightNow) pageHeightNow = document.documentElement.scrollHeight;
  return pageHeightNow;
}
