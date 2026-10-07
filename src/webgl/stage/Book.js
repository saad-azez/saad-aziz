import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { LITE } from '../../lib/device.js';
import { hubPoint } from '../lamp/lampGeometry.js';
import {
  PAGE_VERTEX, PAGE_FRAGMENT,
  COVER_VERTEX, COVER_FRAGMENT,
  HINGE_VERTEX, HINGE_FRAGMENT,
} from './bookShaders.js';

/**
 * THE BOOK: the projects as the leaves of one hardback, hinged on a horizontal
 * spine, turning round it the way kim_vanvuuren's rolodex does
 * (instagram.com/reels/DYE1G8TMlBf), only slower.
 *
 * It arrives SHUT, standing on its spine with its front cover to the reader,
 * and OPENS WITH THE SCROLL the way the Lumio book lamp does: the covers swing
 * apart until their wooden backs meet, and the leaves fan out right round the
 * spine between them.
 *
 * Open, the book is a closed ring of leaves: the twelve pages and the two
 * covers back to back (one leaf, in the ring). It only ever turns FORWARD,
 * toward the reader: the next page comes up from behind, over the top, and
 * stands on show; the one before falls forward. After the last page the covers
 * come round (the book turns over) and the first page follows them, so it
 * never has to turn back through everything it has shown.
 *
 * The page on show leans a little toward the reader with a clear gap in front
 * of it (FAN.gap), so nothing covers it; the others are spread evenly round
 * the rest of the ring. The whole book turns about its spine as the pages go
 * round, so the page on show is always in the same place.
 *
 * Every page is PAPER (PAPER): it droops under gravity by how level it lies,
 * its fore edge lags behind as it turns and runs on as it stops, it twists a
 * little and ripples as it lands, each page a little differently; and it never
 * passes through another page or a cover (constrainBends clips the bends,
 * proved by `npm run check:book`).
 *
 * Positions count leaves round the ring: page i (project i - 1) is on show at
 * `position` ≡ i, the covers at ≡ 0 (mod count + 1). It lives in the book's
 * own space (px, the spine along x; `group` is placed, turned and sized by
 * the stage); inside, `frame` maps the geometry's frame (x up from the spine,
 * y toward the reader, z along the spine) onto it and turns it about the spine.
 */

/** The pictures' shape: the top screen of each site (public/work/top/<id>.webp, 1200 × 750). */
export const PAGE_ASPECT = 1.6;
/** How far open (0 → 1) the stickers start to be laid flat, and where the covers' backs have met and they are gone. */
const STICKERS_FLAT = [.8, .985];
/** On a phone, how wide a picture is kept (px). */
const LITE_PICTURE = 800;
/** image drawn width wide, its shape kept. */
function shrink(image, width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(image.height * width / image.width);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
/**
 * The angle the book is seen from, as in the reel: a little from above, and
 * turned so the pages face in toward the middle of the screen, which shows the
 * whole ring of leaves round the spine.
 */
export const VIEW = { pitch: .16, yaw: .56, roll: 0 };

const D = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smoother = t => { const x = clamp(t); return x ** 3 * (x * (x * 6 - 15) + 10); };
const mod = (a, n) => ((a % n) + n) % n;
const wrapPi = a => a - TAU * Math.round(a / TAU);

/** The book's make, in page lengths (a page's reach out from the spine, L). */
export const BOOK = {
  /** A page: one sheet of thin paper. */
  paper: .0028,
  /** A cover: its wood, how far it reaches past the pages, its extra height each side, its corner, its lip past the hinge, and how far it bows out at its fore edge while the book is shut (flat once open: Book.bow). */
  cover: { thickness: .016, overhang: .025, margin: .025, corner: .035, lip: .012, bow: .035 },
  /** The spine: its back rounded out, as a hardback's is, this far at its middle (of its width across the boards). */
  round: .42,
  /** The air left between the covers' backs when they meet. */
  air: .002,
  /** How far the spine arc turns when the covers are back to back: past a half turn, so it leaves them tilting outward. */
  fullArc: 200 * D,
};

/**
 * The ring at rest: the page on show leans `show` toward the reader (0 is
 * straight up) with `gap` clear in front of it; the rest share the remainder
 * evenly. Under the pointer the page on show stands `lift` straighter and the
 * gap opens `open` wider.
 */
export const FAN = { show: 20 * D, gap: 64 * D, lift: 6 * D, open: 10 * D };

/**
 * The paper. `sag`: how far a page droops at its fore edge held level (of its
 * length). `drag`: how far its fore edge lags per radian a second of turning.
 * `omega`, `zeta`: its stiffness (rad/s) and damping — soft enough to sway.
 * `vary`: how much the pages differ (stiffness, sag). `twist`: the fore edge
 * lags more at one end than the other, per radian a second, and a page's own
 * warp. `flutter`: the ripple a page picks up as it starts and stops.
 */
export const PAPER = {
  sag: .24,
  drag: .12,
  omega: 8,
  zeta: .08,
  vary: .14,
  twist: { gain: .03, warp: .018, omega: 6.5, zeta: .3 },
  flutter: { omega: 26, zeta: .12, kick: 2.4, most: .06 },
};

/** The gutter: a page leaves the spine the way the spine faces there and bends round to its own angle on an arc this big (of its length). */
export const GUTTER = { radius: .03, least: .02, most: .3 };

/** Leaves round the ring: the pages, and the covers as one. */
export const ringSize = count => count + 1;

/** What is on show at a position: a project's page, or the covers. */
export function itemAt(position, count) {
  const k = mod(Math.round(position), ringSize(count));
  return k === 0 ? { cover: true } : { cover: false, project: k - 1 };
}

/** How far open the book is for `open` (0 → 1 of the scroll's way): eased, so it starts and stops gently. */
export const openAmount = open => smoother(open);

/**
 * The ring for a position: every leaf's angle about the spine in the book's
 * frame, [cover A, page 1 … page `count`, cover B], `open` of the way from
 * shut (all straight up) to open (covers at ±π); and `spin`, the whole book's
 * turn about its spine that puts the page on show in its place (unwrapped:
 * it grows a full turn every time round the ring).
 */
export function ringLayout(position, count, lit = 0, open = 1, out, ajar = 0, riffle = null) {
  const M = ringSize(count);
  const angles = out || new Float64Array(count + 2);
  const show = FAN.show - FAN.lift * lit;
  const gap = FAN.gap + FAN.open * lit;
  const spacing = (TAU - gap) / (M - 1);
  // How far round from the page on show a leaf is, by how many places behind it the reader has yet to see it (0 → M).
  const offset = x => (x < 1 ? gap * smoother(x) : gap + (x - 1) * spacing);
  const x0 = mod(position, M);
  const o0 = offset(x0);
  // Shut, the book can stand a little ajar (the entry: its pages fanning as it moves), gone as it opens.
  const extra = ajar * (1 - smoother(openAmount(open) / .15));
  const amount = openAmount(open) + extra;
  angles[0] = -Math.PI * amount;
  angles[count + 1] = Math.PI * amount;
  // The riffle (shut, moved in the hand): the pages bunch and spread between the covers in a wave running
  // through the block, like pages fanned by the thumb. A monotone warp of their places (strength < 1), with
  // the covers held, so they never pass one another.
  const shut = 1 - smoother(openAmount(open) / .15);
  const wave = riffle ? Math.min(.95, riffle.amount) * shut : 0;
  const warp = s => (wave > 0 ? s + wave / TAU * (Math.sin(TAU * (s - riffle.phase)) + Math.sin(TAU * riffle.phase)) : s);
  for (let i = 1; i <= count; i++) angles[i] = (warp(mod(offset(mod(position - i, M)) - o0, TAU) / TAU) - .5) * TAU * amount;
  const spin = show + o0 + TAU * Math.floor(position / M) - Math.PI;
  return { angles, spin, amount, extra };
}

function sinc(x) { return Math.abs(x) < 1e-5 ? 1 - x * x / 6 : Math.sin(x) / x; }

/**
 * The spine, `amount` open (0 shut → 1 the covers back to back), for a block
 * of leaves `W` thick, covers `coverThickness` thick: the arc the leaves are
 * hinged along, from cover A's inner corner to cover B's, bulging toward the
 * pages. Shut it is a straight line W long; open it turns just past a half
 * turn (BOOK.fullArc) so it leaves each cover tilting outward, the covers'
 * inner corners having moved through the wood so their backs meet. In the
 * geometry's frame: x up from the spine, y toward the reader.
 */
export function bookHub(amount, W, coverThickness, air = 0, fullArc = BOOK.fullArc) {
  const phi = TAU * amount;
  const h = phi * 0.25;
  const endX = W * 0.5 * sinc(h) * Math.sin(h);
  const endY = W * 0.5 * sinc(phi * 0.5);
  const c = amount * amount;
  const shift = c * (coverThickness + air);
  const ax = Math.cos(phi / 2), ay = -Math.sin(phi / 2);
  const awayAx = ay, awayAy = -ax;
  const p0x = -endX - awayAx * shift, p0y = -endY - awayAy * shift;
  const pNx = -endX + awayAx * shift, pNy = endY + awayAy * shift;
  const alpha = phi + (fullArc - TAU) * c;
  const dx = pNx - p0x, dy = pNy - p0y;
  const chord = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / chord, uy = dy / chord;
  const R = alpha > 1e-6 ? chord / (2 * Math.sin(alpha / 2)) : Infinity;
  const mx = (p0x + pNx) / 2, my = (p0y + pNy) / 2;
  const cos = Math.cos(alpha / 2);
  const cx = Number.isFinite(R) ? mx - uy * R * cos : -Infinity;
  const cy = Number.isFinite(R) ? my + ux * R * cos : 0;
  return { phi, p0x, p0y, pNx, pNy, alpha, chord, ux, uy, mx, my, R, cx, cy };
}

/** The spine's outward normal (toward the pages) where leaf fraction `s` is bound, as an angle. */
export function rootAngle(arc, s) {
  const a = hubPoint(arc, Math.max(0, s - 1e-3));
  const b = hubPoint(arc, Math.min(1, s + 1e-3));
  return Math.atan2(-(b[0] - a[0]), b[1] - a[1]);
}

/** Where along the spine page i (of `count`) is bound: 0 at cover A's corner → 1 at cover B's, the first page nearest B. */
export const pageRootFraction = (i, count) => 1 - (i - .5) / count;

/** How much of a page is gutter, leaving the spine at `rootAngle` and turning to `angle`. */
export const gutterFraction = (angle, root) => clamp(GUTTER.radius * Math.abs(angle - root), GUTTER.least, GUTTER.most);

/** A page's bow along its length: a cantilever under its own weight (1 at the fore edge), and the ripple (a node near the fore edge). */
export const psi1 = u => u * u * (6 - 4 * u + u * u) / 3;
export const psi2 = u => 3.5714 * u * u * (u - .72);

/**
 * A point on page `leaf` in the book's frame: `u` out from the spine (0 → 1),
 * `v` along it (0 → 1), for a page `L` long. `leaf`: { rx, ry, ra, angle,
 * gutter, bend, twist, flutter }. The vertex shader draws the same.
 */
export function leafPoint(leaf, u, v, L, out = [0, 0]) {
  const da = leaf.angle - leaf.ra;
  const ug = Math.min(u, leaf.gutter);
  let a = leaf.ra + da * (ug / leaf.gutter);
  let x, y;
  if (Math.abs(da) < 1e-4) {
    x = leaf.rx + Math.cos(leaf.ra) * ug * L;
    y = leaf.ry + Math.sin(leaf.ra) * ug * L;
  } else {
    const r = L * leaf.gutter / da;
    x = leaf.rx + r * (Math.sin(a) - Math.sin(leaf.ra));
    y = leaf.ry + r * (Math.cos(leaf.ra) - Math.cos(a));
  }
  if (u > leaf.gutter) {
    a = leaf.angle;
    x += Math.cos(a) * (u - leaf.gutter) * L;
    y += Math.sin(a) * (u - leaf.gutter) * L;
  }
  const w = L * ((leaf.bend + leaf.twist * (v - .5)) * psi1(u) + leaf.flutter * psi2(u));
  out[0] = x - Math.sin(a) * w;
  out[1] = y + Math.cos(a) * w;
  return out;
}

/* ----- keeping the pages apart ------------------------------------------ */

/** Where along a page the clearance is measured (out from the gutter, where the leaves are bound together), and at which heights. */
const SAMPLES_U = Array.from({ length: 12 }, (_, k) => .12 + .88 * k / 11);
const SAMPLES_V = [0, .5, 1];

/**
 * The point the ring is measured round: the spine arc's centre once the book
 * is open, a little behind the spine while it is nearly shut (where that
 * centre is far off). And the radius inside which the leaves are bound
 * together at the spine, not measured.
 */
export function ringCentre(arc, L) {
  const mid = hubPoint(arc, .5);
  const inward = [-arc.uy, arc.ux];
  const back = Math.min(Number.isFinite(arc.R) ? arc.R : Infinity, .25 * L);
  return { x: mid[0] + inward[0] * back, y: mid[1] + inward[1] * back, rMin: .1 * L + back };
}

/**
 * A leaf's outline round the ring: for each height, its angle round the
 * centre at each radius out from it. Pages are sampled along their length;
 * a cover along the middle of its wood. `nominal` keeps the angles unwrapped
 * near the leaf's own.
 */
function outline(leaf, L, centre, into) {
  const p = [0, 0];
  for (let s = 0; s < SAMPLES_V.length; s++) {
    const row = into[s];
    for (let k = 0; k < SAMPLES_U.length; k++) {
      const u = SAMPLES_U[k];
      if (leaf.cover) {
        const reach = u * L * (1 + BOOK.cover.overhang);
        p[0] = leaf.rx + leaf.dx * reach;
        p[1] = leaf.ry + leaf.dy * reach;
      } else leafPoint(leaf, u, SAMPLES_V[s], L, p);
      const x = p[0] - centre.x, y = p[1] - centre.y;
      row.r[k] = Math.hypot(x, y);
      row.a[k] = leaf.nominal + wrapPi(Math.atan2(y, x) - leaf.nominal);
    }
    // How square the leaf runs to the circle round the centre here: the gap between two leaves across it is the gap round the circle times this.
    const K = SAMPLES_U.length;
    for (let k = 0; k < K; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(K - 1, k + 1);
      const dr = row.r[k1] - row.r[k0], da = (row.a[k1] - row.a[k0]) * row.r[k];
      row.c[k] = Math.max(.25, Math.abs(dr) / (Math.hypot(dr, da) || 1));
    }
  }
}

/** A leaf's angle round the centre at radius `r`, from its outline (undefined outside it). */
function angleAt(row, r) {
  const { r: rs, a } = row;
  if (r < rs[0] || r > rs[rs.length - 1]) return undefined;
  for (let k = 0; k < rs.length - 1; k++) {
    if (r >= rs[k] && r <= rs[k + 1]) {
      const t = rs[k + 1] > rs[k] ? (r - rs[k]) / (rs[k + 1] - rs[k]) : 0;
      return a[k] + (a[k + 1] - a[k]) * t;
    }
  }
  return undefined;
}

/**
 * The clearance between two leaves next to each other round the ring (`low`
 * the one at the smaller angle), in px: the least gap between them, less
 * both their half-thicknesses and `extra`; below 0 they are too close. And
 * where (u) on the pages it was least.
 */
function clearance(low, high, rMin, extra = 0) {
  let least = Infinity, where = 1;
  const need = low.half + high.half + extra;
  for (let s = 0; s < SAMPLES_V.length; s++) {
    const A = low.rows[s], B = high.rows[s];
    for (let k = 0; k < SAMPLES_U.length; k++) {
      let r = B.r[k];
      if (r >= rMin) {
        const a = angleAt(A, r);
        if (a !== undefined) { const c = (B.a[k] - a) * r * B.c[k] - need; if (c < least) { least = c; where = SAMPLES_U[k]; } }
      }
      r = A.r[k];
      if (r >= rMin) {
        const b = angleAt(B, r);
        if (b !== undefined) { const c = (b - A.a[k]) * r * A.c[k] - need; if (c < least) { least = c; where = SAMPLES_U[k]; } }
      }
    }
  }
  return { least, where };
}

const makeRows = () => SAMPLES_V.map(() => ({ r: new Float64Array(SAMPLES_U.length), a: new Float64Array(SAMPLES_U.length), c: new Float64Array(SAMPLES_U.length) }));

/**
 * How thick a leaf counts as, each side of its middle: a cover its whole wood;
 * a page nine tenths of its sheet (a
 * tenth of a sheet, a tenth of a pixel, may meet its neighbour's, unseen),
 * which is also what lets two leaves lie together in a shut book.
 */
export const leafHalf = (cover, L) => (cover ? BOOK.cover.thickness * L / 2 : .45 * BOOK.paper * L);
/**
 * The room left between bent pages on top of that, as they open (px): enough
 * that nothing between the points measured comes nearer.
 */
export const bendRoom = (amount, L) => L * Math.max(.0002, .0025 * smoother(amount / .3));

/**
 * The leaves in ring order (cover A, page count … page 1, cover B) for the
 * book `amount` open with every leaf at `angles` (ringLayout), for pages `L`
 * long: their roots on the spine, gutters, and no bend. For the stage and
 * for the proof.
 */
export function ringLeaves(angles, count, L, amount, leaves = []) {
  const t = BOOK.paper * L, Ct = BOOK.cover.thickness * L;
  const arc = bookHub(amount, count * t, Ct, BOOK.air * L);
  const make = i => leaves[i] || (leaves[i] = { rows: makeRows(), bend: 0, twist: 0, flutter: 0 });
  // Cover A, then the pages from the last to the first, then cover B.
  for (let n = 0; n < count + 2; n++) {
    const leaf = make(n);
    if (n === 0 || n === count + 1) {
      const which = n === 0 ? 0 : 1;
      const angle = which === 0 ? -arc.phi / 2 : arc.phi / 2;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const awayX = which === 0 ? dy : -dy, awayY = which === 0 ? -dx : dx;
      const ox = which === 0 ? arc.p0x : arc.pNx, oy = which === 0 ? arc.p0y : arc.pNy;
      Object.assign(leaf, { cover: true, page: 0, angle, nominal: angle, dx, dy,
        rx: ox + awayX * Ct / 2, ry: oy + awayY * Ct / 2, half: leafHalf(true, L) });
    } else {
      const i = count + 1 - n;
      const s = pageRootFraction(i, count);
      const root = hubPoint(arc, s);
      const ra = rootAngle(arc, s);
      const angle = angles[i];
      Object.assign(leaf, { cover: false, page: i, angle, nominal: angle, ra, rx: root[0], ry: root[1],
        gutter: gutterFraction(angle, ra), half: leafHalf(false, L) });
    }
  }
  leaves.length = count + 2;
  return { leaves, arc };
}

/**
 * Clip the pages' bends so that no page comes nearer a neighbour (or a cover)
 * than their thicknesses allow. Pairs that touch are pushed apart by moving
 * both bends (a cover does not bend); then, if anything still touches, every
 * bend is scaled back together until nothing does (straight, they are always
 * clear: see check:book). Returns whether it had to clip anything; `clipped`
 * (by ring index) marks the leaves it moved.
 */
export function constrainBends(leaves, arc, L, clipped, amount = 1) {
  const centre = ringCentre(arc, L);
  const n = leaves.length;
  const refresh = leaf => outline(leaf, L, centre, leaf.rows);
  leaves.forEach(refresh);
  const tolerance = -1e-6 * L;
  const extra = bendRoom(amount, L);
  let any = false;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let k = 0; k + 1 < n; k++) {
      const low = leaves[k], high = leaves[k + 1];
      const { least, where } = clearance(low, high, centre.rMin, extra);
      if (least >= tolerance) continue;
      moved = true;
      // The bend that moves the page's edge there by the shortfall (a little over, to settle).
      const shift = (-least * 1.1 + 1e-4 * L) / (L * Math.max(.2, psi1(where)));
      const lows = low.cover ? 0 : high.cover ? 1 : .5;
      if (!low.cover) { low.bend -= shift * lows; low.twist *= .7; low.flutter *= .7; if (clipped) clipped[k] = 1; refresh(low); }
      if (!high.cover) { high.bend += shift * (1 - lows); high.twist *= .7; high.flutter *= .7; if (clipped) clipped[k + 1] = 1; refresh(high); }
    }
    if (!moved) return any;
    any = true;
  }
  // Anything still touching: bring every bend back toward straight, together, until nothing does.
  const bends = leaves.map(leaf => [leaf.bend, leaf.twist, leaf.flutter]);
  const clear = scale => {
    leaves.forEach((leaf, k) => {
      if (leaf.cover) return;
      [leaf.bend, leaf.twist, leaf.flutter] = bends[k].map(b => b * scale);
      refresh(leaf);
    });
    for (let k = 0; k + 1 < n; k++) if (clearance(leaves[k], leaves[k + 1], centre.rMin, extra).least < tolerance) return false;
    return true;
  };
  if (!clear(1)) {
    let lo = 0, hi = 1;
    for (let step = 0; step < 12; step++) { const mid = (lo + hi) / 2; if (clear(mid)) lo = mid; else hi = mid; }
    clear(lo);
    if (clipped) leaves.forEach((leaf, k) => { if (!leaf.cover) clipped[k] = 1; });
  }
  return true;
}

/** The least clearance between leaves next to each other round the ring (px), for the proof. */
export function ringClearance(leaves, arc, L) {
  const centre = ringCentre(arc, L);
  leaves.forEach(leaf => outline(leaf, L, centre, leaf.rows));
  let least = Infinity, pair = null;
  for (let k = 0; k + 1 < leaves.length; k++) {
    const c = clearance(leaves[k], leaves[k + 1], centre.rMin).least;
    if (c < least) { least = c; pair = [k, k + 1]; }
  }
  return { least, pair, centre };
}

/**
 * Per page: how packed it is, 0 spread wide → 1 shut against its neighbours,
 * for its shading near the spine.
 */
function packing(angles, count, out) {
  for (let i = 1; i <= count; i++) {
    const before = angles[i] - angles[i === count ? 0 : i + 1];
    const after = angles[i === 1 ? count + 1 : i - 1] - angles[i];
    out[i - 1] = 1 - clamp(Math.min(before, after) / (12 * D));
  }
  return out;
}

/* ----- the object ------------------------------------------------------- */

/** A leaf: two faces (side ±1) and its cut edges, in (u out from the spine, v along it, side) space. aKind: 0 face, 1/2 the ends, 3 the fore edge, 4 the spine edge. */
function leafGeometry(segU, segV) {
  const pos = [], kind = [], index = [];
  const base = () => pos.length / 3;
  for (const side of [1, -1]) {
    const start = base();
    for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) { pos.push(i / segU, j / segV, side); kind.push(0); }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = start + j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
      if (side > 0) index.push(a, b, d, a, d, c); else index.push(a, d, b, a, c, d);
    }
  }
  for (const [v, k] of [[0, 1], [1, 2]]) {
    const start = base();
    for (let i = 0; i <= segU; i++) { pos.push(i / segU, v, 1, i / segU, v, -1); kind.push(k, k); }
    for (let i = 0; i < segU; i++) { const a = start + 2 * i; index.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  }
  for (const [u, k] of [[1, 3], [0, 4]]) {
    const start = base();
    for (let j = 0; j <= segV; j++) { pos.push(u, j / segV, 1, u, j / segV, -1); kind.push(k, k); }
    for (let j = 0; j < segV; j++) { const a = start + 2 * j; index.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geometry.setIndex(index);
  return geometry;
}

/** A cover's wood, in page lengths: x out from the hinge, y through the wood (0 the inner face), z along the spine. The fore corners rounded, a small bevel. */
function coverGeometry() {
  const { thickness, overhang, margin, corner, lip } = BOOK.cover;
  // Its edges rounded right over, as a board wrapped in its covering is.
  const x0 = -lip, x1 = 1 + overhang, h = PAGE_ASPECT / 2 + margin, r = corner, bevel = thickness * .46;
  const s = new THREE.Shape();
  s.moveTo(x0 + bevel, -h + bevel);
  s.lineTo(x1 - r, -h + bevel);
  s.absarc(x1 - r, -h + r, r - bevel, -Math.PI / 2, 0, false);
  s.lineTo(x1 - bevel, h - r);
  s.absarc(x1 - r, h - r, r - bevel, 0, Math.PI / 2, false);
  s.lineTo(x0 + bevel, h - bevel);
  s.closePath();
  const base = new THREE.ExtrudeGeometry(s, { depth: thickness - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 10 });
  const geometry = new TessellateModifier(.09, 7).modify(base);
  base.dispose();
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  // Flat: the bow is put on as it is drawn (COVER_VERTEX uBow), since it changes as the book opens.
  geometry.computeVertexNormals();
  return geometry;
}

/** A small seeded random, so every page is a little different, the same way every visit. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The paper's colour, and the room's light: soft from above and in front, a little from everywhere. */
const PAPER_COLOR = '#f7f5f0';
const LIGHT = {
  key: { dir: new THREE.Vector3(-.25, .75, .6).normalize(), color: new THREE.Color(1, .98, .95).multiplyScalar(.5) },
  ambient: new THREE.Color(.56, .55, .54),
};
/**
 * The shut book's give: how far ajar it stands at rest, and how far its covers
 * swing apart (of a full turn) per radian a second it is turned (in the hand,
 * or flying in), at most a fifth of a turn when it is spun hard, and their
 * spring (rad/s, damping): the covers flap open as it spins, as a hardback's
 * do, and fall shut again as it slows.
 */
const AJAR = { rest: .024, gain: .032, most: .2, omega: 7, zeta: .65 };
/** The pages' riffle while the shut book moves: how strong the wave is at the most, and how fast it runs (waves a second). */
const RIFFLE = { amount: .8, speed: 2.4 };
/** The most a page's turning is taken to accelerate (rad/s²), so a jolt never throws the paper. */
const MAX_ACCELERATION = 40;

export default class Book {
  /** `covers`: the covers' colours ({ colours: { board, spine, paper } }, bookCovers.js), what is written on them (`art`, journal/coverArt.js), `stickers` (making the stickers on them, journal/Stickers.js), and `onChange`, called when something on them needs drawing. */
  constructor(palette, covers) {
    this.group = new THREE.Group();
    this.group.name = 'book';
    this.group.visible = false;
    // The geometry's frame (x up from the spine, y toward the reader, z along the spine) onto the book's (spine along x), turned about the spine.
    this.frame = new THREE.Group();
    this.frame.matrixAutoUpdate = false;
    this.basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    this.frame.matrix.copy(this.basis);
    this.group.add(this.frame);
    this.palette = palette;
    this.width = 1;
    this.projects = [];
    this.textures = [];
    this.loaded = [];
    this.pages = [];
    this.leaves = [];
    this.spinShown = null;
    this.lastUpdate = 0;
    this.leaf = leafGeometry(28, 6);
    this.shared = {
      uKeyDir: { value: LIGHT.key.dir },
      uKeyColor: { value: LIGHT.key.color },
      uAmbient: { value: LIGHT.ambient },
      uLens: { value: new THREE.Vector3() },
      // A small light at the reader's pointer, in front of the screen (the stage moves it): what the covers and stickers catch.
      uCursor: { value: new THREE.Vector3(0, 0, 1000) },
    };
    /**
     * How far the boards bow out at their fore edge now: all of BOOK.cover.bow
     * shut, nothing once open (back to back, two bows would run into each
     * other). One value, read by the boards, the stickers on them and the coin.
     */
    this.bow = { value: BOOK.cover.bow };
    // The covers: plain boards, plain paper inside.
    const COVER_COLOURS = covers.colours;
    const wood = coverGeometry();
    this.covers = [0, 1].map(which => {
      const mesh = new THREE.Mesh(wood, new THREE.ShaderMaterial({
        vertexShader: COVER_VERTEX,
        fragmentShader: COVER_FRAGMENT,
        uniforms: {
          ...this.shared,
          uBow: this.bow,
          uBoard: { value: new THREE.Color(COVER_COLOURS.board) },
          uPaper: { value: new THREE.Color(COVER_COLOURS.paper) },
          // The journal written on it (journal/coverArt.js): the front on cover B, the back on A.
          uArt: { value: which === 1 ? covers.art.front.art : covers.art.back.art },
          uFinish: { value: which === 1 ? covers.art.front.finish : covers.art.back.finish },
          uFront: { value: which },
          uTexel: { value: new THREE.Vector2(...covers.art.texel) },
          uThick: { value: BOOK.cover.thickness },
          uFore: { value: 1 + BOOK.cover.overhang },
          uLip: { value: BOOK.cover.lip },
          uHalf: { value: PAGE_ASPECT / 2 + BOOK.cover.margin },
        },
      }));
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      this.frame.add(mesh);
      return mesh;
    });
    this.hinge = new THREE.Mesh(leafGeometry(48, 1), new THREE.ShaderMaterial({
      vertexShader: HINGE_VERTEX,
      fragmentShader: HINGE_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        ...this.shared,
        uArc: { value: 0 },
        uChordA: { value: new THREE.Vector2() },
        uChordB: { value: new THREE.Vector2() },
        uHeight: { value: 1 },
        uInset: { value: 0 },
        uThick: { value: 1 },
        uRound: { value: 0 },
        // The boards' covering, wrapped round the spine.
        uHide: { value: new THREE.Color(COVER_COLOURS.board) },
      },
    }));
    this.hinge.frustumCulled = false;
    this.frame.add(this.hinge);
    // The stickers, on the covers' outer faces, to be peeled off and stuck down again (made by the stage,
    // covers.stickers, so the book itself needs no pictures and runs anywhere, as in check:book).
    const { thickness, lip, overhang, margin } = BOOK.cover;
    this.stickers = covers.stickers?.({
      covers: this.covers, shared: this.shared, onChange: covers.onChange,
      board: { thickness, bow: this.bow, x0: -lip, x1: 1 + overhang, half: PAGE_ASPECT / 2 + margin },
    }) ?? null;
    this.angles = null;
    this._rz = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._g = new THREE.Vector3();
    this._cover = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  }

  /** The projects the pages show, in order. Their pictures load when `load` is called. */
  setProjects(projects) {
    if (this.projects.length === projects.length && this.projects.every((project, i) => project === projects[i])) return;
    this.textures.forEach(texture => texture?.dispose());
    this.projects = projects;
    this.textures = projects.map(() => null);
    this.loaded = projects.map(() => false);
    if (this.pages.length !== projects.length) this.makePages(projects.length);
  }

  /**
   * The uniforms a sheet of paper is drawn with (bookShaders PAGE_VERTEX,
   * PAGE_FRAGMENT): `shared`, the objects it has in common with other sheets
   * (the same objects, so one update moves them all), and its own.
   */
  sheetUniforms(seed, own = {}) {
    return {
      ...this.shared,
      uMap: { value: null },
      uHasMap: { value: 0 },
      uPaperColor: { value: new THREE.Color(PAPER_COLOR) },
      uAngle: { value: 0 },
      uRootAngle: { value: 0 },
      uGutter: { value: GUTTER.least },
      uBend: { value: 0 },
      uTwist: { value: 0 },
      uFlutter: { value: 0 },
      uRoot: { value: new THREE.Vector2() },
      uLength: { value: 1 },
      uHeight: { value: 1 },
      uPaper: { value: 1 },
      uPack: { value: 0 },
      uSeed: { value: seed },
      uFocus: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / 1200, 1 / 750) },
      ...own,
    };
  }

  /** A sheet: a mesh of the leaf's shape, drawn with `uniforms`. */
  sheet(uniforms) {
    const material = new THREE.ShaderMaterial({ vertexShader: PAGE_VERTEX, fragmentShader: PAGE_FRAGMENT, side: THREE.DoubleSide, uniforms });
    const mesh = new THREE.Mesh(this.leaf, material);
    mesh.frustumCulled = false;
    this.frame.add(mesh);
    return { mesh, material };
  }

  makePages(count) {
    this.disposePages();
    this.pages = Array.from({ length: count }, (_, i) => {
      // One sheet of thin paper, the project printed on both its sides.
      const uniforms = this.sheetUniforms(i * 7.31 + 1.7);
      const sheets = [this.sheet(uniforms)];
      // Every page a little different: stiffer or softer, a warp of its own, twisting its own way.
      const random = seeded(0x5eed + i * 977);
      const k = 1 + PAPER.vary * (random() * 2 - 1);
      return {
        uniforms, sheets,
        k, omega: PAPER.omega * (1 + .5 * (k - 1)) * (.93 + .14 * random()),
        warp: PAPER.twist.warp * (random() * 2 - 1),
        way: random() < .5 ? -1 : 1,
        bend: 0, bendV: 0, twist: 0, twistV: 0, flutter: 0, flutterV: 0,
        last: null, speed: 0, accel: 0,
      };
    });
    this.angles = new Float64Array(count + 2);
    this.pack = new Float64Array(count);
    this.clipped = new Uint8Array(count + 2);
  }

  disposePages() {
    this.pages.forEach(({ sheets }) => sheets.forEach(({ mesh, material }) => { this.frame.remove(mesh); material.dispose(); }));
  }

  /** Fetch every project's picture (after the first screen has settled, so they never compete with it). */
  load(onLoad) {
    const loader = new THREE.TextureLoader();
    this.projects.forEach((project, i) => {
      if (this.textures[i]) return;
      const src = project.picture ?? `/work/top/${project.id}.webp`;
      this.textures[i] = loader.load(src, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // On a phone, a smaller picture: a page is never drawn more than a few hundred px wide there, and the twelve
        // full-size pictures are a good part of what a mobile browser has room for (lib/device).
        if (LITE && texture.image.width > LITE_PICTURE) texture.image = shrink(texture.image, LITE_PICTURE);
        // As sharp as the screen allows at the page's angle (three keeps it within what the GPU has).
        texture.anisotropy = LITE ? 4 : 16;
        texture.needsUpdate = true;
        if (this.pages[i]) this.pages[i].uniforms.uTexel.value.set(1 / texture.image.width, 1 / texture.image.height);
        this.loaded[i] = true;
        onLoad?.();
      });
    });
  }

  /** The palette changed: the book is a real object and keeps its own colours. */
  paint(palette) { this.palette = palette; }

  /** How big a page is, in px: `width` along the spine; its length out from the spine is width / PAGE_ASPECT. */
  setSize(width) { this.width = width; }

  /** A page's length, px. */
  get length() { return this.width / PAGE_ASPECT; }

  /**
   * Lay the book out at `position` (see the class), clipped to `lens`
   * (drawing-buffer px: x, y, radius; radius 0 for none); `open` (0 shut → 1
   * open) is the scroll's way in, the same way back out; `lit` (0 → 1), under
   * the pointer. `dt` moves the paper on (0 puts every page straight at rest,
   * for reduced motion). Call after the stage has turned `group`. Returns
   * whether the paper is still moving and wants another frame.
   */
  update(position, lens, open = 1, exit = 0, lit = 0, dt = 1 / 60) {
    const count = this.pages.length;
    if (!count) return false;
    const now = performance.now();
    // Not drawn for a while (the reader was elsewhere): the paper starts again at rest, never with a jolt.
    if (now - this.lastUpdate > 200) this.pages.forEach(page => { page.last = null; });
    this.lastUpdate = now;
    const L = this.length, H = this.width;
    const t = BOOK.paper * L;
    // The entry: shut, the book's pages and back cover lag behind it as it turns, fanning out and settling shut
    // again (a spring on how fast the stage is turning it), the front cover holding still.
    const ajar = this.ajar ??= { value: AJAR.rest, velocity: 0, q: null };
    this.group.updateMatrix();
    if (ajar.q && dt > 0) {
      const turning = 2 * Math.acos(Math.min(1, Math.abs(ajar.q.dot(this.group.quaternion)))) / dt;
      const target = Math.min(AJAR.most, AJAR.rest + AJAR.gain * turning);
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let s = 0; s < steps; s++) {
        ajar.velocity += (AJAR.omega * AJAR.omega * (target - ajar.value) - 2 * AJAR.zeta * AJAR.omega * ajar.velocity) * h;
        ajar.value = Math.max(0, ajar.value + ajar.velocity * h);
      }
    } else if (dt <= 0) { ajar.value = AJAR.rest; ajar.velocity = 0; }
    (ajar.q ??= new THREE.Quaternion()).copy(this.group.quaternion);
    // The riffle runs while the book moves, and stops with it.
    const riffle = this.riffle ??= { phase: .25, amount: 0 };
    const stir = Math.max(0, Math.min(1, (ajar.value - AJAR.rest) / (AJAR.most - AJAR.rest)));
    riffle.amount = RIFFLE.amount * stir;
    riffle.phase = (riffle.phase + dt * RIFFLE.speed * stir) % 1;
    const layout = ringLayout(position, count, lit, open, this.angles, ajar.value, riffle);
    const amount = layout.amount;
    const opened = amount - layout.extra;
    // The book's turn about its spine: continuous while it opens or shuts; whole turns dropped once it is open.
    let spin = layout.spin;
    if (opened >= 1 || this.spinShown === null) spin = wrapPi(spin);
    else spin = this.spinShown + wrapPi(spin - this.spinShown);
    this.spinShown = spin;
    // Standing ajar, turned so the front cover stays where it is and the back swings away.
    const turn = opened * spin - Math.PI * layout.extra;
    // The boards flatten as the book opens, before their backs come together.
    this.bow.value = BOOK.cover.bow * (1 - smoother(opened / .6));
    this.frame.matrix.multiplyMatrices(this.basis, this._rz.makeRotationZ(turn));
    // Gravity, in the geometry's frame before its turn: down the screen, whatever way the stage has turned the book.
    this.group.updateMatrix();
    this._g.set(0, -1, 0).applyQuaternion(this._q.copy(this.group.quaternion).invert());
    const gx = this._g.y, gy = this._g.z;

    const { leaves, arc } = ringLeaves(this.angles, count, L, amount, this.leaves);
    packing(this.angles, count, this.pack);
    this.shared.uLens.value.copy(lens);

    // The paper, page by page: a sheet whose fore edge is a weight on a soft spring, pulled by gravity and the air.
    const { twist: TW, flutter: FL } = PAPER;
    for (let i = 1; i <= count; i++) {
      const page = this.pages[i - 1];
      const leaf = leaves[count + 1 - i];
      const world = leaf.angle + turn;
      const gravity = PAPER.sag * page.k * (-gx * Math.sin(world) + gy * Math.cos(world));
      if (page.last === null || dt <= 0) {
        Object.assign(page, { bend: gravity, bendV: 0, twist: page.warp, twistV: 0, flutter: 0, flutterV: 0, speed: 0, accel: 0 });
      } else {
        const speed = wrapPi(world - page.last) / dt;
        page.accel = clamp((speed - page.speed) / dt, -MAX_ACCELERATION, MAX_ACCELERATION);
        page.speed = speed;
        const w = page.omega, air = PAPER.drag * w * w;
        const steps = Math.max(1, Math.ceil(dt * 480)), h = dt / steps;
        for (let s = 0; s < steps; s++) {
          // The fore edge: sprung to where gravity would hold it, damped, held back by the air, left behind as the page speeds up.
          const bendA = w * w * (gravity - page.bend) - 2 * PAPER.zeta * w * page.bendV - air * (page.speed + page.bendV) - page.accel;
          page.bendV += bendA * h;
          page.bend += page.bendV * h;
          const tw = TW.omega;
          page.twistV += (tw * tw * (page.warp + TW.gain * page.way * page.speed - page.twist) - 2 * TW.zeta * tw * page.twistV) * h;
          page.twist += page.twistV * h;
          const fw = FL.omega;
          // The ripple, set going by the fore edge's own acceleration.
          page.flutterV += (-fw * fw * page.flutter - 2 * FL.zeta * fw * page.flutterV - FL.kick * (page.accel + bendA)) * h;
          page.flutter = clamp(page.flutter + page.flutterV * h, -FL.most, FL.most);
        }
      }
      page.last = world;
      leaf.bend = page.bend;
      leaf.twist = page.twist;
      leaf.flutter = page.flutter;
    }
    // Never through a neighbour: clip, and a page that touched loses most of its swing (paper against paper).
    this.clipped.fill(0);
    if (constrainBends(leaves, arc, L, this.clipped, amount)) {
      for (let n = 1; n <= count; n++) {
        if (!this.clipped[n]) continue;
        const page = this.pages[count - n];
        const leaf = leaves[n];
        page.bend = leaf.bend; page.twist = leaf.twist; page.flutter = leaf.flutter;
        page.bendV *= .2; page.twistV *= .2; page.flutterV *= .2;
      }
    }

    let moving = false;
    for (let i = 1; i <= count; i++) {
      const page = this.pages[i - 1];
      const leaf = leaves[count + 1 - i];
      if (Math.abs(page.bendV) + Math.abs(page.twistV) + Math.abs(page.flutterV) > .004 || Math.abs(page.speed) > .002) moving = true;
      const u = page.uniforms;
      u.uAngle.value = leaf.angle;
      u.uRootAngle.value = leaf.ra;
      u.uGutter.value = leaf.gutter;
      u.uRoot.value.set(leaf.rx, leaf.ry);
      u.uBend.value = leaf.bend;
      u.uTwist.value = leaf.twist;
      u.uFlutter.value = leaf.flutter;
      u.uLength.value = L;
      u.uHeight.value = H;
      u.uPaper.value = t;
      u.uPack.value = this.pack[i - 1];
      // How near its place on show the page is (1 on show → 0 a page or more away), to light its print fully there.
      const away = Math.abs(wrapPi((position - i) / ringSize(count) * TAU)) / TAU * ringSize(count);
      u.uFocus.value = 1 - smoother(away);
      const texture = this.loaded[i - 1] ? this.textures[i - 1] : null;
      u.uMap.value = texture;
      u.uHasMap.value = texture ? 1 : 0;
    }
    // The covers, hinged at the arc's ends, their wood on the far side from the pages.
    const { x, y, z } = this._cover;
    const Ct = BOOK.cover.thickness * L;
    this.covers.forEach((mesh, which) => {
      const angle = which === 0 ? -arc.phi / 2 : arc.phi / 2;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const awayX = which === 0 ? dy : -dy, awayY = which === 0 ? -dx : dx;
      const ox = which === 0 ? arc.p0x : arc.pNx, oy = which === 0 ? arc.p0y : arc.pNy;
      x.set(dx, dy, 0).multiplyScalar(L);
      y.set(awayX, awayY, 0).multiplyScalar(L);
      z.crossVectors(x, y).normalize().multiplyScalar(L);
      const off = BOOK.air * L * .5;
      mesh.matrix.makeBasis(x, y, z).setPosition(ox + awayX * off, oy + awayY * off, 0);
    });
    const hinge = this.hinge.material.uniforms;
    hinge.uArc.value = arc.alpha;
    // From the outside of one board to the outside of the other, its back rounded out while the book is shut (and
    // flattening as it opens, where the spine bends round the other way).
    const a0 = -arc.phi / 2, aN = arc.phi / 2;
    hinge.uChordA.value.set(arc.p0x + Math.sin(a0) * Ct, arc.p0y - Math.cos(a0) * Ct);
    hinge.uChordB.value.set(arc.pNx - Math.sin(aN) * Ct, arc.pNy + Math.cos(aN) * Ct);
    hinge.uRound.value = BOOK.round * (count * t + 2 * Ct) * (1 - smoother(opened / .5));
    hinge.uHeight.value = (PAGE_ASPECT + 2 * BOOK.cover.margin - .02) * L;
    hinge.uInset.value = .004 * L;
    hinge.uThick.value = .012 * L;
    // The stickers, while the covers are the outside of the book: on show until the covers' backs really meet (open),
    // and laid flatter and flatter onto their boards as the covers close in on each other (STICKERS_FLAT), so they
    // never show through the other cover, nor vanish while their cover can still be seen.
    if (this.stickers?.update(dt, opened < STICKERS_FLAT[1], clamp((opened - STICKERS_FLAT[0]) / (STICKERS_FLAT[1] - STICKERS_FLAT[0])))) moving = true;
    return moving || Math.abs(ajar.value - AJAR.rest) > 1e-4 || Math.abs(ajar.velocity) > 1e-3;
  }

  /**
   * A point on the front cover's outside, in the world: `u` across the board (0 the
   * spine → 1 the fore edge), `v` down it (0 the head), and a point `r` (of the
   * board's width) along from it, for its size. Call after `update`.
   */
  coverPoint(u, v, r, centre, edge) {
    const { overhang, lip, margin, thickness } = BOOK.cover;
    const across = 1 + overhang + lip, half = PAGE_ASPECT / 2 + margin;
    const x = u * across - lip, z = v * 2 * half - half;
    this.group.updateMatrixWorld(true);
    const mesh = this.covers[1];
    centre.set(x, thickness + .002 + this.bow.value * Math.max(0, x) ** 2, z).applyMatrix4(mesh.matrixWorld);
    const ex = x + r * across;
    edge.set(ex, thickness + .002 + this.bow.value * Math.max(0, ex) ** 2, z).applyMatrix4(mesh.matrixWorld);
  }

  dispose() {
    this.disposePages();
    this.textures.forEach(texture => texture?.dispose());
    this.covers[0].geometry.dispose();
    this.stickers?.dispose();
    this.covers.forEach(mesh => mesh.material.dispose());
    this.hinge.geometry.dispose();
    this.hinge.material.dispose();
    this.leaf.dispose();
  }
}

