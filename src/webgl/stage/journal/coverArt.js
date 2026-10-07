import * as THREE from 'three';
import { JOURNAL } from '../../../content/journal.js';
import { COVER_STICKER } from '../bookCovers.js';
import { LITE } from '../../../lib/device.js';

/**
 * The covers' journal, set in type (JOURNAL.type): drawn onto a canvas per
 * cover, transparent where the leather shows through, laid out as the cover
 * is seen (its left at the left, its top at the top). With each, a finish
 * canvas for the shader: R where it is gold foil, G where it is matte ink,
 * B how deep it is pressed into the leather (blind stamping, the foil's own
 * press, the coin's seat), so the light catches the edges of the impression.
 *
 *   front  a pressed rule round the board, the elastic band, the title in
 *          foil, the seat the coin sits in at the middle, the maker's line
 *          pressed in at the foot; under the polaroid, a note for whoever
 *          peels it.
 *   back   the rule and the band, the return address, one line in his words.
 *
 * Drawn at once, and again when the fonts (the SAADi face among them) are in.
 */

export const ART = { width: 1536, height: 2444 };
/** The canvases' size, of ART: smaller on a phone, where the book is never drawn that big (lib/device). */
const SCALE = LITE ? .62 : 1;
const FOIL = '#cdb06f';
const INK = '#eee4d3';
/** The elastic band, as a share of the board's width from its left as the front is seen (toward the fore edge). */
const BAND = { at: .895, width: .034 };

let saadi = null;
/** The SAADi display face, loaded once from the site's own fonts. */
function loadSaadi() {
  if (!saadi && typeof FontFace !== 'undefined') {
    const face = new FontFace('SAADi Display', 'url(/fonts/SAADiDisplay-Regular.otf)');
    saadi = face.load().then(loaded => { document.fonts.add(loaded); return true; }).catch(() => false);
  }
  return saadi ?? Promise.resolve(false);
}

const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** The faces: the font, how it is spaced (of its size), and whether it is set in capitals. */
const STYLES = {
  mark: { font: size => `400 ${size}px 'SAADi Display', ${token('--font-display', 'serif')}`, spacing: .02 },
  serif: { font: size => `400 ${size}px ${token('--font-editorial', 'serif')}`, spacing: -.005 },
  caps: { font: size => `600 ${size}px ${token('--font-body', 'sans-serif')}`, spacing: .2, upper: true },
  body: { font: size => `500 ${size}px ${token('--font-body', 'sans-serif')}`, spacing: .01 },
};

/** Set `text` centred on `x` at baseline `y`, letter by letter where it is spaced out. Returns its width. */
function set(c, text, x, y, style, size) {
  const s = STYLES[style];
  const line = s.upper ? text.toUpperCase() : text;
  c.font = s.font(size);
  c.textBaseline = 'alphabetic';
  const space = s.spacing * size;
  if (Math.abs(space) < .5) {
    c.textAlign = 'center';
    c.fillText(line, x, y);
    return c.measureText(line).width;
  }
  c.textAlign = 'left';
  const widths = [...line].map(ch => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (widths.length - 1);
  let at = x - total / 2;
  [...line].forEach((ch, i) => { c.fillText(ch, at, y); at += widths[i] + space; });
  return total;
}

/**
 * The layers each finish is drawn into: the colour it is seen in on `art`,
 * and on `finish` its R foil, G matte, B press (how deep).
 */
const FINISH = {
  foil: { colour: FOIL, finish: 'rgb(255, 0, 110)' },
  ink: { colour: INK, finish: 'rgb(0, 255, 0)' },
  // Pressed in with no ink: a shade darker where the leather is crushed.
  blind: { colour: 'rgba(12, 3, 6, .36)', finish: 'rgb(0, 180, 255)' },
};

/** Draw the same thing onto the art and the finish, each in its own colour for `finish`. */
function both(c, f, kind, draw, alpha = 1) {
  const look = FINISH[kind];
  c.save(); f.save();
  c.globalAlpha = alpha;
  c.fillStyle = c.strokeStyle = look.colour;
  f.fillStyle = f.strokeStyle = look.finish;
  // The press is a little soft at its edges, as leather gives.
  f.filter = 'blur(1.2px)';
  draw(c); draw(f);
  c.restore(); f.restore();
}

/**
 * Where the lines that do something are on each cover (JOURNAL.type `link`),
 * as the cover is seen (u left → right, v top → bottom), a little bigger than
 * the type so they are easy to hit: { link, u0, u1, v0, v1 }. Filled as the
 * covers are drawn.
 */
export const LINKS = { front: [], back: [] };

/** The type on `side`. */
function type(c, f, side) {
  LINKS[side] = [];
  JOURNAL.type.filter(line => line.side === side).forEach(line => {
    const x = (line.u ?? .5) * ART.width, y = line.v * ART.height;
    let width = 0;
    both(c, f, line.finish, ctx => { width = set(ctx, line.text, x, y, line.style, line.size); }, line.dim ? .62 : 1);
    if (line.link) {
      const pad = line.size * .5;
      LINKS[side].push({
        link: line.link,
        u0: (x - width / 2 - pad) / ART.width, u1: (x + width / 2 + pad) / ART.width,
        v0: (y - line.size * .9 - pad) / ART.height, v1: (y + line.size * .3 + pad) / ART.height,
      });
    }
  });
}

/** A rule pressed round the board, inset from its edges. */
function rule(c, f) {
  const inset = ART.width * .055;
  both(c, f, 'blind', ctx => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(inset, inset, ART.width - inset * 2, ART.height - inset * 2, 18);
    ctx.stroke();
  });
}

/** The elastic band: dark woven cloth, lying on the board, a little shadow either side. */
function band(c, f, left) {
  const x = left * ART.width, w = BAND.width * ART.width;
  c.fillStyle = 'rgba(8, 2, 4, .28)';
  c.fillRect(x - 6, 0, w + 12, ART.height);
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#140d10'); g.addColorStop(.25, '#2a1f24'); g.addColorStop(.55, '#1d1519'); g.addColorStop(.85, '#271c21'); g.addColorStop(1, '#100a0d');
  c.fillStyle = g;
  c.fillRect(x, 0, w, ART.height);
  c.strokeStyle = 'rgba(255, 255, 255, .035)';
  c.lineWidth = 1.5;
  for (let y = 0; y < ART.height; y += 7) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + 4); c.stroke(); }
  // Cloth: a soft satin, not the leather's sheen.
  f.fillStyle = 'rgb(0, 120, 0)';
  f.fillRect(x, 0, w, ART.height);
}

/** The seat the coin sits in: a ring pressed into the cover round it, and the shallow well under it. */
function seat(c, f) {
  const x = COVER_STICKER.u * ART.width, y = COVER_STICKER.v * ART.height, r = COVER_STICKER.r * ART.width;
  both(c, f, 'blind', ctx => {
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r * 1.34, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 1.42, 0, Math.PI * 2); ctx.stroke();
  });
  both(c, f, 'blind', ctx => { ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, Math.PI * 2); ctx.fill(); }, .45);
}

function drawFront(c, f) {
  rule(c, f);
  seat(c, f);
  type(c, f, 'front');
  band(c, f, BAND.at);
}

function drawBack(c, f) {
  rule(c, f);
  // A short rule between the address and the line.
  both(c, f, 'foil', ctx => ctx.fillRect(ART.width / 2 - 60, ART.height * .31, 120, 3));
  type(c, f, 'back');
  // Seen from the back, the band is on the left (the fore edge is).
  band(c, f, 1 - BAND.at - BAND.width);
}

/**
 * The covers' art as textures: { front: { art, finish }, back: { art, finish } },
 * redrawn once the fonts are in (`onReady` then).
 */
export function makeJournalCovers(onReady) {
  const make = colour => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ART.width * SCALE); canvas.height = Math.round(ART.height * SCALE);
    const texture = new THREE.CanvasTexture(canvas);
    if (colour) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, texture };
  };
  const sides = { front: { art: make(true), finish: make(false) }, back: { art: make(true), finish: make(false) } };
  const draw = () => {
    for (const [name, paint] of [['front', drawFront], ['back', drawBack]]) {
      const { art, finish } = sides[name];
      const c = art.canvas.getContext('2d'), f = finish.canvas.getContext('2d');
      // Drawn in ART's units whatever the canvas's size.
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      f.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      c.clearRect(0, 0, ART.width, ART.height);
      f.fillStyle = '#000';
      f.fillRect(0, 0, ART.width, ART.height);
      paint(c, f);
      art.texture.needsUpdate = true;
      finish.texture.needsUpdate = true;
    }
    onReady?.();
  };
  draw();
  Promise.all([document.fonts?.ready, loadSaadi()]).then(draw);
  return {
    front: { art: sides.front.art.texture, finish: sides.front.finish.texture },
    back: { art: sides.back.art.texture, finish: sides.back.finish.texture },
    texel: [1 / (ART.width * SCALE), 1 / (ART.height * SCALE)],
  };
}
