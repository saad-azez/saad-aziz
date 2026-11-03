/**
 * The years behind the about's road, set as a poster sets them: heavy
 * figures, filled with the ground and outlined in ink, each standing a little
 * over the one before it; the hollows and notches of each (under a terminal,
 * inside a 6) blocked in solid, cut at a slant, as a shadow thrown down and to
 * the right would fill them; and a nought (or an o) not a ring but a solid
 * disc inside its outline. On one line.
 *
 * Painted once onto a canvas for each year (and again when the fonts are in,
 * or the scheme changes), so that carrying them across the screen costs
 * nothing.
 *
 *   weight, family   the figures' face
 *   outline   how thick their outline is, of their size
 *   lap       how far each stands over the one before, of their size
 *   block     how far the hollows are blocked in (the shadow's length), of their size
 *   disc      a nought's disc, of its outline's radius
 */
export const YEAR = { weight: 800, family: 'Manrope, system-ui, sans-serif', outline: .03, lap: .085, block: .3, disc: .64 };

/**
 * Paint `text` onto `canvas`, its figures `size` px, in `ink` on `ground` (CSS colours). Sets the canvas's size (its
 * own px, and its CSS px), and returns its CSS width and height.
 */
export function paintYear(canvas, text, size, { ink, ground }) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const context = canvas.getContext('2d');
  const font = `${YEAR.weight} ${size}px ${YEAR.family}`;
  context.font = font;
  const stroke = size * YEAR.outline, lap = size * YEAR.lap, block = size * YEAR.block, pad = Math.ceil(stroke * 1.5) + 2;
  // Each figure: how wide it is and how far it stands up and hangs down; a nought a circle as tall as the figures are.
  const tall = context.measureText('0').actualBoundingBoxAscent;
  const figures = [...text].map(char => {
    const box = context.measureText(char), round = /[0oO]/.test(char);
    const up = box.actualBoundingBoxAscent, down = Math.max(0, box.actualBoundingBoxDescent);
    if (round) { const height = char === 'o' ? up + down : tall; return { char, round, w: height, up: height, down: 0 }; }
    return { char, round, w: box.width, up, down };
  });
  const up = Math.max(...figures.map(figure => figure.up)), down = Math.max(...figures.map(figure => figure.down));
  const width = figures.reduce((sum, figure) => sum + figure.w, 0) - lap * (figures.length - 1) + pad * 2 + block * .2;
  const height = up + down + pad * 2;
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  canvas.style.width = `${Math.ceil(width)}px`;
  canvas.style.height = `${Math.ceil(height)}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = font;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.lineWidth = stroke * 2;
  const base = pad + up;
  let x = pad;
  // One after another, so each stands over the one before.
  for (const figure of figures) {
    if (figure.round) {
      const radius = figure.w / 2, cx = x + radius, cy = base - radius;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fillStyle = ground;
      context.strokeStyle = ink;
      context.lineWidth = stroke * 2;
      context.stroke();
      context.fill();
      context.beginPath();
      context.arc(cx, cy, radius * YEAR.disc, 0, Math.PI * 2);
      context.fillStyle = ink;
      context.fill();
    } else {
      // Its hollows blocked in: its own shape thrown down and to the right, kept inside the room it stands in.
      context.save();
      context.beginPath();
      context.rect(x - stroke, base - figure.up - stroke, figure.w + stroke * 2, figure.up + figure.down + stroke * 2);
      context.clip();
      context.fillStyle = ink;
      for (let s = 1; s <= block; s += 1) context.fillText(figure.char, x + s, base + s);
      context.restore();
      context.strokeStyle = ink;
      context.lineWidth = stroke * 2;
      context.strokeText(figure.char, x, base);
      context.fillStyle = ground;
      context.fillText(figure.char, x, base);
    }
    x += figure.w - lap;
  }
  return { width: Math.ceil(width), height: Math.ceil(height) };
}
