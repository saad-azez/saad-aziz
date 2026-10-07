/**
 * The book's covers: plain boards, nothing printed or stamped on them. Their
 * colours come from the brand tokens (--book-*): the board, the spine, and
 * the paper pasted down inside. Read when the stage mounts (the stylesheet is
 * in by then), with the tokens' own values should it not be.
 */
const FALLBACK = { board: '#733d49', spine: '#512b3c', paper: '#f2efeb' };

export function coverColours() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(FALLBACK).map(([key, value]) => [key, style.getPropertyValue(`--book-${key}`).trim() || value]));
}

/**
 * The coin's place on the front cover: its middle across the board (0 the
 * spine, 1 the fore edge) and down it (0 the head), and its radius, of the
 * board's width. The coin sticks there, in the dead middle of the book, in a
 * seat pressed into the cover for it (journal/coverArt.js), while it stands shut.
 */
export const COVER_STICKER = { u: .5, v: .5, r: .1, a: 0 };
