import { useLayoutEffect, useState } from 'react';
import './Rails.css';

/**
 * The drafting margins.
 *
 * Two fixed rails that mark where the content is allowed to live — the hairline
 * on each inner edge is the boundary, and nothing crosses it. They are ruled
 * like the margin of an engineering drawing, which is the same world the
 * cyanotype palette comes from.
 *
 * Deliberately empty. A margin is structure, not a shelf: the moment you park
 * text in it you are filling space rather than measuring it, and the words that
 * end up there are always the ones nobody would have written on purpose.
 * Everything worth reading sits inside the frame.
 *
 * The ruled edge is drawn as real lines — the boundary line itself as a path,
 * and one `<path>` per graduation — rather than a border and a repeating
 * gradient, because the lamp out in the right-hand margin (components/cord)
 * shortens the graduations its light falls on, which nothing painted on could
 * do. The lamp never touches the rail, and nothing moves the boundary line.
 *
 * The contract is small and both sides state it. In each rail's `.rail__scale`:
 * the boundary line is the `.rail__edge`, straight at `M{data-x} 0 V{data-height}`,
 * and every graduation is a `.rail__tick` carrying its own `y` in `data-y` and
 * resting at `M0 y+.5 H5`. PullCord rewrites the `d` of the right-hand rail's
 * graduations in its light, and puts them all back.
 */

/* One graduation every 12px, each 5px long — an actual scale. `EDGE_X` is the
   boundary line's own pixel, measured from the margin's inner edge. */
export const TICK_GAP = 12;
export const TICK_LEN = 5;
export const EDGE_X = 0.5;

/** A graduation at rest: anchored on the boundary line, running out 5px. */
export const tickPath = (y, from = 0) => `M${from} ${y + 0.5}H${from + TICK_LEN}`;

/** Enough graduations for this viewport, rounded up so the count is stable. */
const countFor = height => Math.ceil((height + 240) / TICK_GAP);

export default function Rails({ visible }) {
  const [count, setCount] = useState(() => countFor(typeof window === 'undefined' ? 900 : window.innerHeight));

  // The ticks are made once and then left alone — the cord holds references to
  // them. A taller viewport adds more; a shorter one keeps what it has (the
  // rail's overflow hides the surplus) so the elements are never swapped out
  // from under the cord.
  useLayoutEffect(() => {
    const grow = () => setCount(was => Math.max(was, countFor(window.innerHeight)));
    grow();
    window.addEventListener('resize', grow);
    return () => window.removeEventListener('resize', grow);
  }, []);

  const state = visible ? ' rail--visible' : '';
  const height = count * TICK_GAP;
  const ticks = Array.from({ length: count }, (unused, i) => i * TICK_GAP);

  /**
   * One margin's ruled edge: the boundary line itself and its graduations, in
   * one drawing. The line is a path rather than a border because it is the
   * main thing the lamp's light acts on — a border cannot bow.
   *
   * The line sits on the margin's inner edge: at x 0.5 on the right-hand rail,
   * at x 4.5 on the left, so in both cases its single pixel lands exactly where
   * the border used to be.
   */
  const scale = side => {
    const at = side === 'right' ? EDGE_X : TICK_LEN - EDGE_X;
    return (
      <svg className="rail__scale" width={TICK_LEN} height={height} viewBox={`0 0 ${TICK_LEN} ${height}`} aria-hidden="true" focusable="false">
        <path className="rail__edge" data-height={height} data-x={at} d={`M${at} 0V${height}`} />
        {ticks.map(y => (
          <path className="rail__tick" key={y} data-y={y} d={tickPath(y)} />
        ))}
      </svg>
    );
  };

  return (
    <>
      <div className={`rail rail--left${state}`} aria-hidden="true">{scale('left')}</div>
      <div className={`rail rail--right${state}`} aria-hidden="true">{scale('right')}</div>
    </>
  );
}
