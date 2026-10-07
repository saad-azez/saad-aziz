import threeOnDark from '../assets/logos/brand/threejs-on-dark.svg';
import threeOnLight from '../assets/logos/brand/threejs-on-light.svg';
import blender from '../assets/logos/brand/blender.svg';
import reactOnDark from '../assets/logos/brand/react-on-dark.svg';
import reactOnLight from '../assets/logos/brand/react-on-light.svg';
import figma from '../assets/logos/brand/figma.svg';
import framerOnDark from '../assets/logos/brand/framer-on-dark.svg';
import framerOnLight from '../assets/logos/brand/framer-on-light.svg';
import webflow from '../assets/logos/brand/webflow.svg';
import vite from '../assets/logos/brand/vite.svg';
import nextjs from '../assets/logos/brand/nextjs.svg';
import shopify from '../assets/logos/brand/shopify.svg';
import lottie from '../assets/logos/brand/lottiefiles.svg';
import javascript from '../assets/logos/brand/javascript.svg';
import gsapOnDark from '../assets/logos/brand/gsap-on-dark.svg';
import gsapOnLight from '../assets/logos/brand/gsap-on-light.svg';
import spline from '../assets/logos/brand/spline.png';
import customCode from '../assets/logos/brand/custom-code.svg';
import angular from '../assets/logos/brand/angular.svg';
import monogramLetters from '../assets/monogram-letters.svg';
import monogramRing from '../assets/monogram-ring.svg';
import portrait from '../assets/portrait.jpeg';

/**
 * The tools the coin turns through in the hero, in the order the hero's copy
 * names them. In the work it shows the front project's own tools instead
 * (DotStage.projectTools): any of the marks below.
 */
export const COIN_SKILLS = ['Blender', 'Spline', 'Three.js', 'Webflow', 'Framer', 'Custom code'];
/**
 * The face the coin turns to as it lands on the book's cover: the SA monogram
 * in gold, drawn the size it is printed on the sticker there (ring and letters
 * 1.56 of the coin's radius), so the coin and the sticker are the same thing.
 */
export const MONOGRAM = 'Monogram';
const MONOGRAM_GOLD = '#c9a15a';
/**
 * The coin's other side, turned up in the About: Saad himself, as the head on
 * a real coin is a portrait, set in type: ASCII, the heavier a character the
 * darker (or, on a dark coin, the lighter) that part of the picture. It is not
 * a picture painted once but drawn by the coin's own shader every frame
 * (DotStage FACE_FRAGMENT), from the portrait's light (portraitField) and the
 * characters (asciiAtlas), so it can answer the pointer.
 */
export const PORTRAIT = 'Portrait';
/**
 * And the face again, as a 3D artist would make it: a low-poly mesh, facets of
 * flat light and the wire of their edges, drawn by the shader too. The coin's
 * two sides on the About's card are these two: the engineer (the face in code)
 * and the artist (the face in polygons).
 */
export const MESH = 'Mesh';
/**
 * The characters: `ramp` from lightest to heaviest, for the picture;
 * `scramble`, what the picture's characters churn through under the pointer;
 * each drawn `size` px square in the atlas.
 */
export const ASCII = { ramp: ' .:-=+*xoX#%@', scramble: '01<>/\\|{}[]$&?!;~^', size: 64 };

/**
 * The coins' faces: each tool's official mark, in its own colours.
 *
 * One drawing serves both coins — the hero's dot on the i and the stage's coin
 * that leaves it — so the handover between them cannot be seen. Brands with a
 * version for each ground (black-and-white marks) give `dark` (for a dark coin)
 * and `light`; the rest keep one file on either. Sources: svgl.app, GSAP's
 * brand assets (gsap.com/brand), and Spline's own site. See logos/README.md.
 */
const MARKS = {
  'Three.js': { dark: threeOnDark, light: threeOnLight },
  Blender: { any: blender },
  React: { dark: reactOnDark, light: reactOnLight },
  Figma: { any: figma },
  Framer: { dark: framerOnDark, light: framerOnLight },
  Webflow: { any: webflow },
  Vite: { any: vite },
  'Next.js': { any: nextjs },
  Shopify: { any: shopify },
  Lottie: { any: lottie },
  JavaScript: { any: javascript },
  GSAP: { dark: gsapOnDark, light: gsapOnLight },
  Spline: { any: spline },
  'Custom code': { any: customCode },
  Angular: { any: angular },
};

/** Whether the coin has a face for this tool. */
export const hasMark = tool => Object.hasOwn(MARKS, tool);

export const SIZE = 1024;
/** How much of the face the mark's widest side takes. */
const FILL = .62;

/** Fit the mark's visible ink (not its padding) into the middle of the face, keeping its proportions. */
function paintMark(context, image) {
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = SIZE;
  const source = scratch.getContext('2d');
  const w = image.naturalWidth || image.width || SIZE, h = image.naturalHeight || image.height || SIZE;
  const fit = Math.min(SIZE / w, SIZE / h);
  source.drawImage(image, (SIZE - w * fit) / 2, (SIZE - h * fit) / 2, w * fit, h * fit);
  const pixels = source.getImageData(0, 0, SIZE, SIZE).data;
  let left = SIZE, right = -1, top = SIZE, bottom = -1;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (pixels[(y * SIZE + x) * 4 + 3] < 16) continue;
    if (x < left) left = x; if (x > right) right = x;
    if (y < top) top = y; if (y > bottom) bottom = y;
  }
  if (right < left) return false;
  const width = right - left + 1, height = bottom - top + 1;
  const scale = SIZE * FILL / Math.max(width, height);
  context.clearRect(0, 0, SIZE, SIZE);
  context.drawImage(scratch, left, top, width, height,
    (SIZE - width * scale) / 2, (SIZE - height * scale) / 2, width * scale, height * scale);
  return true;
}

/** A tool with no mark is set in type, in the coin's contrasting ink. */
function paintName(context, tool, onDark) {
  context.clearRect(0, 0, SIZE, SIZE);
  const family = getComputedStyle(document.body).fontFamily;
  let size = 230;
  context.font = `600 ${size}px ${family}`;
  while (context.measureText(tool).width > SIZE * FILL && size > 72) context.font = `600 ${size -= 4}px ${family}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = onDark ? '#f7f1ea' : '#25202a';
  context.fillText(tool, SIZE / 2, SIZE / 2);
}

/**
 * The face, cut out of the portrait (1024 × 1536) as a square: hair to collar,
 * the face filling most of it. As fractions: the square's side and its left of
 * the photo's width, its top of the photo's height.
 */
const CROP = { side: .42, x: .294, y: .232 };
/** In the crop (0 → 1 across and down): the head (its middle, and how far either way), and where the shoulders start. */
const HEAD = { x: .5, y: .38, rx: .26, ry: .33, shoulders: .66 };
/** The face, drawn into a square `S` px canvas, as the coin shows it: inside a circle a little short of its edge. */
const drawFace = (context, image, S) => {
  const side = image.naturalWidth * CROP.side, inner = S * .44;
  context.drawImage(image, image.naturalWidth * CROP.x, image.naturalHeight * CROP.y, side, side, S / 2 - inner, S / 2 - inner, inner * 2, inner * 2);
  return inner;
};
const once = (make) => {
  let entry = null;
  return ready => {
    if (!entry) {
      const canvas = document.createElement('canvas');
      entry = { canvas, done: false, waiting: new Set() };
      const image = new Image();
      image.src = portrait;
      image.decode().then(() => make(canvas, image), () => {}).then(() => {
        entry.done = true;
        entry.waiting.forEach(callback => callback());
        entry.waiting.clear();
      });
    }
    if (ready) (entry.done ? ready() : entry.waiting.add(ready));
    return entry.canvas;
  };
};

/**
 * The face as the coin's faces read it (the ASCII, and the mesh): a 256²
 * canvas whose red is the face's light and whose green is the sitter (his
 * head, his shoulders), so the wall behind him is no part of it. The light is
 * drawn out for a few dozen characters across: sharpened against a blur of
 * itself (an unsharp mask), so the eyes, the brows and the line of the jaw
 * carry, and stretched to the face's own darkest and lightest. `ready` is
 * called once it is drawn (straight away, if it already is).
 */
export const portraitField = once((canvas, image) => {
  const S = 256, c = S / 2;
  canvas.width = canvas.height = S;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const inner = drawFace(context, image, S);
  const pixels = context.getImageData(0, 0, S, S);
  const p = pixels.data;
  const step = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lum = new Float32Array(S * S), sitter = new Float32Array(S * S), face = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, k = i * 4;
    lum[i] = (.2126 * p[k] + .7152 * p[k + 1] + .0722 * p[k + 2]) / 255;
    // (Through the crop's own square, which fills the circle: `u`, `v` across and down it.)
    const u = (x - (c - inner)) / (inner * 2), v = (y - (c - inner)) / (inner * 2);
    const head = Math.hypot((u - HEAD.x) / HEAD.rx, (v - HEAD.y) / HEAD.ry);
    const shoulders = step(HEAD.shoulders, HEAD.shoulders + .05, v) * step(-.02, .02, .2 + (v - HEAD.shoulders) * 1.5 - Math.abs(u - .5));
    sitter[i] = Math.max(1 - step(.88, 1.05, head), shoulders) * (Math.hypot(x - c, y - c) < inner ? 1 : 0);
    face[i] = head < .75 ? 1 : 0;
  }
  const blur = new Float32Array(S * S), R = 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let sum = 0, n = 0;
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      sum += lum[Math.min(S - 1, Math.max(0, y + dy)) * S + Math.min(S - 1, Math.max(0, x + dx))]; n++;
    }
    blur[y * S + x] = sum / n;
  }
  const sharp = lum.map((v, i) => v + (v - blur[i]) * 1.8);
  // Stretched to the face's own range (not the suit's, which would leave the face one flat tone).
  const inside = [...sharp.filter((_, i) => face[i])].sort((a, b) => a - b);
  const lo = inside[Math.floor(inside.length * .03)] ?? 0, hi = inside[Math.floor(inside.length * .97)] ?? 1;
  for (let i = 0; i < S * S; i++) {
    const v = Math.min(1, Math.max(0, (sharp[i] - lo) / Math.max(.05, hi - lo)));
    p[i * 4] = v * 255; p[i * 4 + 1] = sitter[i] * 255; p[i * 4 + 2] = 0; p[i * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
});

/** The face itself, in colour, 512² (the circle's corners clear): what the lens over the coin shows of him. */
export const portraitPhoto = once((canvas, image) => {
  canvas.width = canvas.height = 512;
  drawFace(canvas.getContext('2d'), image, 512);
});

let atlas = null;
/**
 * The characters the ASCII face is set in (ASCII: the ramp, then the
 * scramble), white on clear, each in its own ASCII.size square, in a row.
 */
export function asciiAtlas() {
  if (atlas) return atlas;
  const glyphs = [...ASCII.ramp, ...ASCII.scramble], S = ASCII.size;
  atlas = document.createElement('canvas');
  atlas.width = S * glyphs.length;
  atlas.height = S;
  const context = atlas.getContext('2d');
  context.fillStyle = '#fff';
  context.font = `800 ${Math.round(S * .9)}px ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  glyphs.forEach((glyph, i) => context.fillText(glyph, i * S + S / 2, S * .54));
  return atlas;
}

/**
 * A legend round a face's rim, at `radius` (px of the SIZE canvas), from the
 * top, clockwise, each letter upright to the edge, spread evenly to fill the
 * whole circle (a short one said over again until it nearly does), in the
 * context's fill.
 */
function paintLegend(context, text, radius) {
  const S = SIZE, c = S / 2;
  const family = getComputedStyle(document.body).fontFamily;
  context.font = `600 ${Math.round(S * .036)}px ${family}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const width = line => [...line].reduce((sum, letter) => sum + context.measureText(letter).width + S * .008, 0);
  let line = text;
  while (width(line + text) < Math.PI * 2 * radius * 1.05) line += text;
  const letters = [...line], widths = letters.map(letter => context.measureText(letter).width + S * .008);
  // Spread to fill the whole circle, whatever the font measured.
  const stretch = Math.PI * 2 * radius / widths.reduce((a, w) => a + w, 0);
  let at = -Math.PI / 2;
  letters.forEach((letter, n) => {
    const a = at + widths[n] * stretch / 2 / radius;
    context.save();
    context.translate(c + Math.cos(a) * radius, c + Math.sin(a) * radius);
    context.rotate(a + Math.PI / 2);
    context.fillText(letter, 0, 0);
    context.restore();
    at += widths[n] * stretch / radius;
  });
}

/**
 * The reader's own seal (the contact): their initials struck in the middle in
 * the monogram's gold, inside a ring, with their name and the day round the
 * rim. Their letter, so their seal; the coin turns over to it as they sign.
 */
function paintSeal(context, name) {
  const S = SIZE, c = S / 2;
  const editorial = getComputedStyle(document.documentElement).getPropertyValue('--font-editorial').trim() || 'serif';
  context.clearRect(0, 0, S, S);
  context.fillStyle = context.strokeStyle = MONOGRAM_GOLD;
  context.lineWidth = S * .012;
  context.beginPath();
  context.arc(c, c, S * .4, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = S * .004;
  context.beginPath();
  context.arc(c, c, S * .37, 0, Math.PI * 2);
  context.stroke();
  // The initials, as large as the inner ring lets them be.
  const letters = initialsOf(name);
  let size = S * (letters.length > 1 ? .36 : .44);
  context.font = `400 ${size}px ${editorial}`;
  while (context.measureText(letters).width > S * .5 && size > S * .12) context.font = `400 ${size -= S * .01}px ${editorial}`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const box = context.measureText(letters);
  // Centred on the letters' own ink, not the font's line.
  context.fillText(letters, c, c + (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2);
  paintLegend(context, `${name.trim().toUpperCase()} · ${SEAL_DATE} · `, S * .455);
}

/** The day a seal is struck, as its rim gives it. */
const SEAL_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();
const SEAL = 'Seal:';
/** The coin's face that is the reader's own seal, for their name (or null for none yet: the coin stays Saad's). */
export const sealFace = name => (initialsOf(name) ? `${SEAL}${name.trim().replace(/\s+/g, ' ')}` : null);
/**
 * Initials from a name: the first letter of its first word and of its last
 * (one, for a single word), whatever the script, uppercased; '' for none.
 */
export function initialsOf(name) {
  const words = String(name ?? '').trim().split(/\s+/).map(word => word.replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean);
  if (!words.length) return '';
  const first = word => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)][0]?.segment ?? '';
  return (first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : '')).toLocaleUpperCase();
}

const cache = new Map();

/**
 * The tool's face for a coin that is dark (`onDark`) or light: a SIZE² canvas,
 * transparent round the mark. `ready` is called once the picture has loaded
 * (straight away if it already has).
 */
export function markCanvas(tool, onDark, ready) {
  const key = `${tool}|${onDark ? 'dark' : 'light'}`;
  let entry = cache.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    entry = { canvas, done: false, waiting: new Set() };
    cache.set(key, entry);
    const context = canvas.getContext('2d');
    const set = MARKS[tool];
    const url = set && (set.any ?? (onDark ? set.dark : set.light));
    const finish = () => {
      entry.done = true;
      entry.waiting.forEach(callback => callback());
      entry.waiting.clear();
    };
    if (tool === MONOGRAM) {
      const parts = [monogramRing, monogramLetters].map(src => { const image = new Image(); image.src = src; return image; });
      Promise.all(parts.map(image => image.decode().catch(() => {}))).then(() => {
        // The face spans the coin's face circle (radius .97 of the coin): the mark 1.56 of the coin's radius across.
        const size = SIZE * 1.56 / 1.94;
        for (const image of parts) {
          if (!image.naturalWidth) continue;
          const scratch = document.createElement('canvas');
          scratch.width = scratch.height = Math.ceil(size);
          const s = scratch.getContext('2d');
          s.drawImage(image, 0, 0, size, size);
          s.globalCompositeOperation = 'source-in';
          s.fillStyle = MONOGRAM_GOLD;
          s.fillRect(0, 0, size, size);
          context.drawImage(scratch, (SIZE - size) / 2, (SIZE - size) / 2);
        }
        finish();
      });
    } else if (tool.startsWith(SEAL)) {
      paintSeal(context, tool.slice(SEAL.length));
      finish();
    } else if (!url) {
      paintName(context, tool, onDark);
      finish();
    } else {
      const image = new Image();
      image.onload = () => {
        if (!paintMark(context, image)) paintName(context, tool, onDark);
        finish();
      };
      image.onerror = () => { paintName(context, tool, onDark); finish(); };
      image.src = url;
    }
  }
  if (ready) (entry.done ? ready() : entry.waiting.add(ready));
  return entry.canvas;
}

/** Whether a coin in this colour is dark enough for the marks made for dark grounds. */
export function isDark(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < .5;
}
