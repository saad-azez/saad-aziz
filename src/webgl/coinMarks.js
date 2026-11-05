import monogramLetters from '../assets/monogram-letters.svg';
import monogramRing from '../assets/monogram-ring.svg';
import portrait from '../assets/portrait.jpeg';
import { coinLog } from './coinLog.js';

/**
 * The marks, ready for the coin (scripts/build-coin-marks.mjs, from logos/brand): `<file>.png` the face, fitted, and
 * `<file>.morph.png` its melting shape. Only those a coin shows are ever fetched.
 */
const FILES = import.meta.glob('../assets/logos/coin/*.png', { eager: true, query: '?url', import: 'default' });
const fileUrl = name => FILES[`../assets/logos/coin/${name}.png`];
import { afterLoader } from './gpuWork.js';

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
 * a real coin is a portrait, set in type: characters each the colour of his
 * photograph where it stands, the heavier the lighter (or, on a light coin,
 * the darker) that part of it, over the photograph itself, so it is his
 * picture exactly. Drawn by the coin's own shader every frame (DotStage
 * FACE_FRAGMENT), from his photograph (portraitPhoto) and the characters
 * (asciiAtlas).
 */
export const PORTRAIT = 'Portrait';
/**
 * And the face again, as a 3D artist would make it: a low-poly mesh, each
 * facet flat and the colour of his photograph at its middle, the wire of
 * their edges faint over them, drawn by the shader too. The coin's
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
 * The coin uses them as PNGs made from those files (logos/coin, `npm run coin:marks`).
 */
const MARKS = {
  'Three.js': { dark: 'threejs-on-dark', light: 'threejs-on-light' },
  Blender: { any: 'blender' },
  React: { dark: 'react-on-dark', light: 'react-on-light' },
  Figma: { any: 'figma' },
  Framer: { dark: 'framer-on-dark', light: 'framer-on-light' },
  Webflow: { any: 'webflow' },
  Vite: { any: 'vite' },
  'Next.js': { any: 'nextjs' },
  Shopify: { any: 'shopify' },
  Lottie: { any: 'lottiefiles' },
  JavaScript: { any: 'javascript' },
  GSAP: { dark: 'gsap-on-dark', light: 'gsap-on-light' },
  Spline: { any: 'spline' },
  'Custom code': { any: 'custom-code' },
  Angular: { any: 'angular' },
};

/** The file a tool's mark is in, for a coin that is dark (`onDark`) or light. */
function markFile(tool, onDark) {
  const set = MARKS[tool];
  return set && (set.any ?? (onDark ? set.dark : set.light));
}

/** Whether the coin has a face for this tool. */
export const hasMark = tool => Object.hasOwn(MARKS, tool);

export const SIZE = 1024;
/** How much of the face the mark's widest side takes. */
const FILL = .62;

// Painting a mark and reading its pixels back holds up the GPU, which the loader's thread shares: they wait in the
// site's queue for work after the loader (gpuWork.afterLoader), and go one at a time, whenever there is a moment.

/**
 * The mark onto the face. The marks come ready-fitted (scripts/build-coin-marks.mjs: the ink centred, its longer
 * side FILL of the face), so this is one draw: no rasterising an SVG at SIZE², no reading pixels back to find the ink.
 */
function paintMark(context, image) {
  context.clearRect(0, 0, SIZE, SIZE);
  context.drawImage(image, 0, 0, SIZE, SIZE);
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
 * The face, cut out of the portrait (960 × 1280) as a square: hair to collar,
 * the face filling most of it. As fractions: the square's side and its left of
 * the photo's width, its top of the photo's height.
 */
const CROP = { side: .525, x: .215, y: .216 };
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
 * Him, in colour, 512², cut out of the wall behind him: what both of the coin's faces of him are made from, each
 * point of them his own colour there. The wall is far more saturated than he is (orange wood; a grey suit, a white
 * shirt, skin, dark hair), so he is what is not; his face and neck, nearer the wood's colour in places, are kept by
 * the shape of them (CUT, in the crop's own square, 0 → 1). Then closed over its small gaps, its holes filled, and
 * its edge softened a touch. The cut is the alpha.
 *
 *   saturation, dark   what is him: less saturated than this, or darker than that
 *   face, neck         kept whatever their colour: an egg (its middle, how far either way, and how much narrower it
 *                      grows to the chin), and a box (its middle across, how far either way, and from and to down)
 */
const CUT = { saturation: .58, dark: .28, face: [.5, .42, .165, .26, .5], neck: [.5, .1, .6, .76] };
export const portraitPhoto = once((canvas, image) => {
  const S = 512, c = S / 2;
  canvas.width = canvas.height = S;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const inner = drawFace(context, image, S);
  const pixels = context.getImageData(0, 0, S, S), p = pixels.data;
  let him = new Uint8Array(S * S);
  const [fx, fy, frx, fry, chin] = CUT.face, [nx, nw, n0, n1] = CUT.neck;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, k = i * 4, r = p[k] / 255, g = p[k + 1] / 255, b = p[k + 2] / 255;
    const top = Math.max(r, g, b), saturation = top ? (top - Math.min(r, g, b)) / top : 0;
    const u = (x - (c - inner)) / (inner * 2), v = (y - (c - inner)) / (inner * 2);
    const across = frx * (1 - chin * Math.max(0, (v - fy) / fry));
    const kept = Math.hypot((u - fx) / across, (v - fy) / fry) < 1 || (Math.abs(u - nx) < nw && v > n0 && v < n1);
    him[i] = (saturation < CUT.saturation || top < CUT.dark || kept) && Math.hypot(x - c, y - c) < inner ? 1 : 0;
  }
  // Grown and shrunk again (`by` px, a square at a time): closing its small gaps, or (the other way) opening away specks.
  const spread = (grid, by, value) => {
    let out = grid;
    for (const across of [true, false]) {
      const next = new Uint8Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let hit = 1 - value;
        for (let d = -by; d <= by && hit !== value; d++) {
          const xx = across ? x + d : x, yy = across ? y : y + d;
          if (xx >= 0 && xx < S && yy >= 0 && yy < S && out[yy * S + xx] === value) hit = value;
        }
        next[y * S + x] = hit;
      }
      out = next;
    }
    return out;
  };
  him = spread(spread(him, 6, 1), 6, 0);
  him = spread(spread(him, 2, 0), 2, 1);
  // Its holes filled: whatever of the wall cannot be reached from the edge is him.
  const wall = new Uint8Array(S * S), queue = [];
  for (let i = 0; i < S; i++) for (const at of [i, (S - 1) * S + i, i * S, i * S + S - 1]) if (!him[at] && !wall[at]) { wall[at] = 1; queue.push(at); }
  while (queue.length) {
    const at = queue.pop(), x = at % S, y = (at / S) | 0;
    for (const next of [x > 0 ? at - 1 : -1, x < S - 1 ? at + 1 : -1, y > 0 ? at - S : -1, y < S - 1 ? at + S : -1]) {
      if (next >= 0 && !him[next] && !wall[next]) { wall[next] = 1; queue.push(next); }
    }
  }
  // Softened a touch at the edge, and set as the alpha.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(S - 1, Math.max(0, x + dx)), yy = Math.min(S - 1, Math.max(0, y + dy));
      sum += wall[yy * S + xx] ? 0 : 1;
    }
    p[(y * S + x) * 4 + 3] = Math.round(sum / 9 * 255);
  }
  context.putImageData(pixels, 0, 0);
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
    const name = markFile(tool, onDark);
    const url = name && fileUrl(name);
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
      coinLog('mark', key, `${tool}: no mark for it, so the face is set in type (${onDark ? 'dark' : 'light'} ground)`);
      paintName(context, tool, onDark);
      finish();
    } else {
      const source = `${name}.png`;
      const image = new Image();
      // Fetched and decoded (off the main thread) once the opening has settled, then painted at the next free moment.
      const paint = () => afterLoader(() => {
        paintMark(context, image);
        coinLog('mark', key, `${tool}: official mark, ${source} (${onDark ? 'dark' : 'light'} ground)`);
        finish();
      }, `coin mark ${tool}`);
      const failed = () => { coinLog('mark', key, `${tool}: ${source} failed to load, so the face is set in type`); paintName(context, tool, onDark); finish(); };
      afterLoader(() => { image.src = url; image.decode().then(paint, () => (image.complete && image.naturalWidth ? paint() : failed())); }, 'coin mark');
    }
  }
  if (ready) (entry.done ? ready() : entry.waiting.add(ready));
  return entry.canvas;
}

/**
 * The tool's mark as a shape that can melt into another (DotStage: the about's face, from stop to stop): MORPH.size²
 * RGBA, rows from the foot up (as a texture reads them). Its alpha is how far each point is from the mark's edge, a
 * half at the edge itself, more inside and less outside (MORPH.spread px either way spans it all), so two marks'
 * shapes can be mixed and cut at a half; its colour is the mark's own inside it and, outside, the colour of the
 * nearest of its ink, so a shape on its way to another is never uncoloured. Made once the mark is drawn (`ready`
 * then has it) and kept.
 */
export const MORPH = { size: 512, spread: 110 };
const morphs = new Map();
export function morphField(tool, onDark, ready) {
  const key = `${tool}|${onDark ? 'dark' : 'light'}`;
  if (morphs.has(key)) { ready(morphs.get(key)); return; }
  // Worked out at build time (scripts/build-coin-marks.mjs): fetched, decoded off the main thread, and unpacked.
  const name = markFile(tool, onDark), prepared = name && FILES[`../assets/logos/coin/${name}.morph.png`];
  if (prepared) {
    if (!loading.has(key)) loading.set(key, loadMorph(prepared).then(field => { morphs.set(key, field); return field; }));
    loading.get(key).then(ready, () => { loading.delete(key); morphs.delete(key); buildFromMark(tool, onDark, key, ready); });
    return;
  }
  buildFromMark(tool, onDark, key, ready);
}
const loading = new Map();

/** A prepared field: the colour in the top half of the sheet, the shape in the red of the bottom half. */
function loadMorph(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    afterLoader(() => {
      image.src = url;
      image.decode().then(() => afterLoader(() => {
        const S = MORPH.size, N = S * S;
        const canvas = document.createElement('canvas');
        canvas.width = S; canvas.height = S * 2;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const sheet = context.getImageData(0, 0, S, S * 2).data, data = new Uint8Array(N * 4);
        for (let i = 0; i < N; i++) {
          const o = i * 4;
          data[o] = sheet[o]; data[o + 1] = sheet[o + 1]; data[o + 2] = sheet[o + 2]; data[o + 3] = sheet[(N + i) * 4];
        }
        resolve({ data, size: S });
      }, 'coin morph'), reject);
    }, 'coin morph fetch');
  });
}

/** No prepared field (a mark added without running the script): worked out here from the drawn mark. */
function buildFromMark(tool, onDark, key, ready) {
  markCanvas(tool, onDark, () => {
    if (!morphs.has(key)) morphs.set(key, buildMorph(markCanvas(tool, onDark)));
    ready(morphs.get(key));
  });
}
function buildMorph(source) {
  const S = MORPH.size, N = S * S;
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = S;
  const context = scratch.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, S, S);
  const pixels = context.getImageData(0, 0, S, S).data;
  const inside = new Uint8Array(N);
  for (let i = 0; i < N; i++) inside[i] = pixels[i * 4 + 3] >= 128 ? 1 : 0;
  // The nearest point that is (`want` 1) or is not (0) ink, for every point: two sweeps, each point taking the
  // nearest of what its neighbours already found (dead reckoning; near enough to exact for this).
  const nearest = want => {
    const seed = new Int32Array(N).fill(-1), far = new Float32Array(N).fill(Infinity);
    for (let i = 0; i < N; i++) if (inside[i] === want) { seed[i] = i; far[i] = 0; }
    const take = (i, j) => {
      const s = seed[j];
      if (s < 0) return;
      const dx = (i % S) - (s % S), dy = ((i / S) | 0) - ((s / S) | 0), d = dx * dx + dy * dy;
      if (d < far[i]) { far[i] = d; seed[i] = s; }
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (x > 0) take(i, i - 1);
      if (y > 0) { take(i, i - S); if (x > 0) take(i, i - S - 1); if (x < S - 1) take(i, i - S + 1); }
    }
    for (let y = S - 1; y >= 0; y--) for (let x = S - 1; x >= 0; x--) {
      const i = y * S + x;
      if (x < S - 1) take(i, i + 1);
      if (y < S - 1) { take(i, i + S); if (x < S - 1) take(i, i + S + 1); if (x > 0) take(i, i + S - 1); }
    }
    return { seed, far };
  };
  const ink = nearest(1), clear = nearest(0);
  const data = new Uint8Array(N * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = ((S - 1 - y) * S + x) * 4;
    const from = inside[i] ? i : ink.seed[i], alpha = pixels[i * 4 + 3];
    // (On the mark's own soft edge, how much of the point it covers says where the edge is in it, finer than a
    // point; elsewhere, how far the nearest point across the edge is, less the half of a point the edge lies at.)
    const signed = alpha > 0 && alpha < 255 ? alpha / 255 - .5
      : inside[i] ? Math.sqrt(clear.far[i]) - .5 : .5 - Math.sqrt(ink.far[i]);
    if (from >= 0) { data[o] = pixels[from * 4]; data[o + 1] = pixels[from * 4 + 1]; data[o + 2] = pixels[from * 4 + 2]; }
    data[o + 3] = Math.max(0, Math.min(255, Math.round((.5 + signed / (2 * MORPH.spread)) * 255)));
  }
  return { data, size: S };
}

/** Whether a coin in this colour is dark enough for the marks made for dark grounds. */
export function isDark(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < .5;
}
