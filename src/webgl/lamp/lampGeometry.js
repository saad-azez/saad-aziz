/**
 * The book lamp's shape, solved: where every fold of its accordion is for a
 * given opening. Pure arithmetic, no three.js, so `scripts/check-lamp.mjs`
 * can prove it and the vertex shader can trust it.
 *
 * The lamp (a Lumio-style folding book light) is:
 *
 *   - two hard covers hinged on a flexible spine;
 *   - one continuous sheet of Tyvek, zigzag folded into N pleats: an inner fold
 *     at the spine, an outer fold at the fore edge, an inner fold, and so on.
 *     Every face between two folds is a page. The first page is glued to the
 *     inside of the front cover, the last to the inside of the back cover;
 *     the inner folds between are free.
 *
 * Opened by an angle `phi` (0 shut, 2π the covers back to back):
 *
 *   - the covers turn symmetrically, to ±phi/2. Their inner corners start at
 *     the ends of the shut block and, as the book opens, migrate through the
 *     covers' own thickness, so that at 2π the covers' wooden backs meet (as
 *     the real lamp's magnets hold them) with the end pages outside;
 *   - the inner folds lie evenly along a circular arc from one inner corner
 *     to the other, bulging toward the pages. Its turn grows from 0 (shut, a
 *     straight stack one sheet apart) to a little over a half turn at 2π, so
 *     the arc leaves each cover tilting outward and the first pleat lies flat
 *     on the cover instead of running into the wood. The hub it makes is the
 *     size of a fingertip, as in the reference;
 *   - the first and last pages lie along their covers; every other outer fold
 *     (the tips) is spread evenly in angle round the arc's centre between
 *     those two, one page length out from its inner fold: 360°/(N-1) apart
 *     when open right round.
 *
 * Frame: the hinge axis is Z; the shut book lies along +X from the spine at
 * x = 0, its thickness along Y (cover A below, cover B above).
 */

/** The lamp's measures, in cm: a mini Lumio. */
export const LAMP = {
  /** Pleats (outer folds), counted round the reference's star. */
  pleats: 32,
  /** A page: spine to fore edge, and along the spine. */
  pageWidth: 10.2,
  pageHeight: 11.6,
  /** A sheet of Tyvek, with the air between two. */
  paper: 0.025,
  /** A cover: how far it reaches past the pages, its height, its thickness, its corner. */
  coverOverhang: 0.55,
  coverHeight: 12.6,
  coverThickness: 0.55,
  coverCorner: 0.7,
  /** A cover's lip past its hinge corner (short: the hub arc turns just past it when open). */
  coverLip: 0.1,
  /** The hub arc's turn when open right round: past a half turn, so it leaves the covers tilting outward. */
  fullArc: Math.PI * 200 / 180,
};

/** Faces (pages): two per pleat. */
export function faceCount(lamp = LAMP) { return lamp.pleats * 2; }
/** Fold points: inner, outer, inner, … , inner. */
export function foldCount(lamp = LAMP) { return lamp.pleats * 2 + 1; }
/** The shut block's thickness. */
export function blockThickness(lamp = LAMP) { return faceCount(lamp) * lamp.paper; }

function sinc(x) { return Math.abs(x) < 1e-5 ? 1 - x * x / 6 : Math.sin(x) / x; }

/**
 * The hub arc for an opening: its ends (the covers' inner corners), its turn,
 * and its centre and radius (the centre is far off to the left when nearly
 * shut; use the ends and the turn then).
 */
export function hubArc(open, lamp = LAMP) {
  open = Math.max(0, Math.min(1, open));
  const W = blockThickness(lamp);
  const phi = open * Math.PI * 2;
  // The shut block's ends, turned with the covers (a strip of width W bent to phi).
  const h = phi * 0.25;
  const endX = W * 0.5 * sinc(h) * Math.sin(h);   // toward -X as it bends
  const endY = W * 0.5 * sinc(phi * 0.5);
  // The covers' inner corners: from those ends, back through the wood by the time the book is open round.
  const c = open * open;
  const shift = c * (lamp.coverThickness + 0.01);
  // Cover A points to -phi/2; away from its pages is that turned a quarter clockwise.
  const ax = Math.cos(phi / 2), ay = -Math.sin(phi / 2);
  const awayAx = ay, awayAy = -ax;
  const p0x = -endX - awayAx * shift, p0y = -endY - awayAy * shift;
  const pNx = -endX + awayAx * shift, pNy = endY + awayAy * shift;  // mirrored in y
  const alpha = phi + (lamp.fullArc - Math.PI * 2) * c;
  const dx = pNx - p0x, dy = pNy - p0y;
  const chord = Math.hypot(dx, dy);
  const ux = dx / chord, uy = dy / chord;
  // The pages bulge to the right of the chord (from A to B); the centre sits on its left for turns under a half.
  const R = alpha > 1e-6 ? chord / (2 * Math.sin(alpha / 2)) : Infinity;
  const mx = (p0x + pNx) / 2, my = (p0y + pNy) / 2;
  const cos = Math.cos(alpha / 2);
  const cx = Number.isFinite(R) ? mx - uy * R * cos : -Infinity;
  const cy = Number.isFinite(R) ? my + ux * R * cos : 0;
  return { p0x, p0y, pNx, pNy, alpha, chord, ux, uy, mx, my, R, cx, cy };
}

/** A point on the hub arc at fraction s (0 at cover A's corner → 1 at cover B's). Stable for a tiny turn. */
export function hubPoint(arc, s, out = [0, 0]) {
  const { alpha, chord, ux, uy, mx, my } = arc;
  const t = s - 0.5;
  const along = chord * t * sinc(alpha * t) / sinc(alpha / 2);
  // Across, to the right of the chord: (cos(alpha t) - cos(alpha/2)) / sin(alpha/2), finite as alpha → 0.
  const across = alpha > 1e-6
    ? chord * 0.5 * (Math.cos(alpha * t) - Math.cos(alpha / 2)) / Math.sin(alpha / 2)
    : 0;
  out[0] = mx + ux * along + uy * across;
  out[1] = my + uy * along - ux * across;
  return out;
}

/**
 * Every fold point for an opening `open` (0 shut → 1 the covers back to back),
 * as a flat array [x0, y0, x1, y1, …] of 2N+1 points, inner and outer folds
 * alternating. Pass `out` to reuse it.
 */
export function solveFolds(open, lamp = LAMP, out) {
  const N = lamp.pleats;
  const L = lamp.pageWidth;
  open = Math.max(0, Math.min(1, open));
  const phi = open * Math.PI * 2;
  const arc = hubArc(open, lamp);
  const folds = out || new Float32Array(foldCount(lamp) * 2);
  const p = [0, 0];
  for (let k = 0; k <= N; k++) {
    hubPoint(arc, k / N, p);
    folds[4 * k] = p[0];
    folds[4 * k + 1] = p[1];
  }
  // The end pages lie along their covers.
  const cA = Math.cos(phi / 2), sA = -Math.sin(phi / 2);
  folds[2] = folds[0] + L * cA;
  folds[3] = folds[1] + L * sA;
  const last = 2 * (2 * N - 1);
  folds[last] = folds[4 * N] + L * cA;
  folds[last + 1] = folds[4 * N + 1] - L * sA;
  if (!Number.isFinite(arc.R) || arc.R > 1e4) {
    // Shut: a flat stack, the tips evenly up the fore edge.
    for (let k = 1; k < N - 1; k++) {
      const t = k / (N - 1);
      folds[4 * k + 2] = folds[2] + (folds[last] - folds[2]) * t;
      folds[4 * k + 3] = folds[3] + (folds[last + 1] - folds[3]) * t;
    }
    return folds;
  }
  // Open: the tips on rays from the arc's centre, evenly between the first and the last.
  const { cx, cy, R } = arc;
  const psi0 = Math.atan2(folds[3] - cy, folds[2] - cx);
  let sweep = Math.atan2(folds[last + 1] - cy, folds[last] - cx) - psi0;
  if (sweep <= 0) sweep += Math.PI * 2;
  for (let k = 1; k < N - 1; k++) {
    const psi = psi0 + sweep * (k / (N - 1));
    const theta = Math.atan2(folds[4 * k + 1] - cy, folds[4 * k] - cx);
    // Where the ray meets a page length from the inner fold: sin(gamma - psi) = R sin(psi - theta) / L.
    const gamma = psi + Math.asin(Math.max(-1, Math.min(1, R * Math.sin(psi - theta) / L)));
    folds[4 * k + 2] = folds[4 * k] + L * Math.cos(gamma);
    folds[4 * k + 3] = folds[4 * k + 1] + L * Math.sin(gamma);
  }
  return folds;
}

/**
 * Per face: how far it may bow sideways without meeting a neighbour (the room
 * in front of and behind its middle, cm), and how tightly packed it is (0
 * spread wide → 1 shut against its neighbours). Both feed the paper's sag and
 * its self-shadowing.
 */
export function faceRoom(folds, lamp = LAMP, out) {
  const F = faceCount(lamp);
  const room = out || new Float32Array(F * 2);
  const L = lamp.pageWidth;
  for (let f = 0; f < F; f++) {
    const ax = folds[2 * f], ay = folds[2 * f + 1];
    const bx = folds[2 * f + 2], by = folds[2 * f + 3];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let clear = Infinity;
    for (const g of [f - 1, f + 1]) {
      if (g < 0 || g >= F) continue;
      const cx = folds[2 * g], cy = folds[2 * g + 1];
      const ex = folds[2 * g + 2], ey = folds[2 * g + 3];
      // The neighbour's distance from this face's middle, along the normal, at the middle's foot.
      const ux = ex - cx, uy = ey - cy;
      const ul = Math.hypot(ux, uy) || 1;
      const t = ((mx - cx) * ux + (my - cy) * uy) / (ul * ul);
      const tc = Math.max(0, Math.min(1, t));
      const qx = cx + ux * tc, qy = cy + uy * tc;
      const dist = Math.abs((qx - mx) * nx + (qy - my) * ny);
      if (dist < clear) clear = dist;
    }
    if (clear === Infinity) clear = L;
    room[2 * f] = clear;
    // Packed: the neighbours within a few sheets' thickness.
    room[2 * f + 1] = 1 - Math.min(1, clear / (lamp.paper * 12));
  }
  return room;
}

/**
 * Where a cover sits: its origin (its inner corner at the hinge, where the
 * page glued to it starts) and its axes in the lamp's XY plane, x outward
 * along the cover, y away from the pages (through the wood to its back).
 * `which` 0 = cover A (the front, below when shut), 1 = cover B.
 */
export function coverFrame(folds, which, lamp = LAMP) {
  const F = faceCount(lamp);
  let ox, oy, dx, dy;
  if (which === 0) {
    ox = folds[0]; oy = folds[1];
    dx = folds[2] - ox; dy = folds[3] - oy;
  } else {
    ox = folds[2 * F]; oy = folds[2 * F + 1];
    dx = folds[2 * F - 2] - ox; dy = folds[2 * F - 1] - oy;
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  // Away from the pages: below cover A (clockwise from x), above cover B (anticlockwise).
  const yx = which === 0 ? dy : -dy;
  const yy = which === 0 ? -dx : dx;
  return { ox, oy, xx: dx, xy: dy, yx, yy };
}

/**
 * The pair of faces that cross (an intersection of their segments away from a
 * shared fold), or null: for the proof script.
 */
export function facesCross(folds, lamp = LAMP) {
  const F = faceCount(lamp);
  const seg = f => [folds[2 * f], folds[2 * f + 1], folds[2 * f + 2], folds[2 * f + 3]];
  const orient = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (let f = 0; f < F; f++) {
    const [ax, ay, bx, by] = seg(f);
    for (let g = f + 2; g < F; g++) {
      const [cx, cy, dx, dy] = seg(g);
      const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
      const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
      if (o1 * o2 < 0 && o3 * o4 < 0) return [f, g];
    }
  }
  return null;
}

/**
 * The first fold point that lies inside a cover's wood (deeper than `tolerance`
 * cm), as [fold, cover], or null: for the proof script. Checks the fold points
 * and every page's middle.
 */
export function foldInCover(folds, lamp = LAMP, tolerance = 0.002) {
  const F = faceCount(lamp);
  const x0 = -lamp.coverLip, x1 = lamp.pageWidth + lamp.coverOverhang;
  for (let which = 0; which < 2; which++) {
    const c = coverFrame(folds, which, lamp);
    const inside = (px, py) => {
      const rx = px - c.ox, ry = py - c.oy;
      const x = rx * c.xx + ry * c.xy;
      const y = rx * c.yx + ry * c.yy;
      return x > x0 + tolerance && x < x1 - tolerance && y > tolerance && y < lamp.coverThickness - tolerance;
    };
    for (let k = 0; k <= F; k++) {
      if (inside(folds[2 * k], folds[2 * k + 1])) return [k, which];
      if (k < F && inside((folds[2 * k] + folds[2 * k + 2]) / 2, (folds[2 * k + 1] + folds[2 * k + 3]) / 2)) return [k + 0.5, which];
    }
  }
  return null;
}
