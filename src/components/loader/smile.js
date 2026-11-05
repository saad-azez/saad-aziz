/**
 * The loader's smile, as geometry: polylines a canvas can draw part of, which
 * is what lets the drawing follow the count.
 */

// Outline, tooth seam, four tooth divisions, then the cheek scar and stitches.
// Each stroke's window of the count, and its weight.
export const STROKES = [
  [0, .43, 1.7], [.08, .59, 1.7], [.34, .69, 1.25], [.34, .69, 1.25],
  [.49, .70, 1.25], [.49, .70, 1.25], [.55, .76, 1.25], [.55, .76, 1.25],
  [.61, .82, 1.25], [.61, .82, 1.25], [.67, .88, 1.25], [.67, .88, 1.25],
  [.68, .92, 1.3], [.80, .96, 1.3], [.87, 1, 1.3],
];

/** The smile's middle, and the box (in its own units) everything it does stays inside. */
export const CENTRE = { x: 97, y: 54 };
export const BOUNDS = { x: -60, y: -80, width: 314, height: 196 };

// A straight, closed grin. The two tooth seams share the same contour,
// so the teeth stay together throughout loading and the star.
const CLOSED = {
  top: [12,34, 8,14,12,7,24,9, 68,16,126,16,170,9, 182,7,186,14,182,34],
  bottom: [182,34, 179,70,146,96,97,96, 48,96,15,70,12,34],
  upper: [12,34, 37,42,67,44,97,44, 127,44,157,42,182,34],
  lower: [182,34, 157,42,127,44,97,44, 67,44,37,42,12,34],
};

const STEPS = 14;

function cubic(out, x0, y0, x1, y1, x2, y2, x3, y3) {
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS, v = 1 - t;
    out.push(
      v ** 3 * x0 + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t ** 3 * x3,
      v ** 3 * y0 + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t ** 3 * y3,
    );
  }
}

function curve(points) {
  const out = [points[0], points[1]];
  for (let i = 0; i + 7 < points.length; i += 6) cubic(out, ...points.slice(i, i + 8));
  return out;
}

function quad(x0, y0, cx, cy, x1, y1) {
  const out = [x0, y0];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6, v = 1 - t;
    out.push(v * v * x0 + 2 * v * t * cx + t * t * x1, v * v * y0 + 2 * v * t * cy + t * t * y1);
  }
  return out;
}

// A point on a tooth edge and its outward normal, so creases follow the drawn jaw.
function edgePoint(points, progress) {
  const segments = (points.length - 2) / 6;
  const segment = Math.min(segments - 1, Math.floor(progress * segments));
  const t = progress * segments - segment, v = 1 - t;
  const i = segment * 6;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = points.slice(i, i + 8);
  const x = v ** 3 * x0 + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t ** 3 * x3;
  const y = v ** 3 * y0 + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t ** 3 * y3;
  const dx = 3 * v * v * (x1 - x0) + 6 * v * t * (x2 - x1) + 3 * t * t * (x3 - x2);
  const dy = 3 * v * v * (y1 - y0) + 6 * v * t * (y2 - y1) + 3 * t * t * (y3 - y2);
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, nx: dy / length, ny: -dx / length };
}

function curveFrom(x0, y0, x1, y1, x2, y2, x3, y3) {
  const out = [x0, y0];
  cubic(out, x0, y0, x1, y1, x2, y2, x3, y3);
  return out;
}

/** The smile at a point in the count (0-1), its mouth pulled by `pull`: its polylines, and where the star sits. */
export function smileLines(progress, pull) {
  const grow = progress * progress * (3 - 2 * progress);
  const stretch = (.78 + .22 * grow) * (1 + .25 * pull);
  const pose = {};
  for (const key of ['top', 'bottom', 'upper', 'lower']) {
    pose[key] = CLOSED[key].map((value, i) => (i % 2 ? value : 97 + (value - 97) * stretch));
  }
  const { top, bottom, upper, lower } = pose;
  const lines = [curve(top), curve(bottom), curve(upper), curve(lower)];
  // Keep all eight creases attached to their own tooth band as the grin widens.
  for (const u of [.10, .21, .81, .92]) {
    const a = edgePoint(upper, u);
    const b = edgePoint(lower, 1 - u);
    const outside = edgePoint(bottom, 1 - u);
    const dx = outside.x - b.x, dy = outside.y - b.y;
    const depth = Math.min(.75, 14 / (Math.hypot(dx, dy) || 1));
    const bend = u < .5 ? 1.2 : -1.2;
    lines.push(quad(a.x + a.nx * 15, a.y + a.ny * 15, a.x + a.nx * 7 + bend, a.y + a.ny * 7, a.x, a.y));
    lines.push(quad(b.x, b.y, b.x + dx * depth * .5 + bend * .5, b.y + dy * depth * .5, b.x + dx * depth, b.y + dy * depth));
  }
  // The scar stays above the cheek, clear of the moving lip.
  const sx = 121 + 3 * pull, sy = -39 - 2 * pull;
  lines.push(
    curveFrom(sx, sy, sx + 18, sy + 7, sx + 47, sy - 1, sx + 64, sy - 16),
    quad(sx + 23, sy - 6, sx + 25, sy + 2, sx + 25, sy + 10),
    quad(sx + 47, sy - 17, sx + 50, sy - 10, sx + 54, sy - 5),
  );
  return { lines, tooth: edgePoint(upper, .80) };
}

/** Trace the first `drawn` (0-1) of a polyline, by its length. */
export function tracePart(context, line, drawn) {
  let length = 0;
  for (let i = 2; i < line.length; i += 2) length += Math.hypot(line[i] - line[i - 2], line[i + 1] - line[i - 1]);
  let left = length * drawn;
  context.moveTo(line[0], line[1]);
  for (let i = 2; i < line.length; i += 2) {
    const step = Math.hypot(line[i] - line[i - 2], line[i + 1] - line[i - 1]);
    if (step >= left) {
      const f = step ? left / step : 0;
      context.lineTo(line[i - 2] + (line[i] - line[i - 2]) * f, line[i - 1] + (line[i + 1] - line[i - 1]) * f);
      return;
    }
    context.lineTo(line[i], line[i + 1]);
    left -= step;
  }
}
