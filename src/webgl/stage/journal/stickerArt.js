import portrait from '../../../assets/portrait.jpeg';
import letters from '../../../assets/monogram-letters.svg';
import ring from '../../../assets/monogram-ring.svg';
import blender from '../../../assets/logos/brand/blender.svg';
import three from '../../../assets/logos/brand/threejs-on-light.svg';
import webflow from '../../../assets/logos/brand/webflow.svg';
import gsap from '../../../assets/logos/brand/gsap-on-light.svg';
import figma from '../../../assets/logos/brand/figma.svg';
import spline from '../../../assets/logos/brand/spline.png';

/**
 * The stickers' printing (JOURNAL.stickers): each drawn once onto a canvas,
 * die-cut with a white vinyl border round whatever shape it is, with a second
 * canvas saying what each part of it is made of, for the shader (R holographic
 * foil, G gloss, B metal foil), and a coarse grid of where it is solid, so a
 * sticker is only picked up by the sticker itself, never the air round it.
 *
 * Drawn at once in whatever is ready, and again (`onReady`) once the pictures
 * and the fonts have loaded.
 */

const INK = '#1d1418';
const CREAM = '#f4ecdf';
const WINE = '#733d49';
const GOLD = '#c9a15a';
const TOOLS = { Blender: blender, 'Three.js': three, Webflow: webflow, GSAP: gsap, Figma: figma, Spline: spline };

const font = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const images = new Map();
function image(src) {
  if (!images.has(src)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    images.set(src, img);
  }
  return images.get(src);
}
const ready = img => img?.complete && img.naturalWidth > 0;

/** A small seeded random, so every visit draws the same stickers. */
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

/** Set `text` centred on `x` at baseline `y`, spaced out by `spacing` of its size (small capitals). */
function spaced(c, text, x, y, size, spacing) {
  const widths = [...text].map(ch => c.measureText(ch).width);
  const space = spacing * size;
  const total = widths.reduce((sum, w) => sum + w, 0) + space * (widths.length - 1);
  let at = x - total / 2;
  c.textAlign = 'left';
  [...text].forEach((ch, i) => { c.fillText(ch, at, y); at += widths[i] + space; });
}

/** An image fitted inside a box of `size` round (x, y). */
function fitted(c, img, x, y, size) {
  if (!ready(img)) return;
  const s = size / Math.max(img.naturalWidth, img.naturalHeight);
  c.drawImage(img, x - img.naturalWidth * s / 2, y - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
}

/** An SVG drawn in currentColor, inked in `colour`, `size` tall, centred on (x, y). */
function inked(c, img, x, y, size, colour) {
  if (!ready(img)) return;
  const w = size * img.naturalWidth / img.naturalHeight;
  const scratch = document.createElement('canvas');
  scratch.width = Math.ceil(w); scratch.height = Math.ceil(size);
  const s = scratch.getContext('2d');
  s.drawImage(img, 0, 0, w, size);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = colour;
  s.fillRect(0, 0, w, size);
  c.drawImage(scratch, x - w / 2, y - size / 2);
}

/* ----- the stickers ------------------------------------------------------ */

/**
 * Each kind: its size in px (the die-cut border is added round it), `art`
 * drawing it, and `finish` painting what it is made of (defaults to gloss
 * vinyl all over).
 */
const KINDS = {
  /** The portrait, as a polaroid: the photo glossy, the frame matte card, the caption in marker. */
  polaroid: {
    size: [440, 530],
    art(c, spec) {
      c.fillStyle = '#fbfaf6';
      c.fillRect(0, 0, 440, 530);
      const img = image(portrait);
      c.fillStyle = '#2a2226';
      c.fillRect(26, 26, 388, 388);
      if (ready(img)) {
        // Head and shoulders: the portrait is 1024 × 1536, the face a little above its middle.
        const side = img.naturalWidth * .56, sx = img.naturalWidth * .22, sy = img.naturalHeight * .22;
        c.drawImage(img, sx, sy, side, side, 26, 26, 388, 388);
        // A little warmth and fade, as an instant print has.
        c.fillStyle = 'rgba(255, 214, 170, .08)';
        c.fillRect(26, 26, 388, 388);
      }
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.font = `400 58px ${font('--font-editorial', 'serif')}`;
      c.fillText(spec.caption ?? '', 220, 492);
    },
    finish(c) {
      c.fillStyle = 'rgb(0, 60, 0)';
      c.fillRect(0, 0, 440, 530);
      c.fillStyle = 'rgb(0, 255, 0)';
      c.fillRect(26, 26, 388, 388);
    },
  },

  /** The SA coin: holographic foil, the monogram printed on it in ink. */
  monogram: {
    size: [300, 300],
    art(c) {
      const g = c.createLinearGradient(0, 0, 300, 300);
      g.addColorStop(0, '#d9cfe6'); g.addColorStop(.5, '#f3ead8'); g.addColorStop(1, '#cfe3e1');
      c.fillStyle = g;
      c.beginPath(); c.arc(150, 150, 150, 0, Math.PI * 2); c.fill();
      inked(c, image(ring), 150, 150, 236, INK);
      inked(c, image(letters), 150, 150, 236, INK);
    },
    finish(c) {
      c.fillStyle = 'rgb(255, 255, 0)';
      c.beginPath(); c.arc(150, 150, 150, 0, Math.PI * 2); c.fill();
    },
  },

  /** The straw hat off the S: crown, red band, wide brim, straw, an ink line round it. */
  hat: {
    size: [420, 290],
    art(c) {
      const random = seeded(21);
      c.save();
      c.translate(210, 150);
      const s = 190;
      const straw = '#ecc86a', shade = '#c9a146', band = '#c3283a';
      const brim = () => { c.beginPath(); c.ellipse(0, s * .22, s * 1.05, s * .36, 0, 0, Math.PI * 2); };
      const crown = () => {
        c.beginPath();
        c.moveTo(-s * .55, s * .16);
        c.bezierCurveTo(-s * .6, -s * .62, s * .6, -s * .62, s * .55, s * .16);
        c.closePath();
      };
      brim(); c.fillStyle = straw; c.fill();
      c.save(); brim(); c.clip();
      c.strokeStyle = shade; c.lineWidth = 3;
      for (let i = 0; i < 70; i++) {
        const t = random() * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(t) * s * .58, s * .22 + Math.sin(t) * s * .2);
        c.lineTo(Math.cos(t) * s * 1.02, s * .22 + Math.sin(t) * s * .35);
        c.stroke();
      }
      c.restore();
      crown(); c.fillStyle = straw; c.fill();
      c.save(); crown(); c.clip();
      c.fillStyle = band; c.fillRect(-s, -s * .04, s * 2, s * .2);
      c.strokeStyle = shade; c.lineWidth = 3;
      for (let i = -s; i < s; i += 15) { c.beginPath(); c.moveTo(i, -s * .6); c.lineTo(i + s * .12, -s * .05); c.stroke(); }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = 7; c.lineJoin = 'round';
      brim(); c.stroke();
      crown(); c.stroke();
      c.restore();
    },
  },

  /** A postage stamp from home: perforated, the Margalla Hills over Islamabad, where it is. */
  stamp: {
    size: [300, 360],
    art(c) {
      // Perforations: the paper with half circles bitten out all round.
      c.fillStyle = '#fbf6ec';
      c.fillRect(0, 0, 300, 360);
      c.globalCompositeOperation = 'destination-out';
      for (let x = 10; x < 300; x += 20) { c.beginPath(); c.arc(x, 0, 7, 0, Math.PI * 2); c.arc(x, 360, 7, 0, Math.PI * 2); c.fill(); }
      for (let y = 10; y < 360; y += 20) { c.beginPath(); c.arc(0, y, 7, 0, Math.PI * 2); c.arc(300, y, 7, 0, Math.PI * 2); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      // The picture: a dusk sky, the hills, the city's lights.
      const g = c.createLinearGradient(0, 30, 0, 250);
      g.addColorStop(0, '#2f3f63'); g.addColorStop(.6, '#b86b5f'); g.addColorStop(1, '#f0b77a');
      c.fillStyle = g;
      c.fillRect(26, 26, 248, 230);
      const hills = (base, amp, colour, seed) => {
        const random = seeded(seed);
        c.fillStyle = colour;
        c.beginPath(); c.moveTo(26, 256);
        for (let x = 26; x <= 274; x += 8) c.lineTo(x, base - Math.sin(x / 38 + seed) * amp - random() * amp * .35);
        c.lineTo(274, 256); c.closePath(); c.fill();
      };
      hills(168, 26, '#5b4a66', 3);
      hills(206, 18, '#3a2e44', 7);
      const random = seeded(5);
      c.fillStyle = '#ffd98a';
      for (let i = 0; i < 40; i++) c.fillRect(30 + random() * 240, 218 + random() * 34, 2.5, 2.5);
      c.fillStyle = '#fff4d6';
      c.beginPath(); c.arc(214, 88, 14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = WINE; c.lineWidth = 3; c.strokeRect(26, 26, 248, 230);
      c.fillStyle = WINE;
      c.textAlign = 'center';
      c.font = `400 66px ${font('--font-editorial', 'serif')}`;
      c.fillText('Pakistan', 150, 326);
    },
    finish(c) {
      c.fillStyle = 'rgb(0, 40, 0)';
      c.fillRect(0, 0, 300, 360);
      c.fillStyle = 'rgb(0, 140, 0)';
      c.fillRect(26, 26, 248, 230);
    },
  },

  /** A name tag. */
  hello: {
    size: [440, 290],
    art(c) {
      c.fillStyle = '#c73a3f';
      c.beginPath(); c.roundRect(0, 0, 440, 290, 34); c.fill();
      c.fillStyle = '#fffdf8';
      c.beginPath(); c.roundRect(16, 104, 408, 150, 14); c.fill();
      c.fillStyle = '#fffdf8';
      c.font = `800 54px ${font('--font-body', 'sans-serif')}`;
      spaced(c, 'HELLO', 220, 62, 54, .12);
      c.font = `700 26px ${font('--font-body', 'sans-serif')}`;
      spaced(c, 'MY NAME IS', 220, 93, 26, .16);
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.font = `400 104px ${font('--font-editorial', 'serif')}`;
      c.fillText('Saad', 220, 218);
    },
  },

  /** A holographic burst with a line on it. */
  star: {
    size: [360, 360],
    art(c, spec) {
      const points = 14;
      c.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = i / (points * 2) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 136 : 180;
        c.lineTo(180 + Math.cos(a) * r, 180 + Math.sin(a) * r);
      }
      c.closePath();
      const g = c.createRadialGradient(150, 130, 20, 180, 180, 190);
      g.addColorStop(0, '#f6efe4'); g.addColorStop(1, '#d8cde6');
      c.fillStyle = g;
      c.fill();
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.font = `400 56px ${font('--font-editorial', 'serif')}`;
      (spec.text ?? []).forEach((line, i, all) => c.fillText(line, 180, 196 + (i - (all.length - 1) / 2) * 60));
    },
    finish(c) {
      c.fillStyle = 'rgb(255, 255, 0)';
      c.fillRect(0, 0, 360, 360);
    },
  },

  /** A tool's mark, on a round white sticker. */
  tool: {
    size: [240, 240],
    art(c, spec) {
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(120, 120, 120, 0, Math.PI * 2); c.fill();
      fitted(c, image(TOOLS[spec.tool]), 120, 120, 150);
    },
  },
};

/** The white vinyl border round a drawing's shape: its silhouette, spread out `border` px each way. */
function dieCut(inner, border, colour) {
  const out = document.createElement('canvas');
  out.width = inner.width + border * 2;
  out.height = inner.height + border * 2;
  const c = out.getContext('2d');
  const silhouette = document.createElement('canvas');
  silhouette.width = inner.width; silhouette.height = inner.height;
  const s = silhouette.getContext('2d');
  s.drawImage(inner, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = colour;
  s.fillRect(0, 0, inner.width, inner.height);
  for (let k = 0; k < 32; k++) {
    const a = k / 32 * Math.PI * 2;
    c.drawImage(silhouette, border + Math.cos(a) * border, border + Math.sin(a) * border);
  }
  c.drawImage(silhouette, border, border);
  return out;
}

const GRID = 64;

/**
 * Draw sticker `spec` into `into` ({ colour, finish } canvases, made here the
 * first time): returns { colour, finish, aspect, solid(u, v) }.
 */
export function drawSticker(spec, into = {}) {
  const kind = KINDS[spec.kind];
  const [w, h] = kind.size;
  const border = Math.round(Math.max(w, h) * .045);
  const inner = document.createElement('canvas');
  inner.width = w; inner.height = h;
  kind.art(inner.getContext('2d'), spec);
  // Colour: the white border, then the drawing on it.
  const colour = into.colour ?? document.createElement('canvas');
  colour.width = w + border * 2; colour.height = h + border * 2;
  const cc = colour.getContext('2d');
  cc.clearRect(0, 0, colour.width, colour.height);
  cc.drawImage(dieCut(inner, border, '#fdfcf9'), 0, 0);
  cc.drawImage(inner, border, border);
  // Finish: the border gloss vinyl; the drawing what it is made of, only where it is drawn.
  const skin = document.createElement('canvas');
  skin.width = w; skin.height = h;
  const sc = skin.getContext('2d');
  if (kind.finish) kind.finish(sc, spec);
  else { sc.fillStyle = 'rgb(0, 255, 0)'; sc.fillRect(0, 0, w, h); }
  sc.globalCompositeOperation = 'destination-in';
  sc.drawImage(inner, 0, 0);
  const finish = into.finish ?? document.createElement('canvas');
  finish.width = colour.width; finish.height = colour.height;
  const fc = finish.getContext('2d');
  fc.fillStyle = 'rgb(0, 200, 0)';
  fc.fillRect(0, 0, finish.width, finish.height);
  fc.drawImage(skin, border, border);
  // Where it is solid, for picking it up.
  const probe = document.createElement('canvas');
  probe.width = probe.height = GRID;
  const pc = probe.getContext('2d');
  pc.drawImage(colour, 0, 0, GRID, GRID);
  const alpha = pc.getImageData(0, 0, GRID, GRID).data;
  const grid = new Uint8Array(GRID * GRID);
  for (let i = 0; i < grid.length; i++) grid[i] = alpha[i * 4 + 3] > 110 ? 1 : 0;
  return {
    colour, finish,
    aspect: colour.height / colour.width,
    // u across (0 left → 1 right), v up (0 bottom → 1 top), as the texture is.
    solid: (u, v) => u >= 0 && u < 1 && v >= 0 && v < 1 && grid[Math.floor((1 - v) * GRID) * GRID + Math.floor(u * GRID)] === 1,
  };
}

/** Everything the stickers draw with, loaded: resolves when it is (or has failed). */
export function stickerImages() {
  const all = [portrait, letters, ring, ...Object.values(TOOLS)].map(src => image(src));
  return Promise.all([document.fonts?.ready, ...all.map(img => img.decode().catch(() => {}))]);
}
