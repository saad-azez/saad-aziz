const clamp = value => Math.max(0, Math.min(1, value));
const smoother = value => { const t = clamp(value); return t ** 3 * (t * (t * 6 - 15) + 10); };

/**
 * After the process (components/about's last part, DotStage stepBand): the coin becoming a ring, and the band of words
 * threaded through it. One pinned screen, all of it a function of `m`, the way along its scroll in screens: -1 as it
 * comes up under the about, 0 pinned, to MORE_SCREENS. The reader drives it and scrolling back plays it backwards.
 *
 *   ARRIVE   -1 → 0   the coin, finished (the gold monogram), follows the reader down from the bench to the middle of
 *                     the new screen, face on, growing to the ring's size;
 *   MELT              a ring of light runs out from its middle to its rim, the monogram washed off before it: a plain coin;
 *   FORM              it is punched out: face on, a hole opens at its middle and grows (`hole`, how far into FORM the
 *                     ring takes before it tips), then its rim deepens into a band as it tips back and leans, turning;
 *   ENGRAVE           the words are written round it, as if cut, glowing the monogram's gold, then settling;
 *   THREAD            only then, a thread is drawn out through the ring to the rails either side,
 *   OPEN              and opens into the band, the ring threaded through it;
 *   ROWS              its rows of words rising into it, one after another (`stagger`), and running with the scroll;
 *   then a breath, and the screen scrolls on with the ring on it.
 */
export const MORE = {
  MELT: [0, .4], FORM: [.42, 1.05], hole: .4, ENGRAVE: [.95, 1.35], THREAD: [1.35, 1.62], OPEN: [1.58, 1.82],
  ROWS: [1.72, 2.02], stagger: .07,
};
export const MORE_SCREENS = 2.4;

const along = (m, [from, to]) => clamp((m - from) / (to - from));

/** At `m`: each part 0 → 1 (`arrive`, `melt`, `form`, `tilt`, `engrave`, `thread`, `open`), and `row(i)` for row i's rising. */
export function moreTransition(m, reduced = false) {
  if (reduced) {
    const on = m >= 0 ? 1 : 0;
    return { arrive: clamp(m + 1), melt: on, form: on, tilt: on, engrave: on, thread: on, open: on, row: () => on };
  }
  const form = along(m, MORE.FORM);
  return {
    arrive: smoother(m + 1),
    melt: along(m, MORE.MELT),
    form,
    tilt: smoother((form - MORE.hole) / (1 - MORE.hole)),
    engrave: along(m, MORE.ENGRAVE),
    thread: smoother(along(m, MORE.THREAD)),
    open: smoother(along(m, MORE.OPEN)),
    row: i => smoother(along(m, [MORE.ROWS[0] + i * MORE.stagger, MORE.ROWS[1] + i * MORE.stagger])),
  };
}
