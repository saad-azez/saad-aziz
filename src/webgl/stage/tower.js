/**
 * The tower: the about's timeline, a column with a ribbon of road wound round
 * it, the coin climbing it a step of the way at a time (components/about draws
 * it; DotStage stands the coin on it). Both read the one geometry here, so the
 * coin is always on the road as it is drawn.
 *
 * Seen from a little above, square on: a point at angle θ round the column
 * (0 straight at the reader, growing to the right, round behind and back) is
 * `R sin θ` across from the middle and `ry cos θ` down from its circle, the
 * front of a turn a smile and the back of it hidden behind the column. The
 * road rises evenly with θ, from the foot of the column to its top.
 *
 * The stops: the first on the left of the front, the next on the right, the
 * one after on the left a turn up, and so on (the words about them go on the
 * same side), the last at the top, square in front: the coin on the summit.
 * Between a left stop and a right one the coin goes across the front; from a
 * right one to the next left, it goes round the back.
 *
 *   side    how far round from the front the stops stand (rad)
 *   lead    how far before the first stop the road starts (rad)
 *   tilt    how far from above it is seen: the circle's depth, of its radius
 *   band    the road's width, of the radius
 *   coin    the coin's radius, of the road's width
 *   face    at a stop, how much of the way the coin turns to face the reader
 */
export const TOWER = { side: 55 * Math.PI / 180, lead: 35 * Math.PI / 180, tilt: .3, band: .27, coin: .8, face: .65 };
const TAU = Math.PI * 2;

/** Where round the column each of `n` stops stands (rad, increasing up the road). */
export function stopAngles(n) {
  if (n <= 1) return [0];
  const angles = [];
  for (let i = 0; i < n - 1; i++) angles.push((i % 2 ? TOWER.side : -TOWER.side) + TAU * Math.floor(i / 2));
  // The summit: square in front, the first time the road comes round to it after the last stop but one.
  angles.push(TAU * Math.ceil((angles[n - 2] + Math.PI) / TAU));
  return angles;
}

/**
 * The tower in a box `w` × `h` (px): `stacked` for a narrow or upright screen,
 * where the words go under it rather than either side. The column's middle
 * `cx`, radius `R` and circle depth `ry`; its top circle's middle `topY` and
 * its foot's `baseY`; the road's width `T`, its rise `pitch` (px a radian)
 * from `rise0` at `from` (rad) to the summit at `to`; the coin's radius `r`;
 * and the stops' angles.
 */
export function towerLayout({ w, h, n, stacked = false }) {
  const R = Math.max(40, stacked ? Math.min(w * .27, h * .21) : Math.min(w * .12, h * .22));
  const ry = R * TOWER.tilt, T = R * TOWER.band;
  const r = Math.max(10, T * TOWER.coin);
  const stops = stopAngles(n);
  const from = stops[0] - TOWER.lead, to = stops[stops.length - 1];
  // Room over the top for the coin standing on the summit; under the foot, for its circle.
  const topY = 2 * r + ry + 10, baseY = h - ry - 6;
  const rise0 = T * .9;
  const pitch = (baseY - topY - rise0) / Math.max(1e-6, to - from);
  return { w, h, stacked, cx: w / 2, R, ry, T, r, topY, baseY, rise0, pitch, from, to, stops };
}

/** The middle of the road at angle θ (px, in the tower's box), and how far toward the reader it faces (cos θ). */
export function towerAt(tower, angle) {
  const rise = tower.rise0 + (angle - tower.from) * tower.pitch;
  return {
    x: tower.cx + tower.R * Math.sin(angle),
    y: tower.baseY - rise + tower.ry * Math.cos(angle),
    depth: Math.cos(angle),
  };
}

/** The stretches of road in front of the column: [from, to] (rad), bottom to top. */
export function frontRuns(tower) {
  const runs = [];
  for (let k = Math.floor((tower.from + Math.PI / 2) / TAU) - 1; k * TAU - Math.PI / 2 < tower.to; k++) {
    const a = Math.max(tower.from, k * TAU - Math.PI / 2), b = Math.min(tower.to, k * TAU + Math.PI / 2);
    if (b > a + 1e-6) runs.push([a, b]);
  }
  return runs;
}

const fixed = value => Math.round(value * 10) / 10;
/** A line through points along the road from `a` to `b` (rad), each `dy` px off its middle. */
function along(tower, a, b, dy, reverse = false) {
  const steps = Math.max(2, Math.ceil(Math.abs(b - a) / (2 * Math.PI / 180)));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const p = towerAt(tower, a + (b - a) * (reverse ? 1 - i / steps : i / steps));
    points.push(`${fixed(p.x)} ${fixed(p.y + dy)}`);
  }
  return points;
}

/**
 * The drawing, as SVG path data in the tower's box: the column's body (its
 * sides, and the front of its foot), and for each stretch of road in front:
 * the road itself, the wall cut into the column behind it, the shadow it
 * throws on the column under it, and the line along it the coin leaves behind.
 */
export function towerPaths(tower) {
  const { cx, R, ry, T, topY, baseY } = tower;
  // Up to the front of its top circle (the top itself is drawn over it).
  const arc = `A${fixed(R)} ${fixed(ry)} 0 0`;
  const body = `M${fixed(cx - R)} ${fixed(topY)} V${fixed(baseY)} ${arc} 0 ${fixed(cx + R)} ${fixed(baseY)} V${fixed(topY)} ${arc} 1 ${fixed(cx - R)} ${fixed(topY)} Z`;
  const runs = frontRuns(tower).map(([a, b]) => {
    const band = (top, bottom) => `M${along(tower, a, b, top).join(' L')} L${along(tower, a, b, bottom, true).join(' L')} Z`;
    return {
      a, b,
      road: band(-T * .5, T * .5),
      wall: band(-T * .5, -T * .1),
      shadow: band(T * .5, T * 1.05),
      trail: `M${along(tower, a, b, T * .12).join(' L')}`,
    };
  });
  return { body, runs };
}
