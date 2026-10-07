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
 *   TO_LINE    the card goes and the tower rises (tower.js); the coin drops
 *              onto its road at the first stop, turning to that stop's tool
 *              on the way.
 *   STOP       each step of the way up the tower, in turn: it turns over to
 *              that stop's tool (FLIP of the stretch), stands there (to HOLD),
 *              then rolls on up the road to the next one, across the front of
 *              the column or round the back of it, the summit last.
 *   TO_BENCH   off the summit to the bench, growing; it turns over
 *              and, edge on, stops being a coin and starts being a drawing.
 *   STEP       the process, a step at a time, the coin made again by each:
 *              sketched (its outline), modelled (its wireframe), built (solid,
 *              plain clay), and finished (the monogram, struck in gold).
 *   OUT        a breath, then the screen scrolls away with the coin on it.
 */
export const ABOUT_SCROLL = { CARD: 1, TO_LINE: .6, STOP: .78, TO_BENCH: .6, STEP: .72, OUT: .45 };
/** Of each stop on the tower: the turn to its tool over the first FLIP, standing until HOLD, rolling on after. */
const STOP = { FLIP: .3, HOLD: .5 };
/** Of each step of the process: the turn to it over the first FLIP. */
const STEP = { FLIP: .35 };

/** The pinned stretch, in screens, for this many stops and steps. */
export const aboutScreens = (stops, steps) => {
  const S = ABOUT_SCROLL;
  return S.CARD + S.TO_LINE + S.STOP * stops + S.TO_BENCH + S.STEP * steps + S.OUT;
};

/**
 * What the coin shows, a half-turn at a time: what it came off the rope
 * showing, the portrait, each stop's tool, and the four states of the process.
 * Index `n` is shown when the coin has turned over `n` times (aboutTransition
 * `flips`). The states that are not a mark are named here.
 */
export const SKETCH = { outline: 'about:outline', wire: 'about:wire', clay: 'about:clay' };
export const aboutFaces = (came, portrait, stopFaces, finished) =>
  [came, portrait, ...stopFaces, SKETCH.outline, SKETCH.wire, SKETCH.clay, finished];

/**
 * At `q`, for `stops` stops and `steps` steps: where the coin is on its way
 * (`seg`: 'jump', 'card', 'toLine', 'line', 'toBench' or 'bench'; `e` through
 * a move between places, `stop` and `travel` up the tower, `step` on the
 * bench), how many times it has turned over (`flips`, continuous), the toss as
 * it jumps (`toss`, 0 → 1), and what the page shows (each 0 → 1, and the stop
 * and step on show).
 */
export function aboutTransition(q, stops, steps, reduced = false) {
  const S = ABOUT_SCROLL;
  const lineStart = S.CARD + S.TO_LINE, lineEnd = lineStart + S.STOP * stops;
  const benchStart = lineEnd + S.TO_BENCH;
  const out = {
    seg: 'jump', e: 0, stop: 0, travel: 0, step: 0, flips: 0, toss: 0,
    enter: clamp(q + 1),
    // The card: its title rising as the screen comes up, the rest with the coin's turn; gone as the coin drops.
    title: smooth((q + .3) / .5),
    lede: smooth((q - .3) / .45),
    card: 1 - smooth((q - S.CARD) / .45),
    // The tower, rising as the card goes, and gone as the coin leaves it.
    line: smooth((q - S.CARD - .2) / .45) * (1 - smooth((q - lineEnd) / .4)),
    // The bench, coming in as the coin gets there.
    bench: smooth((q - lineEnd - .25) / .45),
    stopOn: 0,
    stepOn: 0,
  };
  if (q < 0) {
    out.toss = reduced ? 1 : smoother(q + 1);
    out.e = out.toss;
  } else if (q < S.CARD) {
    out.seg = 'card';
    out.e = q / S.CARD;
    out.flips = smoother((q / S.CARD - .12) / .45);
  } else if (q < lineStart) {
    out.seg = 'toLine';
    out.e = smoother((q - S.CARD) / S.TO_LINE);
    out.flips = 1 + smoother(((q - S.CARD) / S.TO_LINE - .25) / .6);
  } else if (q < lineEnd) {
    out.seg = 'line';
    const u = (q - lineStart) / S.STOP;
    const i = Math.min(stops - 1, Math.floor(u)), f = u - i;
    out.stop = i;
    out.travel = i < stops - 1 ? smoother((f - STOP.HOLD) / (1 - STOP.HOLD)) : 0;
    out.flips = i === 0 ? 2 : 1 + i + smoother(f / STOP.FLIP);
  } else if (q < benchStart) {
    out.seg = 'toBench';
    out.stop = stops - 1;
    out.e = smoother((q - lineEnd) / S.TO_BENCH);
    out.flips = stops + 1 + smoother(((q - lineEnd) / S.TO_BENCH - .25) / .6);
  } else {
    out.seg = 'bench';
    const u = (q - benchStart) / S.STEP;
    const j = Math.max(0, Math.min(steps - 1, Math.floor(u))), f = u - j;
    out.step = j;
    out.flips = j === 0 ? stops + 2 : stops + 1 + j + smoother(f / STEP.FLIP);
  }
  // The stop and the step on show: the one the coin is at (or nearest, rolling between two), changing as it turns to them.
  out.stopOn = out.seg === 'line' ? Math.min(stops - 1, out.stop + (out.travel > .5 ? 1 : 0)) : out.seg === 'toBench' ? stops - 1 : 0;
  out.stepOn = out.seg === 'bench' ? Math.max(0, Math.min(steps - 1, Math.round(out.flips) - stops - 2)) : 0;
  if (reduced) out.flips = Math.round(out.flips);
  return out;
}
