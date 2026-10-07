/**
 * A phone or a tablet: a touch screen, or a small one. The page runs two
 * WebGL scenes and the book's pictures, and a mobile browser that runs out of
 * memory throws the tab away and loads it again from the top (the loader, the
 * hero). So there everything is drawn a little less finely: the canvases at a
 * lower pixel ratio (`PIXEL_RATIO`), and the book's covers and pictures
 * smaller (Book.js, journal/coverArt.js). Nothing anyone would see at that
 * size.
 */
export const LITE = typeof window !== 'undefined'
  && (window.matchMedia('(pointer: coarse)').matches || Math.min(window.screen.width, window.screen.height) < 700);

/** The most device pixels a canvas is drawn at per CSS pixel. */
export const PIXEL_RATIO = LITE ? 1.5 : 1.75;

/** How finely the canvases are drawn on this screen. */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, PIXEL_RATIO);
