/**
 * How much of the introduction a reader sits through.
 *
 * The hero has more in it than a first-time reader should have to wait for, so
 * the long parts are held back:
 *
 * - the entrance plays only the plain word and the dot's hop, not the six
 *   material studies between (webgl/hero/SignatureSequence: SHORT_BEATS);
 * - any scroll, key, click or touch during the introduction skips to its end;
 * - a reader who has seen it once starts with the word at rest, the hat on and
 *   a short rope-and-i entrance after the loader;
 * - the scroll into the work is shorter (webgl/stage/DotStage: SCROLL);
 * - the swapping city and platform names wait until the word has settled, and
 *   change less often.
 */

import { RESUME_Y } from '../lib/resume.js';

const KEY = 'saad:intro-seen';

function readSeen() {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export const INTRO = {
  /** Seen before: start at rest. (So too coming back to where they were in this visit: lib/resume.) */
  seen: readSeen() || RESUME_Y != null,
};

/** Remember that the introduction has been seen. */
export function markIntroSeen() {
  try { window.localStorage.setItem(KEY, '1'); } catch { /* storage off: it plays again next time */ }
}
