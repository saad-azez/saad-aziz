const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const smoother = value => { const t = clamp(value); return t ** 3 * (t * (t * 6 - 15) + 10); };

/**
 * The about, all a function of `q`: the way along its scroll in screens,
 * from -1 (its top just coming up under the work) through 0 (its screen
 * pinned) to the end of the pinned stretch. The reader drives it, can stop it
 * anywhere, and scrolling back plays it backwards.
 *
 *   q -1 → 0   the jump. The about's screen comes up under the work; the coin
 *              crouches into the tightrope and springs off it (the rope snaps
 *              back, then goes back to the edge, the scrollbar again), over in
 *              a low arc, end over end, into the middle of the new screen,
 *              growing as it comes (DotStage JUMP). The title comes in.
 *   CARD       heads. It turns over, slowly, to its other side: Saad's
 *              portrait, engraved (coinMarks PORTRAIT), under "Clients call
 *              me Saadi."
 *   FOLD       the ring of reviews round it folds away, all of it, while the
 *              coin stays just as it is on the card (DotStage RING_GO); only
 *              then does it move.
 *   TO_LINE    the card goes and the five years come in, set as a poster: the
 *              coin goes over to its place there, growing, and tips back and
 *              leans, a wheel seen from the side (WHEEL), turning over to the
 *              first stop's tool on the way.
 *   STOP       each stop, in turn: the coin holds still, its face showing that
 *              stop's tool (to HOLD), and then the mark melts into the next
 *              stop's, shape into shape (`travel`: DotStage, the face's morph),
 *              to the last. It never turns over between them.
 *   TO_PROCESS on to the process (`p`, `e`). The five years' words fade, all
 *              together; the coin straightens up out of the wheel, face on, and
 *              goes across to its place in the middle of the room, shrinking to
 *              its size there, all of it inside the room. On the way its mark
 *              fades off (`markOut`), and as it comes in its face starts saying
 *              how a project goes (`m`; processTransition wordTurn). The process's
 *              screen lies under this stretch, so where this ends the coin is
 *              in its place there and the page goes on with no scroll between.
 */
/**
 * The coin as a wheel, through the five years: tipped back `tip` degrees, its face turned down to the right towards
 * the reader as a wheel's hub is on the poster (seen from the side, an ellipse), and leaning `lean` degrees (its long
 * axis rising to the right). The stage turns the coin so, and the page sets its words at the same lean
 * (components/about).
 */
export const WHEEL = { tip: 62, lean: 38 };
export const ABOUT_SCROLL = { CARD: 1, FOLD: .35, TO_LINE: .6, STOP: .95, TO_PROCESS: .9 };
/** On to the process, of its TO_PROCESS screens: the last stop's mark fading off. */
const MARK_OUT = [.05, .4];
/**
 * Of each stop: its mark held until HOLD, and melting into the next's over the rest; the words on show change to
 * the next stop's once the change is WORDS of the way.
 */
const STOP = { HOLD: .3, WORDS: .5 };

/** The pinned stretch, in screens, for this many stops. */
export const aboutScreens = stops => {
  const S = ABOUT_SCROLL;
  return S.CARD + S.FOLD + S.TO_LINE + S.STOP * stops + S.TO_PROCESS;
};

/**
 * What the coin shows, a half-turn at a time: what it came off the rope
 * showing, the portrait, the five years (LINE: one face, its mark melting from
 * stop to stop), and the last before the process (`mark`: his words, coinWords MINE). Index `n` is shown when the
 * coin has turned over `n` times (aboutTransition `flips`).
 */
export const LINE = 'about:line';
export const aboutFaces = (came, portrait, mark) => [came, portrait, LINE, mark];

/**
 * At `q`, for `stops` stops: where the coin is on its way (`seg`: 'jump',
 * 'card', 'toLine', 'line' or 'toProcess'; `e` through a move between places,
 * eased, and `p` the same uneased, `stop` and `travel` through the five years
 * (`melt` the same uneased: how far the mark has melted into the next stop's),
 * and the two as one number, `along`: -1 before them, 0 at the first stop,
 * rising through each to the last), how many times it has turned over
 * (`flips`, continuous), the toss as it jumps (`toss`, 0 → 1), and what the
 * page shows (each 0 → 1, and the stop on show); on the way to the process,
 * its mark fading off (`markOut`, 0 → 1), and how far it is from the process (`m`, screens, 0 there); among it, the five years' words coming in (`lineIn`, as the coin
 * goes over to them) and going (`lineOut`, as it leaves them), for
 * components/about's timeline of them.
 */
export function aboutTransition(q, stops, reduced = false) {
  const S = ABOUT_SCROLL;
  // (The coin leaves the card once the ring round it has folded away: `held`.)
  const held = S.CARD + S.FOLD, lineStart = held + S.TO_LINE, lineEnd = lineStart + S.STOP * stops;
  const part = (p, [from, to]) => clamp((p - from) / (to - from));
  const out = {
    seg: 'jump', e: 0, p: 0, stop: 0, travel: 0, melt: 0, along: -1, flips: 0, toss: 0,
    markOut: 0, m: 0,
    enter: clamp(q + 1),
    // The card: its title rising as the screen comes up, the rest with the coin's turn; gone as the coin drops.
    title: smooth((q + .3) / .5),
    lede: smooth((q - .3) / .45),
    card: 1 - smooth((q - held) / .45),
    // The five years, coming as the card goes, and gone as the coin leaves them.
    line: smooth((q - held - .2) / .45) * (1 - smooth((q - lineEnd) / .4)),
    // The five years' words: in from as the card goes to a little after the coin is there; out as it sets off.
    lineIn: clamp((q - held - .2) / (S.TO_LINE + .05)),
    lineOut: clamp((q - lineEnd) / .3),
    stopOn: 0,
  };
  if (q < 0) {
    out.toss = reduced ? 1 : smoother(q + 1);
    out.e = out.toss;
  } else if (q < held) {
    // (On the card, and through FOLD still there, just as it is.)
    out.seg = 'card';
    out.e = Math.min(1, q / S.CARD);
    out.flips = smoother((q / S.CARD - .12) / .45);
  } else if (q < lineStart) {
    out.seg = 'toLine';
    out.p = (q - held) / S.TO_LINE;
    out.e = smoother(out.p);
    out.along = out.e - 1;
    // (Turned over to the five years' mark early on the way, so it lands in its place already showing it.)
    out.flips = 1 + smoother((out.p - .05) / .5);
  } else if (q < lineEnd) {
    out.seg = 'line';
    const u = (q - lineStart) / S.STOP;
    const i = Math.min(stops - 1, Math.floor(u)), f = u - i;
    out.stop = i;
    out.melt = i < stops - 1 ? clamp((f - STOP.HOLD) / (1 - STOP.HOLD)) : 0;
    out.travel = smoother(out.melt);
    out.along = i + out.travel;
    out.flips = 2;
  } else {
    out.seg = 'toProcess';
    out.stop = stops - 1;
    out.along = stops - 1;
    out.p = clamp((q - lineEnd) / S.TO_PROCESS);
    out.e = reduced ? (out.p >= .5 ? 1 : 0) : smoother(out.p);
    out.markOut = reduced ? out.e : smooth(part(out.p, MARK_OUT));
    out.m = (out.p - 1) * S.TO_PROCESS;
    out.flips = 2;
  }
  // The stop on show: the one the coin is at (or nearest, changing between two), changing as it turns to it.
  out.stopOn = out.seg === 'line' ? Math.min(stops - 1, out.stop + (out.travel > STOP.WORDS ? 1 : 0)) : out.seg === 'toProcess' ? stops - 1 : 0;
  if (reduced) out.flips = Math.round(out.flips);
  return out;
}
