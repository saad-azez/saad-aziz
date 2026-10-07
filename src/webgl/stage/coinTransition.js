const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const smoother = value => { const t = clamp(value); return t ** 3 * (t * (t * 6 - 15) + 10); };

/**
 * Screen-space choreography, all a function of `k`, the way along the scroll
 * (so the reader drives it, can stop it anywhere, and scrolling back plays it
 * backwards). k = 0 is the letter, 1 the work in view, 2 the work settled.
 *
 *   k 0 → 1   the portal. The coin leaves the i and comes toward the reader,
 *             turning, growing as it goes, to the dead centre of the screen
 *             (CENTRE.reach); there it starts back to its own size (by
 *             CENTRE.settle). A window opens round it all the while (`lens`): a
 *             circle growing out of the coin's own edge until it is the whole
 *             screen, the work behind it. Only once the coin is in the centre
 *             does the book come, flying up from below the screen (FLIGHT, the
 *             stage flies it) to stand shut in the middle; the coin STICKS to it
 *             (STICK), turning over onto the empty place on its front cover,
 *             monogram up, and rides it from then on.
 *   k 1 → 2   the book stands shut, to be picked up and turned over, the coin
 *             on its cover, the lines about it either side; at the end of the
 *             stretch those move out of its way (LEAVE), so that it opens with
 *             the screen to itself. The stage works out the coin's pose on the
 *             book; `stick` and `lift` are how far through each it is.
 *   k 2 → 3   the book opens; the coin is FLICKED off the cover (ROW.lift),
 *             flips in the air and lands face on in the tools row, the copy
 *             comes in round it and it splits:
 *             the other tools' coins slide out from behind it, one after
 *             another, to their places in the row (ROW.split; the stage places
 *             them), each showing its tool's mark.
 */
/** The window: where on the way (k) it starts to open, and over how much of it it opens. */
export const LENS = { start: .04, span: .6 };
/** How far the window is open (0 → 1) at `k`. */
export const lensAt = k => smoother((k - LENS.start) / LENS.span);
/** The coin's way to the middle of the screen: there by `reach`, and back to its own size by `settle`. */
export const CENTRE = { reach: .45, settle: .7 };
/** The book flying up into view from below the screen (from the coin in the centre on), and the coin sticking to its cover. */
export const FLIGHT = [.45, 1];
export const STICK = [.7, .98];

/** The lines about the shut book moving out of its way, in k: all gone just before it starts to open at k 2. */
export const LEAVE = [1.8, 1.97];

/** The row of tools, in k: the coin going to the first, and the others coming out from behind it (start, span, each a little later). */
export const ROW = { move: [1, 1.34], lift: [2, 2.28], split: { start: 2.3, span: .3, stagger: .06 } };
const between = ([a, b], k) => (k - a) / (b - a);
/** How far out of the first coin the `i`th of the row (1 on) has come at `k` (0 → 1). */
export const splitAt = (k, i) => smoother((k - ROW.split.start - ROW.split.stagger * (i - 1)) / ROW.split.span);

/**
 * Where the coin is, and what the page shows, at `k`. `stops`: the i's dot
 * (`home`: x, y, r), the middle of the screen and the coin's size there at
 * its nearest (`centre`: x, y, r), the first tool's coin in the copy (`first`:
 * x, y, r), and the coin's place on the book's front cover (`cover`: x, y, r;
 * when there is one), in px on the pinned screen.
 */
export function coinTransition(k, stops, reduced = false) {
  const { home } = stops;
  const centre = stops.centre ?? home;
  const first = stops.first ?? home;
  const cover = stops.cover;
  let x, y, radius, hidden = false;
  // To the middle of the screen, coming nearer (bigger) as it goes, then back to its own size there.
  const travel = smoother(k / CENTRE.reach);
  const near = reduced ? 0 : k < CENTRE.reach ? smooth(k / CENTRE.reach) : 1 - smoother((k - CENTRE.reach) / (CENTRE.settle - CENTRE.reach));
  const size = mix(home.r, centre.r, near);
  // With a cover to stick to, the stage places the coin itself from there on (stick, lift); x and y stay
  // in the middle before the flick and at the seat after it, for anything that follows the coin's place.
  const stick = clamp(between(STICK, k)), lift = clamp(between(ROW.lift, k));
  if (cover) {
    if (k < 2) { x = mix(home.x, centre.x, travel); y = mix(home.y, centre.y, travel); radius = size; }
    else { x = first.x; y = first.y; radius = first.r; }
  } else {
    const move = smoother(between(ROW.move, k));
    x = mix(mix(home.x, centre.x, travel), first.x, move); y = mix(mix(home.y, centre.y, travel), first.y, move); radius = mix(size, first.r, move);
  }
  return {
    x, y, radius, hidden,
    /** On the book's cover (sticking to it, lying on it, or being flicked off): how far through each. */
    onBook: Boolean(cover) && k >= STICK[0] && k < ROW.lift[1],
    stick, lift,
    depth: 0,
    // Off the i: the turn starts with the first pixel of scroll, so a coin caught mid-turn carries straight on,
    // and has landed on its face by the time it is in the middle.
    yaw: reduced ? 0 : Math.PI * smoother(k / CENTRE.reach),
    pitch: 0,
    roll: 0,
    lens: lensAt(k),
    work: smooth((k - .08) / .1),
    // The title and the lines about the book come in with the book as it flies up.
    title: smooth((k - .6) / .35),
    // While the book stands shut: a line about it either side, coming in as it flies up…
    intro: smooth((k - .55) / .35),
    // …and moving out of its way (LEAVE) before it starts to open (k 2), so the opening has the screen to itself.
    leave: smooth(between(LEAVE, k)),
    // The project on show, as the book opens.
    names: smooth((k - 2.15) / .4),
    details: smooth((k - 2.25) / .45),
    mark: smooth((k - .28) / .48),
  };
}
