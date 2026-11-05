/**
 * A Gaussian blur of a canvas's pixels, in plain JavaScript.
 *
 * Instead of the 2D context's `filter = 'blur(…)'`, which Chrome turned into
 * seconds of stalling while the page loads (a cover's pressing blurred every one
 * of its hundreds of draws), and which Safari before 18 ignores altogether. Three
 * passes of a box blur, each a running sum, so the cost does not grow with the
 * radius: a few milliseconds for a 512² canvas.
 */

/** The radii of three box blurs that together approximate a Gaussian of `sigma`. */
function boxRadii(sigma) {
  const n = 3;
  const ideal = Math.sqrt(12 * sigma * sigma / n + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  const m = Math.round((12 * sigma * sigma - n * lower * lower - 4 * n * lower - 3 * n) / (-4 * lower - 4));
  return Array.from({ length: n }, (unused, i) => ((i < m ? lower : lower + 2) - 1) / 2);
}

/** One box blur of radius `r` along rows (`along`) or columns, from `src` into `dst` (edges held). */
function boxPass(src, dst, w, h, r, along) {
  const lines = along ? h : w, length = along ? w : h, step = along ? 1 : w, next = along ? w : 1;
  const scale = 1 / (2 * r + 1), last = length - 1;
  for (let line = 0; line < lines; line++) {
    const start = line * next, end = start + last * step;
    const first = src[start], final = src[end];
    // The window starts centred on the first value, the edge repeated where it runs off.
    let sum = first * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[start + Math.min(i, last) * step];
    for (let i = 0, at = start; i < length; i++, at += step) {
      dst[at] = sum * scale;
      const enter = i + r + 1, leave = i - r;
      sum += (enter <= last ? src[start + enter * step] : final) - (leave >= 0 ? src[start + leave * step] : first);
    }
  }
}

/** Blur one plane of `w`×`h` values in place. */
export function blurPlane(plane, w, h, sigma) {
  if (!(sigma > .2)) return plane;
  const spare = new Float32Array(plane.length);
  for (const r of boxRadii(sigma)) {
    if (r < 1) continue;
    boxPass(plane, spare, w, h, r, true);
    boxPass(spare, plane, w, h, r, false);
  }
  return plane;
}

/** One channel (0 R, 1 G, 2 B, 3 A) of `imageData` as a plane of floats. */
export function channel(imageData, index) {
  const { data } = imageData, plane = new Float32Array(data.length / 4);
  for (let i = 0; i < plane.length; i++) plane[i] = data[i * 4 + index];
  return plane;
}
