/**
 * The process's puzzle (components/process lays it out; PuzzleBoard builds and places it): the coin itself, cut. A
 * board three cells by three, cut along every edge between two cells with a jigsaw's tab, out of one cell and into the
 * next, and the coin's disc laid over it: each piece is its cell's shape as far as the disc goes, so the eight round
 * the middle one have the coin's own rim for their outer edge. Put together, they are the coin.
 *
 * The board is worked out in cells (a cell 1 across, y down the screen); the pieces are handed over in the disc's
 * radii (the coin 1 each way from its middle), y up, as the stage has it.
 */

/** The disc's radius, in cells: the board's own half-width, so the disc just fills it. */
const SPAN = 1.5;
/**
 * The eight round the middle, in the order they are drawn back in (processTransition DOCK): two to a step, each pair a
 * step's parts. The sides first, then the corners, each corner once both sides it fits against are in. [column, row].
 */
export const DOCK = [[1, 0], [2, 1], [1, 2], [0, 1], [2, 0], [2, 2], [0, 2], [0, 0]];

const FLAT = [[0, 0], [1, 0]];

/** A seeded run of numbers, 0 → 1, the same every time for the same seed. */
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * An edge's line, from (0, 0) to (1, 0), its tab standing out toward +y: along the edge to the neck, up it and out
 * round the head (wider than the neck, so it holds), and down the neck again.
 */
function tabLine({ at, neck, rise, head }) {
  const points = [[0, 0], [at - neck, 0]];
  const cubic = (a, b, c, d, n = 10) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      points.push([0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]));
    }
  };
  cubic([at - neck, 0], [at - neck + .012, rise * .45], [at - head, rise - head * .75], [at - head, rise]);
  for (let i = 1; i <= 18; i++) {
    const a = Math.PI - Math.PI * i / 18;
    points.push([at + Math.cos(a) * head, rise + Math.sin(a) * head]);
  }
  cubic([at + head, rise], [at + head, rise - head * .75], [at + neck - .012, rise * .45], [at + neck, 0]);
  points.push([1, 0]);
  return points;
}

/**
 * A board `cols` by `rows`, cut. `across[r][c]` is the edge along the top of cell (c, r), `down[r][c]` the one down its
 * left (null on the board's own edges); each `{ sign, at, neck, rise, head }`, its tab standing out down (across) or
 * right (down) for a sign of 1, up or left for -1. Each tab a little different from the next, as a cut puzzle's are.
 */
export function cutBoard(cols, rows, seed = 7) {
  const next = seeded(seed);
  const cut = () => ({
    sign: next() < .5 ? 1 : -1,
    at: .5 + (next() - .5) * .12, neck: .068 + next() * .016, rise: .158 + next() * .026, head: .112 + next() * .016,
  });
  const across = [], down = [];
  for (let r = 0; r <= rows; r++) across.push(Array.from({ length: cols }, () => (r === 0 || r === rows ? null : cut())));
  for (let r = 0; r < rows; r++) down.push(Array.from({ length: cols + 1 }, (_, c) => (c === 0 || c === cols ? null : cut())));
  return { cols, rows, across, down };
}

/** An edge's line from (ax, ay) along (dx, dy), in cells, its tab out its own way; backward if `reverse`. */
function trace(cut, ax, ay, dx, dy, reverse) {
  const line = cut ? tabLine(cut) : FLAT, s = cut ? cut.sign : 0;
  // (An edge across stands out down the screen for a sign of 1, one down it to the right.)
  const nx = dy ? 1 : 0, ny = dx ? 1 : 0;
  const points = line.map(([x, y]) => [ax + dx * x + nx * y * s, ay + dy * x + ny * y * s]);
  return reverse ? points.reverse() : points;
}

/**
 * Cell (c, r)'s outline, round it clockwise on the screen from its top left corner, in cells from that corner: its
 * top left to right, its right down, its bottom right to left, its left up. Each edge is the very line its neighbour
 * has, so they fit.
 */
export function pieceOutline(board, c, r) {
  const { across, down } = board;
  const loop = [
    ...trace(across[r][c], 0, 0, 1, 0, false),
    ...trace(down[r][c + 1], 1, 0, 0, 1, false),
    ...trace(across[r + 1][c], 0, 1, 1, 0, true),
    ...trace(down[r][c], 0, 0, 0, 1, true),
  ];
  return loop.filter(([x, y], i) => {
    const [px, py] = loop[(i + loop.length - 1) % loop.length];
    return Math.abs(x - px) > 1e-6 || Math.abs(y - py) > 1e-6;
  });
}

/** `shape` cut down to the disc of radius `radius` round (cx, cy): what of it is inside (the disc is convex). */
function insideDisc(shape, cx, cy, radius, sides = 192) {
  let out = shape;
  for (let i = 0; i < sides && out.length; i++) {
    const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
    const ax = cx + Math.cos(a0) * radius, ay = cy + Math.sin(a0) * radius, bx = cx + Math.cos(a1) * radius, by = cy + Math.sin(a1) * radius;
    // (Which side of this stretch of the rim a point is on: the middle's side is in.)
    const side = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const inward = side([cx, cy]) > 0, input = out;
    out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length], sp = side(p), sq = side(q);
      if ((sp > 0) === inward) out.push(p);
      if ((sp > 0) !== (sq > 0)) {
        const k = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    });
  }
  return out;
}

/** `loop` again as `count` points evenly spaced along it (so the rim's arcs and the tabs are as fine as each other). */
function resample(loop, count) {
  const n = loop.length, lengths = [0];
  for (let i = 1; i <= n; i++) {
    const [ax, ay] = loop[i - 1], [bx, by] = loop[i % n];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[n], out = [];
  for (let k = 0, i = 0; k < count; k++) {
    const want = total * k / count;
    while (lengths[i + 1] < want) i++;
    const t = (want - lengths[i]) / ((lengths[i + 1] - lengths[i]) || 1), [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % n];
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

/**
 * `loop` (round the coin's middle, in its radii) ready to be built: each point on the rim's many-sided stand-in set on
 * the circle itself, and every point in a straight line between its neighbours let go. (The bevel's inset is worked
 * out from each corner's two edges, and goes astray where they run straight on: the face then folds over itself.)
 */
function tidy(loop, home) {
  const onRim = loop.map(([x, y]) => {
    const ax = x + home[0], ay = y + home[1], d = Math.hypot(ax, ay);
    return d > .996 ? [ax / d - home[0], ay / d - home[1]] : [x, y];
  });
  return onRim.filter((p, i) => {
    const a = onRim[(i + onRim.length - 1) % onRim.length], b = onRim[(i + 1) % onRim.length];
    const ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
    return Math.abs(ux * vy - uy * vx) > 1e-4 * Math.hypot(ux, uy) * Math.hypot(vx, vy);
  });
}

/**
 * The coin's nine pieces, in its radii, y up: `centre` and the eight round it, `ring`, in DOCK order. Each
 * `{ c, r, home, outline, middle }`: its cell, where its cell's middle is on the coin (the piece is built round it),
 * its outline round that, and the middle of what there is of it (a piece cut by the rim is off its cell's middle).
 */
export function discPieces(seed = 23) {
  const board = cutBoard(3, 3, seed), cell = 1 / SPAN;
  const piece = (c, r) => {
    const home = [(c - 1) * cell, (1 - r) * cell];
    const cut = insideDisc(pieceOutline(board, c, r).map(([x, y]) => [(x - .5) * cell, (.5 - y) * cell]), -home[0], -home[1], 1);
    const outline = tidy(resample(cut, c === 1 && r === 1 ? 220 : 260), home);
    const middle = [0, 1].map(k => outline.reduce((sum, p) => sum + p[k], 0) / outline.length);
    return { c, r, home, outline, middle };
  };
  return { centre: piece(1, 1), ring: DOCK.map(([c, r]) => piece(c, r)), cell };
}
