/**
 * The coin's faces, drawn once here instead of in every visitor's browser: `npm run coin:marks`.
 *
 * Each mark in src/assets/logos/brand (SVG, or Spline's PNG) is rendered to a 768² PNG in
 * src/assets/logos/coin, already fitted the way the coin shows it: its visible ink (not the file's padding)
 * centred, its longer side FILL of the face. In the browser that took an SVG rasterised at 1024², a read-back of
 * its pixels to find the ink, and a second draw: up to 400ms a mark on a slow phone (Vite's, with its fifteen
 * blur filters). Now the browser decodes a PNG (off the main thread) and draws it once.
 *
 * Run again after changing a mark. FILL matches webgl/coinMarks.js.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Drawn into the coin's 1024² face (coinMarks SIZE); 768 is still well over the largest the face is ever seen
// (about 440 device px across), at under half the bytes.
const SIZE = 768;
const FILL = .62;
const FROM = 'src/assets/logos/brand';
const TO = 'src/assets/logos/coin';
const MEASURE = 2048;
/** As webgl/coinMarks.js MORPH. */
const MORPH = { size: 512, spread: 110 };

/** The root <svg>'s attributes, and a way to set them. */
function root(svg) {
  const open = svg.match(/<svg\b[^>]*>/)[0];
  const read = name => open.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
  const set = attributes => {
    let tag = open;
    for (const [name, value] of Object.entries(attributes)) {
      const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`);
      tag = re.test(tag) ? tag.replace(re, ` ${name}="${value}"`) : tag.replace(/^<svg\b/, `<svg ${name}="${value}"`);
    }
    return svg.replace(open, tag);
  };
  return { read, set };
}

/** The drawing's own space: its viewBox, or its width and height. */
function box(svg) {
  const { read } = root(svg);
  const view = read('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (view?.length === 4) return { x: view[0], y: view[1], w: view[2], h: view[3] };
  return { x: 0, y: 0, w: parseFloat(read('width')) || 300, h: parseFloat(read('height')) || 150 };
}

/**
 * What the renderer does not follow, as it can: ids with colons (React's, as some brands export them) made plain, and
 * `style="mask-type: …"` made the attribute it also is, and wide-gamut `color(display-p3 …)` repeats dropped
 * for the sRGB colour each gives first.
 */
const plainIds = svg => svg.replace(/;?\s*(fill|stroke|stop-color|flood-color):\s*color\([^)]*\)/g, '').replace(/style="\s*mask-type:\s*(alpha|luminance);?\s*"/g, 'mask-type="$1"').replace(/(id="|url\(#|href="#)([^")]*)/g, (all, lead, id) => lead + id.replace(/[^\w-]/g, '_'));

/** RGBA pixels as a PNG, each row filtered the way that packs best, deflated hard. */
function png(width, height, rgba) {
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  const prev = Buffer.alloc(stride), row = Buffer.alloc(stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const line = rgba.subarray(y * stride, (y + 1) * stride);
    let best = null, bestType = 0, bestScore = Infinity;
    for (let type = 0; type < 5; type++) {
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? line[i - 4] : 0, b = y ? prev[i] : 0, c = i >= 4 && y ? prev[i - 4] : 0;
        const predict = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type];
        row[i] = (line[i] - predict) & 255;
      }
      let score = 0;
      for (let i = 0; i < stride; i++) score += row[i] < 128 ? row[i] : 256 - row[i];
      if (score < bestScore) { bestScore = score; bestType = type; best = Buffer.from(row); }
    }
    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
    line.copy ? line.copy(prev) : prev.set(line);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** A PNG as an SVG holding it, so both kinds go the same way. */
function pngAsSvg(file) {
  const data = fs.readFileSync(file);
  const w = data.readUInt32BE(16), h = data.readUInt32BE(20);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${data.toString('base64')}"/></svg>`;
}

/** `svg` rendered at width × height: { width, height, pixels } with straight (not premultiplied) RGBA, as a PNG holds. */
function render(svg, width, height) {
  const out = new Resvg(root(svg).set({ width, height, preserveAspectRatio: 'xMidYMid meet' }), { fitTo: { mode: 'original' } }).render();
  const pixels = Buffer.from(out.pixels);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a && a < 255) for (let c = 0; c < 3; c++) pixels[i + c] = Math.min(255, Math.round(pixels[i + c] * 255 / a));
  }
  return { width: out.width, height: out.height, pixels };
}

/**
 * The mark as a shape that can melt into another: what coinMarks' morphField needs, worked out here once
 * (the same reckoning: see there). MORPH.size² RGBA, rows from the foot up.
 */
function morph(pixels, S, spread) {
  const N = S * S, inside = new Uint8Array(N);
  for (let i = 0; i < N; i++) inside[i] = pixels[i * 4 + 3] >= 128 ? 1 : 0;
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
  const data = Buffer.alloc(N * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = ((S - 1 - y) * S + x) * 4;
    const from = inside[i] ? i : ink.seed[i], alpha = pixels[i * 4 + 3];
    const signed = alpha > 0 && alpha < 255 ? alpha / 255 - .5
      : inside[i] ? Math.sqrt(clear.far[i]) - .5 : .5 - Math.sqrt(ink.far[i]);
    if (from >= 0) { data[o] = pixels[from * 4]; data[o + 1] = pixels[from * 4 + 1]; data[o + 2] = pixels[from * 4 + 2]; }
    data[o + 3] = Math.max(0, Math.min(255, Math.round((.5 + signed / (2 * spread)) * 255)));
  }
  // Kept opaque, so no browser premultiplies it on the way in: the colour above, the shape (its alpha) below, in red.
  const sheet = Buffer.alloc(N * 8);
  for (let i = 0; i < N; i++) {
    data.copy(sheet, i * 4, i * 4, i * 4 + 3); sheet[i * 4 + 3] = 255;
    const o = (N + i) * 4; sheet[o] = sheet[o + 1] = sheet[o + 2] = data[i * 4 + 3]; sheet[o + 3] = 255;
  }
  return sheet;
}

fs.mkdirSync(TO, { recursive: true });
const report = [];
for (const name of fs.readdirSync(FROM).filter(f => /\.(svg|png)$/.test(f)).sort()) {
  const file = path.join(FROM, name);
  const svg = plainIds(name.endsWith('.png') ? pngAsSvg(file) : fs.readFileSync(file, 'utf8'));
  const space = box(svg);

  // 1. Where the ink is, in the drawing's own units (as the browser measured it: anything not quite clear).
  const k = MEASURE / Math.max(space.w, space.h);
  const big = render(root(svg).set({ viewBox: `${space.x} ${space.y} ${space.w} ${space.h}` }), Math.round(space.w * k), Math.round(space.h * k));
  const { width: bw, height: bh } = big, pixels = big.pixels;
  let left = bw, right = -1, top = bh, bottom = -1;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (pixels[(y * bw + x) * 4 + 3] < 4) continue;
    if (x < left) left = x; if (x > right) right = x;
    if (y < top) top = y; if (y > bottom) bottom = y;
  }
  if (right < 0) { report.push({ mark: name, face: 'no ink: skipped (the coin sets the name in type)' }); continue; }
  const ink = { x: space.x + left / k, y: space.y + top / k, w: (right - left + 1) / k, h: (bottom - top + 1) / k };

  // 2. The face: a square round the ink's middle, the ink's longer side FILL of it.
  const side = Math.max(ink.w, ink.h) / FILL;
  const cx = ink.x + ink.w / 2, cy = ink.y + ink.h / 2;
  const face = render(root(svg).set({ viewBox: `${cx - side / 2} ${cy - side / 2} ${side} ${side}` }), SIZE, SIZE);
  const out = path.join(TO, name.replace(/\.(svg|png)$/, '.png'));
  fs.writeFileSync(out, png(face.width, face.height, face.pixels));
  // 3. And its melting shape, for the about's five years (MORPH.size, drawn from the same square).
  const small = render(root(svg).set({ viewBox: `${cx - side / 2} ${cy - side / 2} ${side} ${side}` }), MORPH.size, MORPH.size);
  const field = out.replace(/\.png$/, '.morph.png');
  fs.writeFileSync(field, png(MORPH.size, MORPH.size * 2, morph(small.pixels, MORPH.size, MORPH.spread)));
  report.push({ mark: name, face: `${SIZE}² · ${Math.round(fs.statSync(out).size / 1024)} KB`, morph: `${Math.round(fs.statSync(field).size / 1024)} KB` });
}
console.table(report);
