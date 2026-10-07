// The book's leaves never meet. Proved with plain geometry, apart from the
// way the book itself keeps them apart:
//   - round the ring, the leaves keep their order at every position, hover
//     and opening (cover A, the last page … the first, cover B), the book's
//     turn is continuous, and nothing stands in front of the page on show;
//   - straight, no page comes nearer a neighbour or a cover than their
//     thicknesses, at every position (all the way round, past the covers),
//     hover and opening, at a laptop's, a large screen's and a phone's size;
//   - bent as far as the paper is ever asked to (random extremes, well past
//     anything gravity and the turn produce), once the book has clipped the
//     bends, still none does.
// The test measures each leaf's true shape (Book.leafPoint, the vertex
// shader's sum) finely along its length and at five heights along the spine,
// as segments, and takes the least distance between neighbours.
//   npm run check:book
import assert from 'node:assert/strict';
import {
  ringLayout, ringLeaves, ringCentre, constrainBends, leafPoint, leafHalf,
  ringSize, itemAt, FAN, BOOK, PAGE_ASPECT,
} from '../src/webgl/stage/Book.js';

const COUNT = 12;
const M = ringSize(COUNT);
const WIDTHS = { laptop: 450, large: 560, phone: 230 };
const TAU = Math.PI * 2;
let checks = 0;

/* ----- the ring ------------------------------------------------------- */
let spinWas = null;
for (let p = 0; p <= 3 * M + 1e-9; p += .005) {
  for (const lit of [0, .5, 1]) {
    for (let open = 0; open <= 1.0001; open += .05) {
      const { angles, spin, amount } = ringLayout(p, COUNT, lit, open);
      // In the frame: cover A, page COUNT … page 1, cover B, each strictly after the one before.
      const order = [0, ...Array.from({ length: COUNT }, (_, k) => COUNT - k), COUNT + 1];
      for (let r = 1; r < order.length; r++) {
        checks++;
        const a = angles[order[r - 1]], b = angles[order[r]];
        assert.ok(amount === 0 ? b >= a : b > a, `order lost at position ${p.toFixed(3)} lit ${lit} open ${open.toFixed(2)}: leaf ${order[r - 1]} (${a}) is not before leaf ${order[r]} (${b})`);
      }
      if (open >= 1 && lit === 0) {
        // Open, at rest on a page: the leaf in front of it is at least the gap away.
        const near = Math.round(p);
        if (Math.abs(p - near) < 1e-9) {
          const item = itemAt(near, COUNT);
          const world = i => angles[i] + spin;
          const shown = item.cover ? null : item.project + 1;
          if (shown) {
            const show = world(shown);
            checks++;
            assert.ok(Math.abs(Math.atan2(Math.sin(show - FAN.show), Math.cos(show - FAN.show))) < 1e-9, `position ${p}: page ${shown} is not in its place`);
            const front = shown === 1 ? null : shown - 1;
            const next = front ? world(front) : Math.PI + spin;
            checks++;
            assert.ok(((next - show) % TAU + TAU) % TAU >= FAN.gap - 1e-9, `position ${p}: something stands in front of page ${shown}`);
          }
        }
      }
    }
  }
  const { spin } = ringLayout(p, COUNT, 0, 1);
  if (spinWas !== null) {
    checks++;
    assert.ok(Math.abs(spin - spinWas) < .05, `the book jumps its turn at position ${p.toFixed(3)} (${spinWas} → ${spin})`);
    assert.ok(spin >= spinWas - 1e-12, `the book turns back at position ${p.toFixed(3)}`);
  }
  spinWas = spin;
}

/* ----- the leaves' true shapes ------------------------------------------ */
const U = Array.from({ length: 29 }, (_, k) => .06 + .94 * k / 28);
const V = [0, .25, .5, .75, 1];

/** A leaf's middle as a polyline at height v, only where it is clear of the spine (outside the ring centre's bound radius). */
function polyline(leaf, L, v, centre) {
  const pts = [];
  const p = [0, 0];
  for (const u of U) {
    if (leaf.cover) {
      const reach = u * L * (1 + BOOK.cover.overhang);
      p[0] = leaf.rx + leaf.dx * reach; p[1] = leaf.ry + leaf.dy * reach;
    } else leafPoint(leaf, u, v, L, p);
    if (Math.hypot(p[0] - centre.x, p[1] - centre.y) >= centre.rMin) pts.push([p[0], p[1]]);
  }
  return pts;
}

function segmentDistance(a, b, c, d) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  const toSegment = (p, s, e) => {
    const ex = e[0] - s[0], ey = e[1] - s[1];
    const len = ex * ex + ey * ey;
    const t = len > 0 ? Math.max(0, Math.min(1, ((p[0] - s[0]) * ex + (p[1] - s[1]) * ey) / len)) : 0;
    return Math.hypot(p[0] - s[0] - ex * t, p[1] - s[1] - ey * t);
  };
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}

/** The least gap between two leaves' middles, less what their thicknesses need; below 0 they meet. */
function gapBetween(one, two, L, centre) {
  let least = Infinity;
  const need = leafHalf(one.cover, L) + leafHalf(two.cover, L);
  for (const v of V) {
    const a = polyline(one, L, v, centre), b = polyline(two, L, v, centre);
    for (let i = 0; i + 1 < a.length; i++) for (let j = 0; j + 1 < b.length; j++) {
      const d = segmentDistance(a[i], a[i + 1], b[j], b[j + 1]) - need;
      if (d < least) least = d;
    }
  }
  return least;
}

function test(name, width, p, open, lit, bends, stage) {
  const L = width / PAGE_ASPECT;
  const { angles, amount } = ringLayout(p, COUNT, lit, open);
  const { leaves, arc } = ringLeaves(angles, COUNT, L, amount);
  if (bends) {
    leaves.forEach(leaf => {
      if (leaf.cover) return;
      const [b, t, f] = bends();
      leaf.bend = b; leaf.twist = t; leaf.flutter = f;
    });
    constrainBends(leaves, arc, L, null, amount);
  }
  const centre = ringCentre(arc, L);
  for (let k = 0; k + 1 < leaves.length; k++) {
    checks++;
    const gap = gapBetween(leaves[k], leaves[k + 1], L, centre);
    const label = n => (leaves[n].cover ? (n === 0 ? 'cover A' : 'cover B') : `page ${leaves[n].page}`);
    assert.ok(gap >= -1e-6 * L, `${name}: ${label(k)} and ${label(k + 1)} meet ${stage} (by ${(-gap).toFixed(3)} px)`);
  }
}

// Straight: all the way round the ring and past the covers, at rest and under the pointer; and opening.
for (const [name, width] of Object.entries(WIDTHS)) {
  for (let p = 0; p <= M + 1e-9; p += .05) for (const lit of [0, 1]) test(name, width, p, 1, lit, null, `at position ${p.toFixed(2)} (lit ${lit})`);
  for (const p of [1, 4.5, 12, 13, 13.5]) for (let open = .02; open <= 1.0001; open += .02) test(name, width, p, open, 0, null, `opening (${open.toFixed(2)}) at position ${p}`);
}

// Shut but ajar (the pages fanning, and rippling, as the book is turned in the hand): the leaves keep their order and stay clear.
for (let ajar = 0; ajar <= .1201; ajar += .01) for (const p of [1, 6.5, 13]) for (const riffle of [null, ...[0, .2, .45, .7, .9].map(phase => ({ phase, amount: .8 }))]) {
  const { angles, amount } = ringLayout(p, COUNT, 0, 0, undefined, ajar, riffle);
  for (let n = 1; n < COUNT + 2; n++) {
    const order = [0, ...Array.from({ length: COUNT }, (_, k) => COUNT - k), COUNT + 1];
    checks++;
    assert.ok(angles[order[n]] >= angles[order[n - 1]], `ajar ${ajar}: order lost`);
  }
  for (const [name, width] of Object.entries(WIDTHS)) {
    const L = width / PAGE_ASPECT;
    const { leaves, arc } = ringLeaves(angles, COUNT, L, amount);
    const centre = ringCentre(arc, L);
    for (let k = 0; k + 1 < leaves.length; k++) {
      checks++;
      assert.ok(gapBetween(leaves[k], leaves[k + 1], L, centre) >= -1e-6 * L, `${name}: leaves meet ajar ${ajar.toFixed(2)} at ${p}`);
    }
  }
}

// Bent: random extremes, clipped by the book, at a spread of positions and openings.
let seed = 7;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const extreme = () => [(random() * 2 - 1) * .5, (random() * 2 - 1) * .2, (random() * 2 - 1) * .06];
for (const [name, width] of Object.entries(WIDTHS)) {
  for (let p = 0; p <= M + 1e-9; p += .25) for (const open of [1, .7, .35, .1]) for (let trial = 0; trial < 6; trial++) {
    test(name, width, p, open, trial % 2, extreme, `bent (trial ${trial}) at position ${p.toFixed(2)}, open ${open}`);
  }
  // The same bend on every page (they all sag together, as gravity makes them): kept too.
  for (let p = 0; p <= M + 1e-9; p += .5) for (const b of [-.3, -.15, .15, .3]) {
    test(name, width, p, 1, 0, () => [b, 0, 0], `all bent ${b} at position ${p.toFixed(2)}`);
  }
}

console.log(`check:book passed (${checks} checks)`);
