const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const smoother = value => { const t = clamp(value); return t ** 3 * (t * (t * 6 - 15) + 10); };

/**
 * The process (components/process; DotStage stepProcess, Puzzle place): the coin, taken apart and put back together.
 * One pinned screen, all of it a function of `m`, the way along its scroll in screens: -1 as it comes up under the
 * about, 0 pinned, to PROCESS_SCREENS. The reader drives it and scrolling back plays it backwards.
 *
 *   ARRIVE   before 0  the coin comes over from the five years and arrives in the middle of this screen, face on
 *                    (aboutTransition TO_PROCESS). This screen lies under the about's last stretch, so `m` 0 is the
 *                    moment it arrives;
 *   WORDS            as it comes in its face says how a project goes, a saying at a time, each rolling up through the
 *                    same two slots (`wordTurn`; coinWords): first I listen, next I model, then I build, last I finish;
 *                    and they come to his words, "my process";
 *   RAKE             the light drops low across its face from the left, and in it cuts that were always there show: the
 *                    seams between its pieces (the stage hands it over to the puzzle: the same disc, the same light);
 *                    and as they come up his words roll over to the reader's (coinWords YOURS: "your idea");
 *   OPEN             it comes apart along the seams, toward the reader and back, the whole turned so its layers show,
 *                    each piece turning over as it lifts out to what it is: one part of a project, said on its back,
 *                    whole, so every piece can be read on its own;
 *   SCATTER          they go out to places of their own, near and far, the view face on again and the light back up;
 *                    the middle piece, the coin's heart, stays where it was;
 *   DRAW             and the middle draws them back in, a step's two parts at a time (DOCK), each showing what it is
 *                    until it is nearly home and only then turning face up, the middle leaning toward it;
 *   LOCK             all in: a press runs out through it and the seams shut with the low light, and it is a coin again,
 *                    the reader's words whole on it (the stage hands it back), a glint run over it. The steps are said
 *                    round it as their parts come in.
 *   Scrolled back, all of it runs backwards: the reader's words give way to his again.
 *   Then a breath, and the screen scrolls on, the coin going on with the reader (DotStage stepBand).
 */
export const PROCESS_AT = {
  rake: [1.5, 2], open: [2.06, 2.61], view: [2.08, 2.56], turn: [2.06, 2.56], scatter: [2.76, 3.41], level: [2.81, 3.36],
  draw: [3.41, 5.06], fly: .5, lock: [5.03, 5.49], glint: [5.49, 5.85],
};
export const PROCESS_SCREENS = 6.01;
/**
 * The headline: where each line changes to the next (m; the first as the coin arrives), and how long that takes: the
 * old line wholly faded out in the first half, the new one faded in over the second, so two are never seen together.
 */
export const LINES_AT = [-.1, 1.82, 2.31, 2.91, 3.46, 5.16];
export const LINE_CHANGE = .24;

const along = (m, [from, to]) => clamp((m - from) / (to - from));

/** Where (m) each thing the coin says starts to roll in (coinWords: the four steps, his words, the reader's), and how long it takes. */
export const WORD_TURNS = [-.32, .06, .44, .82, 1.2, 1.72], WORD_TURN = .2;
/**
 * What the coin says at `m` (coinWords): `{ from, to, u }`, `u` of the way from saying `from` to saying `to`; null before
 * the first. With motion kept small, each is simply there in its turn.
 */
export function wordTurn(m, reduced = false) {
  let to = -1;
  WORD_TURNS.forEach((at, i) => { if (m >= at) to = i; });
  if (to < 0) return null;
  return { from: to - 1, to, u: reduced ? 1 : clamp((m - WORD_TURNS[to]) / WORD_TURN) };
}

/** When the `i`th of the eight (DOCK order) leaves its place to be drawn back in. */
export const drawnFrom = i => PROCESS_AT.draw[0] + i * (PROCESS_AT.draw[1] - PROCESS_AT.draw[0] - PROCESS_AT.fly) / 7;
/** How far the `i`th is on its way back in at `m` (0 → 1). */
export const drawn = (m, i) => clamp((m - drawnFrom(i)) / PROCESS_AT.fly);
/** How far the `i`th has turned over to its back as the coin opens (0 → 1), one after another. */
export const turned = (m, i) => {
  const [from, to] = PROCESS_AT.turn, each = .22;
  return clamp((m - from - i * (to - from - each) / 7) / each);
};
/** How much step `k`'s name is said: once both its parts are in. */
const said = (m, k) => smooth((m - drawnFrom(k * 2 + 1) - PROCESS_AT.fly + .04) / .16);

/**
 * At `m`: the low light across it (`graze`, 0 → 1 → 0), and what it shows
 * (`reveal`: the seams, until the lock shuts them); the coin opened (`open`) and the view turned to
 * show its layers (`view`); the pieces gone out to their places (`scatter`); the lock running out through it (`lock`,
 * uneased: the stage shapes it) and its glint (`glint`); how much each step's name is said (`said`, four) and the one
 * said last (`latest`, -1 before any). With motion kept small, every change is a cut, at the middle of its stretch.
 */
export function processTransition(m, reduced = false) {
  const step = (value, at) => (reduced ? (value >= at ? 1 : 0) : value);
  const lock = along(m, PROCESS_AT.lock);
  const t = {
    graze: reduced ? 0 : smooth(along(m, PROCESS_AT.rake)) * (1 - smooth(along(m, PROCESS_AT.level))),
    reveal: step(smooth(along(m, PROCESS_AT.rake)), .5) * (1 - step(smoother(lock), .5)),
    open: reduced ? 0 : smoother(along(m, PROCESS_AT.open)),
    view: reduced ? 0 : smoother(along(m, PROCESS_AT.view)) * (1 - smoother(along(m, PROCESS_AT.level))),
    scatter: step(smoother(along(m, PROCESS_AT.scatter)), .5),
    lock: reduced ? 0 : lock,
    glint: reduced ? 0 : along(m, PROCESS_AT.glint),
    said: [0, 1, 2, 3].map(k => step(said(m, k), .5)),
    latest: -1,
  };
  t.said.forEach((value, k) => { if (value > .5) t.latest = k; });
  return t;
}
