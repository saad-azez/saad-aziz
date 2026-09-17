import { reducedMotion } from '../brand/motion.js';

/**
 * In-page links.
 *
 * THE RULE: links on this site never put a `#` in the address bar. Not for a
 * section, not for the top of the page, not ever. A link to a place on the
 * page scrolls there and leaves the URL exactly as it was.
 *
 * So no link is written `href="#…"`. Every in-page link spreads
 * `sectionLink(id)` instead, which gives it a real, hash-free `href` (the page
 * itself — so it stays a focusable, announceable link, and a middle-click opens
 * the page, not a fragment) and an `onClick` that does the scrolling. A click
 * with a modifier key is left to the browser, which opens the page in a new
 * tab or window as usual.
 *
 * `id` is the id of the element to scroll to, or `'top'` for the top of the
 * page. If there is no such element — the sections are not built yet — the
 * click still does nothing to the URL, and simply goes nowhere.
 */

/** The page's own address, without a fragment. */
const PAGE = import.meta.env.BASE_URL || '/';

/** Scroll to a place on the page. Returns false when there is nothing there. */
export function goToSection(id) {
  const behavior = reducedMotion ? 'auto' : 'smooth';
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior });
    return true;
  }
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior, block: 'start' });
  return true;
}

/**
 * The props for a link to a place on the page. `then` runs after the scroll —
 * for instance, closing the menu the link sits in.
 */
export function sectionLink(id, then) {
  return {
    href: PAGE,
    onClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      goToSection(id);
      then?.(event);
    },
  };
}
