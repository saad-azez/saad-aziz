import * as THREE from 'three';
import gsap from 'gsap';
import { SURFACE_LIGHTING } from '../hero/lighting.glsl.js';
import { createSolidMaterial, paintSolid } from '../hero/materials.js';
import { brandPalette, onSchemeChange } from '../../brand/palette.js';
import { reducedMotion } from '../../brand/motion.js';
import RopeScrollbar from './RopeScrollbar.js';
import ReviewRing from './ReviewRing.js';
import { coinTransition, splitAt, ROW, FLIGHT } from './coinTransition.js';
import { aboutTransition, aboutFaces, SKETCH } from './aboutTransition.js';
import { towerAt, TOWER } from './tower.js';
import { markCanvas, isDark, hasMark, COIN_SKILLS, MONOGRAM, PORTRAIT, MESH, ASCII, portraitField, portraitPhoto, asciiAtlas } from '../coinMarks.js';
import Book, { itemAt, ringSize, VIEW, PAGE_ASPECT, BOOK as MAKE } from './Book.js';
import { coverColours, COVER_STICKER } from './bookCovers.js';
import { makeJournalCovers, LINKS } from './journal/coverArt.js';
import Stickers from './journal/Stickers.js';
import { JOURNAL } from '../../content/journal.js';
import { landing, stepSpring } from './leafMotion.js';
import { viewHeight } from '../../lib/viewport.js';
import { pixelRatio } from '../../lib/device.js';
import { gliding, scrollToY } from '../../lib/smoothScroll.js';

/**
 * The stage.
 *
 * One fixed, transparent canvas over the whole page, drawn with a perspective
 * camera set so that the plane z = 0 is the screen at a pixel a unit (world
 * x, -y is the screen point). It carries the journey from the hero into the
 * work, which components/journey pins to the screen as one scene:
 *
 * The rope leaves the word and becomes the scrollbar. The coin (the i's dot)
 * comes off the i to the middle of the screen, turning, while a window opens
 * round it onto the work; the book of projects (Book.js) flies up to it from
 * below, the coin sticks to its cover, and the book opens; then the coin goes
 * to its own place among the project's tools. The hero and the work's copy
 * follow the same scroll position (coinTransition.js has the choreography).
 */

/**
 * The journey's stretches of scroll, in screens (px for START). Shared with
 * components/journey, which sizes the scene from them.
 */
/** The pace of the way in (brand/intro.js): the dissolve starts on the first wheel gesture and resolves before the coin. */
const SCROLL_PACE = { ROPE: .65, ZOOM: .72, HOLD: 0, SHUT: .8, RECEDE: .55, GAP: .06 };

/**
 * The hop between the rope and the about's card (stepHop), by the clock, not
 * the scroll: a jump scrubbed by a mouse wheel stalls in mid-air or is over in
 * a blink. The moment the reader scrolls past the end of the work, the coin
 * takes `time` s to go: crouched into the rope for the first `crouch` of it
 * (the rope sagging `sag` px more under it), then off, the rope snapping back
 * and wobbling out (`recoil`: its frequency /s and damping /s), over in an arc
 * (`height`, of a screen) turning end over end and growing, into wherever its
 * place on the card is by then, landing squashed (the last `land` of it).
 * Scrolled back above the about, it hops back onto the rope the same way. The
 * page goes with it each way, once it is in the air (gliding to the card, or
 * back to the end of the work), so it lands as its place arrives;
 * unless something else is gliding the page already (a link to the contact,
 * passing through), when the coin simply goes along.
 */
const HOP = { time: 1.1, crouch: .18, sag: 24, recoil: [2.3, 5], height: .26, land: .13 };

export const SCROLL = {
  /** The rope leaving the word to become the scrollbar, before anything else moves. */
  ROPE: .6,
  /** Pixels of scroll, after the rope, before the dot leaves the letter. */
  START: 16,
  /** The window opening round the coin on the i. */
  ZOOM: 1.1,
  /** Optional pause once the work is in view. */
  HOLD: .1,
  /** The book standing shut, to be picked up and turned over (k 1 → 2). */
  SHUT: .8,
  /** The book opening, the coin splitting into the tools, and the work's copy coming in (k 2 → 3). */
  RECEDE: .4,
  /** A breath at the end. */
  GAP: .1,
  /** The projects are browsed by hand, not by scroll: no scroll per project. */
  PER_PROJECT: 0,
  /** The pace of the way in, set last. */
  ...SCROLL_PACE,
  /** The work held still at its end: none, the jump into the about begins as it ends. */
  FOLD: 0,
};

const FOV = 30;
/**
 * Half-turns the coin makes on the i as the window opens: the hero's next
 * skill passes, and it lands on the first tool of the project on show.
 */
const TRAVEL_FLIPS = reducedMotion ? 0 : 2;
/** The row of tools: at most this many coins (the one from the i and the rest). */
const ROW_MAX = 6;
/** A change of project: the row's coins turn over one after another to the new project's tools, each in `turn` s, `stagger` s after the one before. */
const WAVE = { turn: .55, stagger: .08 };
/**
 * The book (its angle is Book.VIEW): how wide a page is at most, in the
 * room's widths and heights; how far it leans toward the pointer (radians);
 * and how much of the way (k) its opening takes, once the window is round it.
 * Everything it does by hand is one spring (leafMotion.js).
 */
const BOOK = { width: .8, height: .78, lean: { x: .16, y: .1 }, open: .5 };
/**
 * The shut book's way in (coinTransition FLIGHT): it flies up from below the
 * screen (`below` px past its bottom edge), head first and leaning into it,
 * turned a little and banking, and straightens as it comes to a stop in the
 * middle. Where it stands: in the middle of the room under the header (the
 * journey's shutTop), `height` of the screen's height but at most `fill` of
 * that room, and never wider than `width` of the screen. Where the lines about
 * it go above and below it (`stacked`), `stackedHeight` of the room and at
 * most `stackedWidth` of the screen's width.
 */
const ENTRY = { pitch: -.8, yaw: .45, roll: .3, bank: .14, below: 40 };
const SHUT = { height: .6, width: .6, fill: .8, stackedHeight: .6, stackedWidth: .84 };
/** The coin at its nearest, in the middle of the screen: its radius, of the screen's smaller side (and at least `times` its own). */
const NEAR = { most: .16, times: 2.5 };
/**
 * The shut book in the hand (k 1 → 2): how far it turns per px dragged
 * (across, and up and down), how far it tips at most, how fast it may spin,
 * how quickly a spin dies away, and the spring that brings it to rest square
 * on a cover (and level) once it has slowed. Left turned away, it turns back
 * to face the reader by itself (`rest`: its turn and tip, front cover on) once
 * it has been let alone for `idle` seconds, or at once when the reader scrolls
 * on; that turn is a spring (`face`: rad/s, damping), and `square` is how near
 * it must be (rad) before the book will open. Where on the way (k) it opens,
 * and how far it takes to turn from standing to the open book's angle.
 */
const HOLD = {
  perPx: .0085, tipPerPx: .005, tip: .6, fastest: 9, friction: 3.4, omega: 5.5, zeta: .82,
  rest: { yaw: -.28, tip: -.08 }, idle: 3, face: [6.5, .86], square: .04,
};
const OPEN = { at: 2, turn: .35 };
/** The coin flicked off the cover as the book opens: how high it arcs (px over its way), and how many flips. */
const LIFT = { height: 170, flips: 1 };
/**
 * The coin trapped under a sticker (or a pile of them) on the cover as the
 * book opens: it struggles for `struggle` seconds (shaking harder and harder)
 * before it breaks out and the stickers fly off it (Stickers.scatter), then it
 * goes on as the scroll says; the struggling: how far it slides in its seat
 * (of its radius) at its hardest, the stickers' bump with it (it does not rock:
 * its edge would come up through them). Breaking out it pops up off the cover (`pop`
 * of its radius at the top, over `popTime` s, `grow`ing that much bigger as it
 * comes up toward the reader), turning over once, and drops back into
 * its seat; once the stickers are home and the reader has had `settle`
 * seconds to see them land, the book may open, as the reader scrolls on
 * (gateK, GATE).
 */
const ESCAPE = { struggle: 1.6, slide: .06, pop: 4.5, popTime: .7, grow: .45, settle: .9 };
/** The end of the way (k): the book open, the project in. */
const K_END = 3;
/**
 * The book let go after being held shut (gateK): it opens over the scroll the
 * reader has left, if there is at least `room` of it (in k); with less (they
 * are at the end of the page), by itself, after `wait` s, over `open` s.
 */
const GATE = { room: .08, wait: .6, open: 1.6 };
/**
 * The book shaken by the coin trapped in it (shakeBook): trembling with it as
 * it fights (`tremble` px, `roll` rad at its hardest), knocked down (`thump`
 * px, tipping `tip` rad) each time it heaves against the stickers, `knock`
 * times a second or so; then kicked as it breaks out and pressed down by its
 * weight as it drops back into its seat (`drop` px), ringing out (`ring`
 * rad/s, dying away at `decay`).
 */
const SHAKE = { tremble: 4, roll: .035, thump: 12, tip: .08, knock: 4, drop: 24, ring: 24, decay: 5.5 };
/**
 * The tightrope: the scroll rope comes into the project's copy as the book
 * opens (`from` on the way, over `span`; RopeScrollbar), tied between two
 * posts, and the coin, flicked off the cover, lands right on it and walks it:
 * standing over each of the project's tools' tags in turn (`hold` s), then
 * walking on to the next (`walk` s), turning over to that tool as it goes;
 * the tags hang evenly along it, `inset` of it clear of each post.
 *
 * The rope sags `droop` px at its middle by itself, and `weight` px more
 * under the coin, to a point where it stands (ropeDissolve ROPE_SAG); landing
 * on it the coin comes down at `landing` px/s and the rope gives and bounces
 * back on its spring (`give`: rad/s, damping), and each step it takes on it
 * (`step` px/s) bounces it a little again. Its place along the rope follows
 * the walk on `follow`.
 *
 * Balancing: how far it leans either way at most (rad), how fast it wobbles,
 * how far it edges back and forth (of its radius) to keep its balance, and
 * how far it leans into its walk (rad per px/s, and at most).
 */
const TIGHTROPE = {
  from: 2.02, span: .26, hold: 1.6, walk: .95, inset: .08,
  droop: 3, weight: 5, landing: 190, step: 55, give: [17, .16], follow: [11, .95],
  lean: .08, wobble: 1.7, edge: .14, into: .0009, intoMost: .2,
};
/** The tag the coin is at on the `n`th step of its walk, of `count`: along the rope and back, 0 1 2 1 0 1 … */
const pace = (n, count) => {
  if (count < 2) return 0;
  const p = mod(n, 2 * (count - 1));
  return p < count ? p : 2 * (count - 1) - p;
};
/** How far the copy rises as it comes in (px; Work.css .work__copy), for the rope to rise with it. */
const COPY_RISE = 22;
/** Half the rope's thickness on the screen (px; RopeScrollbar DIAMETER), for the coin to stand on top of it. */
const ROPE_HALF = 2;
const UPRIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
/**
 * The book turning on its own, like the reel but slower: it never stops, but
 * slows almost to a standstill on every page (`ease`: 0 turns steadily, 1
 * stops dead), `period` seconds a page. Past the covers (after the last page,
 * on round to the first) it does not slow, and takes `covers` periods for the
 * two places.
 */
const SPIN = { period: 3.4, ease: .82, covers: 1.5 };
const TAU = Math.PI * 2;
/** The spin's easing over one step: slow at both ends, never quite still. */
const spinEase = x => x - SPIN.ease * Math.sin(TAU * x) / TAU;
const spinSpeed = x => 1 - SPIN.ease * Math.cos(TAU * x);
const mod = (a, n) => ((a % n) + n) % n;
/** The lamp under the pointer: how long it takes to open wider and brighten, and to settle back (s). */
const LIT = { on: .7, off: .9 };
/**
 * The coin in the about (aboutTransition has the choreography): how many
 * times it turns end over end falling into it out of the sky, how high it arcs
 * moving between places there (of the screen's height), how far it leans
 * toward the pointer at rest (rad), how far it sways there by itself (rad, and
 * how fast), and how much of the way in the rope takes to leave the copy for
 * the edge again, the scrollbar.
 */
const ABOUT_COIN = { turns: 1, arc: .1, tilt: .26, sway: .07, swaySpeed: .9, rope: .35 };
/** A narrow screen (as About.css has it): no ring of reviews round the coin there, they run as a ticker. */
const narrowScreen = window.matchMedia("(max-width: 600px), (max-aspect-ratio: 4/5)");
/**
 * The coin in the hand, on the card: how far it turns per px dragged, how fast
 * it may spin (rad/s), how quickly a spin dies away, below what speed it
 * settles, the spring that settles it onto a face (rad/s, damping), and the
 * flick a tap gives it (rad/s: about a half-turn, over to his other side).
 */
const HAND = { perPx: .012, fastest: 26, friction: 1.6, settle: 3, spring: [9, .7], tap: 7.5 };
// (Lower on a phone: lib/device.)
const DPR = pixelRatio;

const LIT_VERTEX = /* glsl */ `
varying vec3 vView, vNormal;
varying vec2 vUv;
varying float vBack;
void main() {
  vUv = uv;
  vBack = normal.z < 0.0 ? 1.0 : 0.0;
  vNormal = normalize(normalMatrix * normal);
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vView = view.xyz;
  gl_Position = projectionMatrix * view;
}
`;

/**
 * A coin face: the letters' material, with the tool's official mark printed on
 * it in its own colours. Or (uMode) Saad's face, drawn here every frame from
 * the portrait's light (uField: red, the light; green, the sitter):
 *
 *   1  the engineer: set in ASCII, a grid of uCells characters across, each
 *      the ramp's heavier the more ink that part of the face wants (on a light
 *      coin the dark of it, on a dark coin, uOnDark, the light), each a shade
 *      of ink as well as a weight, so the features carry;
 *   2  the artist: a low-poly mesh of the same face, facets of flat tone
 *      sampled at their middles, the wire of their edges over them, and the
 *      empty ground round him a faint grid, a modeller's viewport.
 *
 * Either way, where the pointer is (uPointer on the face, 0 → 1; uHover how
 * much it is there) a lens looks through the drawing at him: inside it, his
 * photograph (uPhoto), magnified; at its edge a fine ring, and a band of
 * characters churning, as if the code were decoding into the picture.
 */
const ASCII_RAMP = ASCII.ramp.length.toFixed(1), ASCII_ALL = (ASCII.ramp.length + ASCII.scramble.length).toFixed(1);
const FACE_FRAGMENT = /* glsl */ `
uniform vec3 uColor, uShade, uHighlight, uMark, uAsciiInk, uAsciiHot;
uniform float uRoughness, uMarkOpacity, uMode, uOnDark, uCells, uHover, uTime, uNear;
uniform vec2 uPointer;
uniform sampler2D uMask, uField, uGlyphs, uPhoto;
varying vec3 vView, vNormal;
varying vec2 vUv;
${SURFACE_LIGHTING}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
/** How much ink the face wants at \`uv\` (0 → 1), and whether it is the sitter there (not the wall). */
vec2 ink(vec2 uv) {
  vec2 field = texture2D(uField, uv).rg;
  return vec2(mix(1.0 - field.r, field.r, uOnDark), field.g);
}
vec4 engineer(vec2 uv, float edge) {
  vec2 grid = uv * uCells, cell = floor(grid), local = fract(grid);
  vec2 centre = (cell + .5) / uCells;
  vec2 want = ink(centre);
  float level = want.x * want.y;
  float index = floor(clamp(level, 0.0, 1.0) * (${ASCII_RAMP} - 1.0) + .5);
  // At the lens's edge the characters churn: another, random, for a moment, now and then.
  if (want.y > .05 && hash(cell + floor(uTime * 15.0)) < edge * .9) {
    index = ${ASCII_RAMP} + floor(hash(cell * 1.7 + floor(uTime * 21.0)) * (${ASCII_ALL} - ${ASCII_RAMP}));
  }
  float glyph = smoothstep(.08, .55, texture2D(uGlyphs, vec2((index + clamp(local.x, .04, .96)) / ${ASCII_ALL}, local.y)).a);
  // Under the type, a ghost of the face itself (smooth, at this very point), so he is known at a glance.
  vec2 here = ink(uv);
  float ghost = here.x * here.y * .32;
  return vec4(mix(uAsciiInk, uAsciiHot, edge), max(glyph * (.4 + .6 * max(level, edge)), ghost));
}
vec2 jitter(vec2 v) { return v + (vec2(hash(v), hash(v + 17.3)) - .5) * .55; }
vec3 bary(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 v0 = b - a, v1 = c - a, v2 = p - a;
  float d = v0.x * v1.y - v1.x * v0.y;
  float y = (v2.x * v1.y - v1.x * v2.y) / d, z = (v0.x * v2.y - v2.x * v0.y) / d;
  return vec3(1.0 - y - z, y, z);
}
vec4 artist(vec2 uv, float edge) {
  float n = uCells * 1.05;
  vec2 g = uv * n, c = floor(g);
  vec2 p00 = jitter(c), p10 = jitter(c + vec2(1.0, 0.0)), p01 = jitter(c + vec2(0.0, 1.0)), p11 = jitter(c + vec2(1.0, 1.0));
  // Which of the cell's two triangles (split corner to corner) this is in, and how near its edges.
  vec3 b1 = bary(g, p00, p10, p11), b2 = bary(g, p00, p11, p01);
  bool first = min(b1.x, min(b1.y, b1.z)) >= min(b2.x, min(b2.y, b2.z));
  vec3 b = first ? b1 : b2;
  vec2 mid = (first ? (p00 + p10 + p11) : (p00 + p11 + p01)) / 3.0 / n;
  vec2 want = ink(mid);
  // A facet: flat, its tone from its middle, and lit as a modelled surface is: tilted by the face's own slope there
  // (the light's gradient read as height), the light from up and to the left.
  float e = 1.5 / n;
  float gx = ink(mid + vec2(e, 0.0)).x - ink(mid - vec2(e, 0.0)).x;
  float gy = ink(mid + vec2(0.0, e)).x - ink(mid - vec2(0.0, e)).x;
  vec3 normal = normalize(vec3(-gx * 3.0, -gy * 3.0, 1.0));
  float light = clamp(dot(normal, normalize(vec3(-.55, .6, .75))), 0.0, 1.0);
  float facet = clamp(want.x * (.5 + .65 * light) + (hash(c + (first ? .3 : .7)) - .5) * .06, 0.0, 1.0) * want.y;
  float wire = 1.0 - smoothstep(0.0, .03, min(b.x, min(b.y, b.z)));
  float a = max(facet * .95, wire * (want.y > .05 ? .32 : .05));
  return vec4(mix(uAsciiInk, uAsciiHot, max(edge, wire * .25)), a);
}
vec4 portrait(vec2 uv) {
  // The lens: where the pointer is, a circle through which his photograph is seen, larger.
  float near = distance(uv, uPointer), radius = uNear * uHover;
  float inside = 1.0 - smoothstep(radius * .9, radius, near);
  float edge = uHover * exp(-pow((near - radius) / (uNear * .14), 2.0));
  vec4 drawn = uMode < 1.5 ? engineer(uv, edge) : artist(uv, edge);
  vec3 photo = texture2D(uPhoto, uPointer + (uv - uPointer) * .62).rgb;
  float ring = uHover * (1.0 - smoothstep(.0015, .0045, abs(near - radius)));
  float rim = 1.0 - smoothstep(.002, .005, abs(length(vUv - .5) - .468));
  vec4 mark = vec4(mix(drawn.rgb, photo, inside), max(mix(drawn.a, 1.0, inside), rim * .85));
  return vec4(mix(mark.rgb, uAsciiHot, ring), max(mark.a, ring));
}
void main() {
  vec3 color = shadeSurface(vView, normalize(vNormal));
  vec4 mark = uMode > .5 ? portrait(vUv) : texture2D(uMask, vUv);
  gl_FragColor = vec4(mix(color, mark.rgb, mark.a * uMarkOpacity), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smootherStep = t => t ** 3 * (t * (t * 6 - 15) + 10);

class DotStage {
  constructor() {
    this.work = null;
    this.hero = null;
    this.heroRest = false;
    this.engaged = false;
    this.dot = { x: 0, y: 0, z: 0, r: 12 };
    /** Where the coin is on its way: 0 on the letter, 1 the work in view, 2 settled; and the scroll's own way (gateK). */
    this.k = 0;
    this.kRaw = 0;
    this.phase = 'hero';
    this.revealed = false;
    /** The project on show (set by components/work); -1 for none: the coin shows the skills. */
    this.active = -1;
    /** The lamp's turn, in items (Book itemAt: project i on show at page i + 1), and the window's clip for it. */
    this.leaf = { at: 1, velocity: 0 };
    /** The way out blended in (0 → 1) as the reader scrolls back up (Book openAngles). */
    this.exit = 0;
    this.kWas = 0;
    /** 'rest', 'spin' (turning on by itself), 'drag' (in the reader's hand) or 'spring' (landing). */
    this.leafMode = 'rest';
    /** Whether the book may turn on by itself (components/work: in view, and nobody reading or holding it), and the step it is on. */
    this.autoplay = false;
    this.spin = null;
    /** The lean toward the pointer, eased: x and y, -1 → 1, and where they are going. */
    this.lean = { x: 0, y: 0, toX: 0, toY: 0 };
    /** The shut book in the reader's hand: its turn and tip, how fast they are changing, and whether it is held. */
    this.hold = { yaw: HOLD.rest.yaw, tip: HOLD.rest.tip, vYaw: 0, vTip: 0, held: false, facing: true };
    this.holding = false;
    /** The lamp lit up under the pointer (Book update), 0 → 1. */
    this.lit = { amount: 0 };
    this.lens = new THREE.Vector3();
    /** Where the coin rests in the work, eased to the project on show's tools line. */
    this.sealAt = null;
    this.flip = { angle: 0 };
    /** The coin in the work: the tool it shows, and the turn to the next. */
    this.seal = { shown: null, project: -1, index: 0, hold: 0, turns: 0, progress: 0, flip: null };
    /**
     * The coin on the tightrope: how far along it it stands (0 → 1 from its left post) and how fast it is going,
     * how far the rope gives under it (px) and how fast, and how far the rope sags by itself (RopeScrollbar and
     * components/work read it: the rope and the tags hanging from it sag together).
     */
    this.walk = { c: .5, v: 0, dip: 0, dipV: 0, droop: TIGHTROPE.droop, n: 0 };
    this.masks = new Map();
    this.lastScroll = -1;
    this.renderUntil = 0;
    this.tick = this.tick.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointer = this.handlePointer.bind(this);
    /** Where the reader's pointer is on the screen (px): the light the book's covers and stickers catch. */
    this.pointer = { x: window.innerWidth * .7, y: window.innerHeight * .25 };
    /**
     * The about (components/about), once measured; how far its screen has come up (0 → 1); and the coin there:
     * whether it is, where it stood on the rope when it jumped, what it was showing, and its lean toward the pointer.
     */
    this.about = null;
    this.aboutEnter = 0;
    this.aboutOn = false;
    this.aboutFrom = null;
    /** The hop (stepHop): 'rope' (on it), 'up' (to the card), 'card' (on it), 'down' (back to the rope), and how far through it is. */
    this.hop = { phase: 'rope', t: 0, start: null };
    /** How far the ring of reviews round the coin is open (0 → 1, by the clock: it opens once the coin is on the card). */
    this.ringOpen = 0;
    this.aboutTilt = { x: 0, y: 0, rest: 0 };
    /** The reader's hand on the coin on the card: its turn and spin, whether held, the pointer over it, a tap's ring. */
    this.coinHand = { angle: 0, spin: 0, held: false, over: false, u: .5, v: .5, hover: 0 };
  }

  get mounted() { return Boolean(this.renderer); }

  mount(canvas) {
    if (this.renderer) return true;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return false;
    }
    this.palette = brandPalette();
    this.renderer.setPixelRatio(DPR());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.coinScene = new THREE.Scene();
    this.workScene = new THREE.Scene();
    // Over everything: the rope as the scrollbar.
    this.uiScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 6000);
    this.solid = createSolidMaterial(this.palette);
    this.makeCoin();
    this.makeRow();
    this.warm(this.coinScene, this.coin);
    // The book, its covers plain.
    // The book: its covers the journal (written on, with stickers to peel), drawn again once its fonts and pictures are in.
    const onChange = () => { this.renderUntil = performance.now() + 100; };
    this.book = new Book(this.palette, { colours: coverColours(), art: makeJournalCovers(onChange), stickers: options => new Stickers({ ...options, list: JOURNAL.stickers }), onChange });
    this.workScene.add(this.book.group);
    this.ropebar = new RopeScrollbar(this);
    this.stopScheme = onSchemeChange(() => {
      this.palette = brandPalette();
      this.paint();
    });
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointermove', this.handlePointer, { passive: true });
    this.handleResize();
    if (this.work) this.setWork(this.work);
    if (this.about) this.setAbout(this.about);
    if (this.contact) this.setContact(this.contact);
    gsap.ticker.add(this.tick);
    return true;
  }

  unmount() {
    if (!this.renderer) return;
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointer);
    this.stopScheme();
    this.masks.forEach(mask => mask.dispose());
    this.masks.clear();
    this.dropSketch();
    this.coin.traverse(object => { object.geometry?.dispose(); });
    this.faces.forEach(face => face.material.dispose());
    this.asciiTextures?.forEach(texture => texture.dispose());
    this.row?.coins.forEach(coin => coin.faces.forEach(face => face.material.dispose()));
    this.row = null;
    this.solid.dispose();
    this.book.dispose();
    this.book = null;
    this.blank?.dispose();
    this.blank = null;
    this.ropebar.dispose();
    this.ring?.dispose();
    this.ring = null;
    this.ropebar = null;
    this.renderer.dispose();
    this.renderer = null;
    if (this.engaged) this.hero?.setDotHidden(false);
    this.engaged = false;
  }

  /** The hero scene whose dot this stage borrows. */
  attachHero(scene) {
    this.hero = scene;
    this.heroRest = false;
    if (this.coin) this.fitCoin(scene);
  }

  /** The wordmark's entrance has finished; the dot is on its stem and may leave. */
  heroAtRest() {
    this.heroRest = true;
    this.book?.load(() => { this.renderUntil = performance.now() + 100; });
  }

  /**
   * The journey, measured by components/journey:
   * `{ top, height, vh, seal?: { x, y }, projects, onPhase, onReveal, onTransition }`
   * — `top` and `height` in page px; `seal` (optional) is where the coin rests
   * in the work, in screen px while the scene is pinned; without one it stays
   * where it was, on the i.
   */
  setWork(work) {
    this.work = work;
    this.transitionKey = null;
    if (!this.renderer) return;
    COIN_SKILLS.forEach(skill => this.maskFor(skill));
    work.projects.forEach((project, i) => this.projectTools(i).forEach(tool => this.maskFor(tool)));
    this.book.setProjects(work.projects);
    if (this.heroRest) this.book.load(() => { this.renderUntil = performance.now() + 100; });
    const room = work.stage;
    // Its drawing code is compiled once, while nothing moves.
    if (!this.bookWarm) { this.warm(this.workScene, this.book.group); this.bookWarm = true; }
    this.renderUntil = performance.now() + 200;
  }

  /**
   * The about, measured by components/about:
   * `{ top, height, vh, card, line, bench, faces, steps, onTransition }` — `top` and `height` in page px; `card` and
   * `bench` the coin's places there and `line` the tower (`{ x, y, r, stops: [θ…], tower }`: where its box is, the
   * coin's radius on its road, the stops' angles round it, and its geometry, tower.js towerLayout), all in px on the
   * about's pinned screen; `faces` the tool of each stop up the tower, `steps` how many steps the process has.
   */
  setAbout(about) {
    this.about = about;
    this.aboutKey = null;
    if (!this.renderer || !about) return;
    // The ring of glass round it on the card (wide screens: on a narrow one the reviews run as a ticker, components/about).
    if (about.ring && !this.ring) {
      this.ring = new ReviewRing(this.coinScene, about.ring);
      this.ring.paint(this.palette);
      this.ring.setView(this.viewW ?? window.innerWidth, this.viewH ?? window.innerHeight);
    }
    // Its faces drawn now, while nothing moves (the portrait's engraving takes a moment).
    [MONOGRAM, ...about.faces].forEach(face => this.maskFor(face));
    this.renderUntil = performance.now() + 100;
  }

  /**
   * The project on show, from components/work: the coin turns to its tools and
   * the book brings its page round, always the way it was asked: 'next' and
   * 'prev' turn forward and back (from the last page forward on to the first
   * goes past the covers, never back through the book); 'jump' the shorter way.
   */
  setActive(index, how = 'jump') {
    if (index === this.active) return;
    const M = ringSize(this.work?.projects.length ?? 1);
    const from = this.leafMode === 'spin' && this.spin ? this.spin.to : this.leafTarget ?? Math.round(this.leaf.at);
    const ahead = mod(index + 1 - from, M), behind = mod(from - (index + 1), M);
    const step = how === 'next' ? ahead : how === 'prev' ? -behind : ahead <= behind ? ahead : -behind;
    this.active = index;
    this.leafTarget = from + step;
    this.spin = null;
    if (reducedMotion) {
      Object.assign(this.leaf, { at: this.leafTarget, velocity: 0 });
      this.leafMode = 'rest';
    } else {
      // By hand (a key, a button): the spring, from wherever it is and however fast it is going.
      this.leafMode = 'spring';
    }
    this.renderUntil = performance.now() + 100;
  }

  /** components/work: whether the book may turn on by itself. */
  setAutoplay(on) {
    this.autoplay = Boolean(on) && !reducedMotion;
    this.renderUntil = performance.now() + 100;
  }

  /** The next place after position `from` that shows a page, and how long the spin takes to get there. */
  nextStep(from) {
    const count = this.work?.projects.length ?? 1;
    const to = itemAt(from + 1, count).cover ? from + 2 : from + 1;
    return { from, to, clock: 0, duration: SPIN.period * (to - from > 1 ? SPIN.covers : 1) };
  }

  /* ----- the book in the hand ------------------------------------- */

  /** A page's height on screen: how far the hand moves to turn the book by one project. */
  get leafSpan() {
    return this.book.width / PAGE_ASPECT * 1.15;
  }

  /** The reader takes hold of the book: it stops where it is and follows the hand. */
  dragStart() {
    if (this.canHold()) {
      // The shut book: picked up where it is.
      this.holding = true;
      Object.assign(this.hold, { held: true, vYaw: 0, vTip: 0 });
      this.renderUntil = performance.now() + 100;
      return;
    }
    if (reducedMotion) return;
    this.spin = null;
    this.leafMode = 'drag';
    this.leaf.velocity = 0;
    this.renderUntil = performance.now() + 100;
  }

  /** The hand has moved `px` (down, or on a touch screen across, turns the pages toward the reader). */
  dragMove(px, dx = 0, dy = 0) {
    if (this.holding) {
      const hold = this.hold;
      hold.yaw += dx * HOLD.perPx;
      hold.tip = clamp(hold.tip + dy * HOLD.tipPerPx, -HOLD.tip, HOLD.tip);
      this.renderUntil = performance.now() + 100;
      return;
    }
    if (this.leafMode !== 'drag') return;
    this.leaf.at += px / this.leafSpan;
    this.renderUntil = performance.now() + 100;
  }

  /**
   * The reader lets go, the hand moving at `pxPerSecond`: it carries on,
   * slowing, and lands on the project it would have stopped nearest.
   */
  dragEnd(pxPerSecond, vx = 0, vy = 0) {
    if (this.holding) {
      // Let go: momentum decays without snapping away from the chosen view.
      this.holding = false;
      Object.assign(this.hold, {
        held: false,
        vYaw: clamp(vx * HOLD.perPx, -HOLD.fastest, HOLD.fastest),
        vTip: clamp(vy * HOLD.tipPerPx * .5, -4, 4),
      });
      this.renderUntil = performance.now() + 100;
      return;
    }
    if (this.leafMode !== 'drag') return;
    const velocity = pxPerSecond / this.leafSpan;
    this.leaf.velocity = velocity;
    // It lands on a page; never on the covers: on to the next page the way it was going.
    const count = this.work?.projects.length ?? 1;
    let target = landing(this.leaf.at, velocity);
    if (itemAt(target, count).cover) target += Math.sign(velocity) || (this.leaf.at >= target ? 1 : -1);
    this.leafTarget = target;
    this.leafMode = 'spring';
    const index = itemAt(target, count).project;
    if (index !== this.active) {
      this.active = index;
      this.onActive?.(index);
    }
    this.renderUntil = performance.now() + 100;
  }

  /**
   * The coin on the book, for this frame (the pose's stick and lift):
   *
   *   stick  from the middle of the screen onto its place on the cover as the
   *          book flies up, turning over as it goes to lie flat on it,
   *          monogram up, and taking the place's size;
   *   lie    flat on the cover, riding the book (out of sight when the cover
   *          turns away);
   *   lift   flicked off the cover (where the cover was when the book began
   *          to open), in an arc, flipping (LIFT.flips), to land face on in
   *          its seat among the tools.
   *
   * All of it is a function of the scroll, so it stops where the reader
   * stops, and plays backwards.
   */
  placeOnBook(dot, scroll) {
    this.coinSeated = false;
    const P = this.coverPose, pose = this.pose, coin = this.coin;
    const q = this._qc ??= new THREE.Quaternion(), qa = this._qa ??= new THREE.Quaternion(), qb = this._qb ??= new THREE.Quaternion();
    const v = this._vc ??= new THREE.Vector3(), axis = this._ac ??= new THREE.Vector3();
    const right = this._right ??= new THREE.Vector3(), basis = this._basis ??= new THREE.Matrix4();
    const flip = this._flipY ??= new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const faceZ = this.faces[0].position.z;
    // Lying flat on the cover, monogram up, the sticker's way up (its back face, the monogram, toward the cover's outside).
    const flat = (cover, out) => {
      right.crossVectors(cover.up, cover.normal).normalize();
      basis.makeBasis(right, cover.up, cover.normal);
      return out.setFromRotationMatrix(basis).multiply(flip);
    };
    // Lying on the cover: its pose, and its middle (its face just off the board).
    // On a sticker already over its seat it comes down on the sticker, a hair higher (Stickers coinOnTop). A sticker
    // pulled from under it makes it tremble; torn free, the coin jolts and rocks back into its seat.
    const stickers = this.book.stickers;
    const onSticker = stickers?.coinOnTop ? this.book.length * .004 : 0;
    const since = stickers ? (performance.now() - stickers.coinJolt) / 1000 : Infinity;
    // Breaking out: up off the cover, turning over once, and down into its seat again.
    const popping = !reducedMotion && this.escape?.free && since < ESCAPE.popTime;
    const popT = popping ? since / ESCAPE.popTime : 1;
    const popUp = popping ? ESCAPE.pop * Math.sin(Math.PI * popT) : 0;
    const popTurn = popping ? Math.PI * 2 * (popT * popT * (3 - 2 * popT)) : 0;
    // The landing after a pop (or a sticker torn from under it): it rocks to rest.
    const landed = popping ? -1 : since - (this.escape?.free ? ESCAPE.popTime : 0);
    const jolt = reducedMotion || landed < 0 || landed > 1.2 ? 0 : .22 * Math.exp(-landed * 5) * Math.sin(landed * 26);
    const tremble = reducedMotion || !stickers ? 0 : stickers.coinStrain * .035 * Math.sin(performance.now() * .09);
    // Trapped under the stickers, it fights them: sliding about in its seat, harder and harder (the stickers' bump
    // goes with it: coinSlide). It does not rock while they are over it: its edge would come up through them.
    const slide = this.coinSlide();
    const lying = (cover, outQ, outP) => {
      flat(cover, outQ);
      const rock = jolt + tremble;
      // Rocking about the line across it, its edge lifting and dropping.
      if (rock) outQ.premultiply(qa.setFromAxisAngle(cover.up, rock));
      if (popTurn) outQ.premultiply(qa.setFromAxisAngle(cover.up, popTurn));
      outP.copy(cover.centre).addScaledVector(cover.normal, cover.r * (faceZ + Math.abs(rock) * .5 + popUp) + onSticker);
      if (slide) outP.addScaledVector(cover.up, cover.r * slide);
    };
    const arc = (from, to, t, height, out) => out.lerpVectors(from, to, t).add(this._up.set(0, height * 4 * t * (1 - t), 0));
    this._up ??= new THREE.Vector3();
    const start = this._startP ??= new THREE.Vector3(), end = this._endP ??= new THREE.Vector3(), endQ = this._endQ ??= new THREE.Quaternion();
    // Where the cover is while the book is still shut, kept for the flick off it once the book starts to open
    // (the cover moves as it does). Arrived straight past that, the cover as it is now.
    const kept = this._keptCover ??= { centre: new THREE.Vector3(), normal: new THREE.Vector3(), up: new THREE.Vector3(), r: 1, set: false };
    // (Trapped under the stickers, it is still on the cover as it turns: kept until it breaks out.)
    if (this.k < OPEN.at || (this.openDrawn ?? 0) < .02 || !kept.set || (this.escape?.trapped && !this.escape.free)) {
      kept.centre.copy(P.centre); kept.normal.copy(P.normal); kept.up.copy(P.up); kept.r = P.r; kept.set = true;
    }
    if (pose.stick < 1) {
      // Sticking: from the middle of the screen, face on, onto its place on the cover (which is still flying
      // up, so the coin meets it rather than jumping to it), turning over to lie on it monogram up.
      const e = smootherStep(pose.stick);
      lying(P, endQ, end);
      start.set(dot.x, -dot.y, 0);
      coin.position.lerpVectors(start, end, e);
      coin.quaternion.identity().slerp(endQ, reducedMotion ? 1 : e);
      coin.scale.setScalar(dot.r + (P.r - dot.r) * e);
      coin.visible = true;
      return;
    }
    const liftNow = this.liftNow();
    if (liftNow <= 0) {
      // Lying on the cover, riding the book.
      lying(P, coin.quaternion, coin.position);
      // Bursting out it comes up toward the reader, bigger at the top of its jump.
      coin.scale.setScalar(P.r * (1 + ESCAPE.grow * popUp / ESCAPE.pop));
      // Seen however the book is turned, edge on too: drawn against the book's depth (render), so the book itself
      // hides it only where the book is really in front of it.
      coin.visible = true;
      this.coinSeated = true;
      return;
    }
    // The flick: off the cover (where it was when the book began to open), flipping, to its seat, face on.
    const t = liftNow, e = smootherStep(t);
    // Onto the rope, right where it will stand on it (with no rope, its seat among the tools).
    const seat = this.work.rope ? this.ropeSeat() : this.work.tools?.[0] ?? { x: dot.x, y: dot.y, r: dot.r };
    flat(kept, q);
    start.copy(kept.centre).addScaledVector(kept.normal, faceZ * kept.r);
    end.set(seat.x, -(seat.y + this.pinOffset(scroll)), 0);
    arc(start, end, t, reducedMotion ? 0 : LIFT.height, coin.position);
    axis.subVectors(end, start).cross(v.set(0, 0, 1)).normalize();
    q.slerp(qb.identity(), e);
    qa.setFromAxisAngle(axis, reducedMotion ? 0 : Math.PI * 2 * LIFT.flips * e);
    coin.quaternion.copy(q.premultiply(qa));
    coin.scale.setScalar(kept.r + (seat.r - kept.r) * e);
    coin.visible = true;
  }

  /** How far the coin trapped under the stickers has slid in its seat as it fights them (of its radius, along the cover's up). */
  coinSlide() {
    const fight = reducedMotion ? 0 : this.struggle ?? 0;
    return fight * ESCAPE.slide * Math.sin(performance.now() * .083);
  }

  /** How far the coin has been flicked off the cover: the pose's lift (the way, gated by the book: gateK). */
  liftNow() {
    return this.pose.lift;
  }

  /**
   * Whether the shut book has a reason to stay shut past where it would open:
   * the coin trapped under the stickers fighting its way out, the stickers
   * flying home and the reader given a moment to see them land (ESCAPE
   * settle), or the book left turned away, turning back to face the reader.
   * (On the very frame the scroll reaches the book, before the escape has
   * begun, the stickers over the coin are asked directly, so it never starts
   * to open first.)
   */
  holdingShut() {
    if (this.kRaw <= OPEN.at) return false;
    const escape = this.escape;
    if (escape ? escape.trapped && !escape.done : this.k <= OPEN.at + 1e-6 && this.pose?.onBook && this.book?.stickers?.coinTrapped()) return true;
    return (this.openDrawn ?? 0) < .02 && !this.bookFacing();
  }

  /**
   * The way (k) the book and everything after it follow, from the scroll's
   * (kRaw). Up to the shut book they are the same. While it is held shut
   * (holdingShut) it stays at the book, however far the reader scrolls. Once
   * free, it does not jump on to where the scroll has got to: it opens only as
   * the reader scrolls on, over whatever scroll is left (or, with none left,
   * by itself after a breath, GATE). Scrolled back up a little meanwhile, it
   * waits there, shut, for them to come on again.
   */
  gateK(kRaw, dt) {
    if (kRaw <= OPEN.at || reducedMotion) { this.gate = null; return kRaw; }
    if (this.holdingShut()) { this.gate = { from: kRaw, wait: 0, auto: 0 }; return OPEN.at; }
    const gate = this.gate;
    if (!gate) return kRaw;
    gate.from = Math.max(OPEN.at, Math.min(gate.from, kRaw));
    const room = K_END - gate.from;
    if (room > GATE.room) return Math.min(K_END, OPEN.at + (kRaw - gate.from) / room * (K_END - OPEN.at));
    gate.wait += dt;
    if (gate.wait < GATE.wait) return OPEN.at;
    gate.auto = Math.min(1, gate.auto + dt / GATE.open);
    return OPEN.at + smootherStep(gate.auto) * (K_END - OPEN.at);
  }

  /**
   * As the book starts to open and the coin is flicked off it: if it is
   * trapped under a sticker on the cover, it struggles (`struggle`,
   * 0 → 1, read by placeOnBook) for ESCAPE.struggle, then breaks out, the
   * stickers thrown off it, and lands back in its seat; once the stickers are
   * home and have been seen to land (ESCAPE.settle) it is `done`, and the book
   * may open (gateK). Scrolled back up before the book, it all settles.
   */
  stepEscape() {
    const stickers = this.book?.stickers;
    if (!stickers || this.kRaw <= OPEN.at) { this.escape = null; this.struggle = 0; if (stickers) stickers.heave = 0; return; }
    const now = performance.now();
    // Met on the way past the shut book (not once it has started to open).
    this.escape ??= { trapped: this.k <= OPEN.at + 1e-6 && this.pose.onBook && stickers.coinTrapped(), free: false, since: now, freeAt: 0, done: false };
    const escape = this.escape;
    if (escape.free && !escape.done && !stickers.flying && now - escape.freeAt > (ESCAPE.popTime + ESCAPE.settle) * 1000) escape.done = true;
    if (!escape.trapped || escape.free) { this.struggle = 0; return; }
    const held = (now - escape.since) / 1000 / ESCAPE.struggle;
    this.struggle = clamp(held, 0, 1);
    // The stickers heave over it, harder as it fights.
    stickers.heave = this.struggle ** 1.5;
    // Out: when it has fought long enough (however far the reader has scrolled: the book waits for it).
    if (held >= 1 || reducedMotion) {
      escape.free = true;
      escape.freeAt = now;
      this.struggle = 0;
      stickers.heave = 0;
      stickers.coinJolt = now;
      stickers.scatter();
    }
  }

  /** Whether the coin is on the rope in the copy: the rope there, and the coin landed on it. */
  balancing() {
    // (Not once it has begun to jump off the rope, nor once it is in the about.)
    return Boolean(this.work?.rope && this.k >= 2 && this.tightrope > .5 && !this.pose.onBook && this.liftNow() >= 1 && this.aboutEnter <= 0 && this.hop.phase === 'rope');
  }

  /**
   * The tightrope across the copy on the pinned screen (px, without the pin):
   * its two ends (the posts) and the line it is tied along, risen with the copy
   * as that comes in (COPY_RISE), so the rope and the copy are never apart.
   * Null with no rope in the copy.
   */
  ropeLine() {
    const rope = this.ropeAt;
    if (!rope || !this.work?.rope) return null;
    const rise = reducedMotion ? 0 : (1 - (this.shown?.names ?? 1)) * COPY_RISE;
    return { x0: rope.x0, x1: rope.x1, y: rope.y + rise };
  }

  /**
   * The rope's lane, eased: when another project comes round and its copy is
   * laid out longer or shorter, the rope glides to its new place (the coin on
   * it riding it there) rather than jumping. Returns whether it is moving.
   */
  stepRopeLine(dt) {
    const rope = this.work?.rope;
    if (!rope) { this.ropeAt = null; return false; }
    const at = this.ropeAt ??= { ...rope };
    const keys = ['x0', 'x1', 'y'];
    if (reducedMotion || !this.engaged || this.tightrope <= 0) { keys.forEach(key => { at[key] = rope[key]; }); return false; }
    const ease = 1 - Math.exp(-dt * 9);
    let moving = false;
    for (const key of keys) {
      at[key] += (rope[key] - at[key]) * ease;
      if (Math.abs(rope[key] - at[key]) < .05) at[key] = rope[key]; else moving = true;
    }
    return moving;
  }

  /** How far the rope hangs below its line at `s` along it (0 → 1, px): ropeDissolve's ROPE_SAG. */
  sagAt(s) {
    const { dip, droop } = this.walk, c = clamp(this.walk.c, .02, .98);
    return dip * Math.min(s / c, (1 - s) / (1 - c)) + droop * 4 * s * (1 - s);
  }

  /** Where along the rope (0 → 1) the tag of the `i`th of `count` tools hangs: evenly, clear of the posts (Work.css .work__tool). */
  station(i, count) {
    return TIGHTROPE.inset + (1 - 2 * TIGHTROPE.inset) * (mod(i, count) + .5) / count;
  }

  /** The coin standing on the rope at the first tool's tag, as it is now (px, without the pin): where it lands. */
  ropeSeat() {
    const line = this.ropeLine(), r = this.work.tools?.[0]?.r ?? this.dot.r;
    const s = this.station(0, this.coinTools().length);
    return { x: line.x0 + s * (line.x1 - line.x0), y: line.y + this.sagAt(s) - ROPE_HALF - r, r };
  }

  /**
   * The coin on the rope, this frame. It lands right where it was flicked to
   * (ropeSeat), its weight driving the rope down, which gives and springs back
   * (TIGHTROPE give) with the coin riding it; then it walks the rope, from tag
   * to tag (walkTarget), leaning into each walk and bouncing the rope with each
   * step, and as it stands it leans one way and the other about its foot,
   * edging to keep its balance, never quite still, as a thing on a tightrope
   * does. The rope (RopeScrollbar placeLine) and the tags (components/work)
   * sag with it.
   */
  balance(dt, scroll) {
    const walk = this.walk, count = this.coinTools().length;
    const target = this.walkTarget(count);
    const landing = !this.balanceIn;
    this.balanceIn = Math.min(1, (this.balanceIn ?? 0) + dt * 1.5);
    if (landing) Object.assign(walk, { c: target, v: 0, dip: 0, dipV: reducedMotion ? 0 : TIGHTROPE.landing, n: this.cycle?.n ?? 0 });
    if (reducedMotion) Object.assign(walk, { c: target, v: 0, dip: TIGHTROPE.weight, dipV: 0 });
    else {
      // Each new step it takes on the rope bounces it again.
      if ((this.cycle?.n ?? 0) !== walk.n) { walk.n = this.cycle?.n ?? 0; walk.dipV += TIGHTROPE.step; }
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      const [wf, zf] = TIGHTROPE.follow, [wg, zg] = TIGHTROPE.give;
      for (let i = 0; i < steps; i++) {
        walk.v += (wf * wf * (target - walk.c) - 2 * zf * wf * walk.v) * h;
        walk.c += walk.v * h;
        walk.dipV += (wg * wg * (TIGHTROPE.weight - walk.dip) - 2 * zg * wg * walk.dipV) * h;
        walk.dip += walk.dipV * h;
      }
    }
    const line = this.ropeLine(), span = line.x1 - line.x0;
    const r = this.dot.r, coin = this.coin;
    const t = performance.now() / 1000 * TIGHTROPE.wobble, amount = reducedMotion ? 0 : smootherStep(this.balanceIn);
    // Into its walk (its speed in px/s), and about its balance as it goes.
    const into = clamp(walk.v * span * TIGHTROPE.into, -TIGHTROPE.intoMost, TIGHTROPE.intoMost);
    const lean = amount * (TIGHTROPE.lean * (Math.sin(t) * .65 + Math.sin(t * 2.37 + 1.3) * .35) - into);
    // Edging the way it leans, to catch itself.
    const s = clamp(walk.c + amount * TIGHTROPE.edge * r / span * Math.sin(t * .5 + .4), 0, 1);
    // About the point it stands on: its foot on the rope (where the rope is, sagging under it), its middle over it.
    const footX = line.x0 + s * span, footY = -(line.y + this.sagAt(s) - ROPE_HALF + this.pinOffset(scroll));
    coin.position.set(footX - Math.sin(lean) * r, footY + Math.cos(lean) * r, coin.position.z);
    coin.quaternion.setFromAxisAngle(this._zAxis ??= new THREE.Vector3(0, 0, 1), lean);
  }

  /**
   * Where along the rope the coin is making for (0 → 1): standing at its
   * tool's tag, or on its way to the next one's (the cycle, set by tick: the
   * step it is on, and how far through the walk to the next).
   */
  walkTarget(count) {
    const cycle = this.cycle;
    if (!cycle || count < 2) return this.station(0, count);
    const from = this.station(pace(cycle.n, count), count), to = this.station(pace(cycle.n + 1, count), count);
    return from + (to - from) * (cycle.f ?? 0);
  }

  /** Off the rope: it stands empty, sagging by itself; the coin lands at the first tag. */
  restRope() {
    const walk = this.walk, c = this.station(0, this.coinTools().length);
    if (walk.dip === 0 && walk.c === c && walk.dipV === 0) return false;
    Object.assign(walk, { c, v: 0, dip: 0, dipV: 0 });
    return true;
  }

  /** Tell components/work how the rope hangs (stage.onRope: where the coin stands on it, how far it gives, how far it sags), when that changes. */
  reportRope() {
    const { c, dip, droop } = this.walk;
    const key = `${c.toFixed(4)}|${dip.toFixed(2)}|${droop}`;
    if (key === this.ropeReported) return;
    this.ropeReported = key;
    this.onRope?.(c, dip, droop);
  }

  /** Whether the book is standing shut in view, to be picked up and turned (not yet opened by the scroll). */
  /** The pointer moved: the light it holds moves with it, and the covers and stickers catch it. */
  handlePointer(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    if (this.book?.group.visible) this.renderUntil = performance.now() + 60;
  }

  /* ----- the stickers ----------------------------------------------- */

  /** The camera's ray through the screen point (x, y), px. */
  rayAt(x, y) {
    const ndc = this._ndc ??= new THREE.Vector2();
    ndc.set(x / this.viewW * 2 - 1, -(y / this.viewH) * 2 + 1);
    this._raycaster ??= new THREE.Raycaster();
    this._raycaster.setFromCamera(ndc, this.camera);
    return this._raycaster.ray;
  }

  /** Whether the stickers can be handled: the book has flown in and its covers are the outside of it. */
  stickersLive() {
    return Boolean(this.engaged && this.book?.group.visible && this.k >= .98 && (this.openDrawn ?? 0) < .5);
  }

  /** The pointer at (x, y) over the book, or gone (null): a sticker under it lifts a corner. Returns whether one is. */
  stickerHover(x, y) {
    if (!this.stickersLive() || x == null) { this.book?.stickers.hover(null); return false; }
    this.book.group.updateMatrixWorld(true);
    return this.book.stickers.hover(this.rayAt(x, y), this.camera);
  }

  /** The link written on the book at (x, y) on the screen ('email'), if there is one and no sticker is over it; else null. */
  linkAt(x, y) {
    if (!this.stickersLive()) return null;
    this.book.group.updateMatrixWorld(true);
    const at = this.book.stickers.coverAt(this.rayAt(x, y), this.camera);
    if (!at || at.sticker) return null;
    return LINKS[at.side].find(box => at.u >= box.u0 && at.u <= box.u1 && at.v >= box.v0 && at.v <= box.v1)?.link ?? null;
  }

  /** Whether a sticker is at (x, y) on the screen, to be taken hold of (nothing is changed by asking). */
  stickerAt(x, y) {
    if (!this.stickersLive()) return false;
    this.book.group.updateMatrixWorld(true);
    return Boolean(this.book.stickers.pick(this.rayAt(x, y), this.camera));
  }

  /** The reader presses at (x, y): if on a sticker, it peels off into their hand. Returns whether it did. */
  stickerDown(x, y) {
    if (!this.stickersLive()) return false;
    this.book.group.updateMatrixWorld(true);
    return this.book.stickers.grab(this.rayAt(x, y), this.camera);
  }

  stickerMove(x, y) {
    this.book.group.updateMatrixWorld(true);
    this.book.stickers.move(this.rayAt(x, y));
  }

  stickerUp() {
    this.book?.stickers.release();
  }

  canHold() {
    return Boolean(this.engaged && this.k >= .98 && (this.openDrawn ?? 0) < .02);
  }

  /** The shut book in the hand: free rotation with damped momentum. */
  stepHold(dt) {
    const hold = this.hold;
    // Where the scroll was when it was last looked at: the reader scrolling on is a sign to straighten it.
    // (The scroll's own way: the book's waits for it to face the reader.)
    const scrolled = hold.kAt != null && Math.abs(this.kRaw - hold.kAt) > 1e-3;
    hold.kAt = this.kRaw;
    if (hold.held) { hold.idle = 0; hold.facing = false; return true; }
    hold.idle = (hold.idle ?? 0) + dt;
    // Left turned away (let alone a while, or the reader scrolling on): it turns back to face the reader, front
    // cover on, the nearest way round, so the coin on it is seen and the book opens toward them.
    if (scrolled || hold.idle > HOLD.idle) hold.facing = true;
    if (hold.facing) {
      const yaw = HOLD.rest.yaw + TAU * Math.round((hold.yaw - HOLD.rest.yaw) / TAU);
      if (reducedMotion) Object.assign(hold, { yaw, tip: HOLD.rest.tip, vYaw: 0, vTip: 0 });
      const [w, z] = HOLD.face, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        hold.vYaw += (w * w * (yaw - hold.yaw) - 2 * z * w * hold.vYaw) * h;
        hold.vTip += (w * w * (HOLD.rest.tip - hold.tip) - 2 * z * w * hold.vTip) * h;
        hold.yaw += hold.vYaw * h;
        hold.tip += hold.vTip * h;
      }
      if (Math.abs(yaw - hold.yaw) + Math.abs(HOLD.rest.tip - hold.tip) < 1e-4 && Math.abs(hold.vYaw) + Math.abs(hold.vTip) < 1e-3) {
        Object.assign(hold, { yaw, tip: HOLD.rest.tip, vYaw: 0, vTip: 0 });
        return false;
      }
      return true;
    }
    // Free inspection: keep the released angle, with frame-rate independent inertia.
    const decay = Math.exp(-HOLD.friction * dt);
    const travel = (1 - decay) / HOLD.friction;
    hold.yaw += hold.vYaw * travel;
    hold.tip = clamp(hold.tip + hold.vTip * travel, -HOLD.tip, HOLD.tip);
    hold.vYaw *= decay;
    hold.vTip *= decay;
    if (Math.abs(hold.vYaw) + Math.abs(hold.vTip) < .001) hold.vYaw = hold.vTip = 0;
    // Still, but turned away: it keeps drawing, to count down to turning back.
    return true;
  }

  /** Whether the shut book faces the reader (front cover on, level, to within HOLD.square), so it may open. */
  bookFacing() {
    const hold = this.hold;
    const turn = Math.abs(Math.atan2(Math.sin(hold.yaw - HOLD.rest.yaw), Math.cos(hold.yaw - HOLD.rest.yaw)));
    return !hold.held && turn < HOLD.square && Math.abs(hold.tip - HOLD.rest.tip) < HOLD.square;
  }

  /** The pointer is at `x`, `y` over the work (-1 → 1 each way, 0 in the middle, y down; null when it leaves): the book leans toward it. */
  leanTo(x, y) {
    this.lean.toX = x ?? 0;
    this.lean.toY = y ?? 0;
    this.renderUntil = performance.now() + 100;
  }

  /** Move the book on by `dt`: the hand, the spring, or its own spin. Returns whether it moved. */
  stepLeaf(dt) {
    const leaf = this.leaf;
    // On its own: from rest, a step at a time, round and round.
    if (this.autoplay && this.leafMode === 'rest') {
      this.spin = this.nextStep(Math.round(leaf.at));
      this.leafMode = 'spin';
    }
    if (this.leafMode === 'spin') {
      let spin = this.spin;
      if (!this.autoplay) {
        // Stopped (the reader has it): it lands where it was going, or back on the page it was leaving, by the spring.
        const x = spin.clock / spin.duration;
        this.leafTarget = x < .15 ? spin.from : spin.to;
        this.leafMode = 'spring';
        this.spin = null;
        const item = itemAt(this.leafTarget, this.work?.projects.length ?? 1);
        if (!item.cover && item.project !== this.active) {
          this.active = item.project;
          this.onActive?.(item.project);
        }
      } else {
        spin.clock += dt;
        while (spin.clock >= spin.duration) {
          const over = spin.clock - spin.duration;
          spin = this.spin = this.nextStep(spin.to);
          spin.clock = over;
        }
        const x = spin.clock / spin.duration;
        leaf.at = spin.from + (spin.to - spin.from) * spinEase(x);
        leaf.velocity = (spin.to - spin.from) * spinSpeed(x) / spin.duration;
      }
    }
    if (this.leafMode === 'spring' && stepSpring(leaf, this.leafTarget, dt)) this.leafMode = 'rest';
    // The project on show follows the page nearest its place (the covers show none).
    if (this.leafMode === 'spin' || this.leafMode === 'drag') {
      const item = itemAt(leaf.at, this.work?.projects.length ?? 1);
      if (!item.cover && item.project !== this.active) {
        this.active = item.project;
        this.onActive?.(item.project);
      }
    }
    const lean = this.lean, ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    const leanWas = lean.x + lean.y;
    lean.x += (lean.toX - lean.x) * ease;
    lean.y += (lean.toY - lean.y) * ease;
    const leaning = Math.abs(lean.x + lean.y - leanWas) > 1e-5;
    return this.leafMode !== 'rest' || leaning;
  }

  /** The reader is over the lamp (`on`): it opens a little wider and glows brighter; off, it settles back. */
  setLit(on) {
    gsap.killTweensOf(this.lit);
    if (reducedMotion) this.lit.amount = on ? 1 : 0;
    else gsap.to(this.lit, { amount: on ? 1 : 0, duration: on ? LIT.on : LIT.off, ease: on ? 'power3.out' : 'power2.inOut' });
    this.renderUntil = performance.now() + 100;
  }

  handleResize() {
    // The full screen's height, which never moves with a phone's address bar (lib/viewport): nothing stretches as it comes and goes.
    const width = window.innerWidth, height = viewHeight();
    if (this.suspended) { this.viewW = null; return; }
    if (width === this.viewW && height === this.viewH && DPR() === this.renderer.getPixelRatio()) return;
    this.viewW = width;
    this.viewH = height;
    this.renderer.setPixelRatio(DPR());
    this.renderer.setSize(width, height, false);
    // The camera sits so that the plane z = 0 is the screen, a pixel a unit.
    const distance = (height / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.distance = distance;
    this.camera.aspect = width / height;
    this.camera.far = distance + 5000;
    // Nothing comes nearer than a third of the way: the depth buffer's precision is spent on the book, whose
    // sheets lie a fraction of a pixel apart.
    this.camera.near = distance * .3;
    this.camera.position.set(width / 2, -height / 2, distance);
    this.camera.lookAt(width / 2, -height / 2, 0);
    this.ring?.setView(width, height);
    this.camera.updateProjectionMatrix();
    this.home = null;
    this.renderUntil = performance.now() + 100;
  }

  paint() {
    paintSolid(this.solid, this.palette);
    this.faces.forEach(face => {
      paintSolid(face.material, this.palette);
      const u = face.material.uniforms, dark = isDark(this.palette.figure);
      u.uOnDark.value = dark ? 1 : 0;
      u.uAsciiInk.value.set(dark ? '#c9a15a' : '#25202a');
      u.uAsciiHot.value.set(dark ? '#f0c9d4' : '#87475a');
    });
    this.row?.coins.forEach(coin => coin.faces.forEach(face => paintSolid(face.material, this.palette)));
    this.book?.paint(this.palette);
    this.ring?.paint(this.palette);
    if (this.sketch) Object.values(this.sketch).forEach(lines => lines.material.color.set(this.palette.ink));
    this.renderUntil = performance.now() + 100;
  }

  /* ----- the coin ---------------------------------------------------- */

  makeCoin() {
    // Built at radius 1 and scaled: a bevelled disc, the dot of the i.
    const circle = new THREE.Shape();
    circle.absarc(0, 0, 1, 0, Math.PI * 2, false);
    const body = new THREE.ExtrudeGeometry(circle, {
      depth: .14, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 128,
    });
    body.translate(0, 0, -.07);
    // coin (place, and stretch along its way) → aligner (turned back, so the stretch never turns the mark) → spinner (its flips).
    this.coin = new THREE.Group();
    this.aligner = new THREE.Group();
    this.spinner = new THREE.Group();
    this.coin.add(this.aligner);
    this.aligner.add(this.spinner);
    this.coinBody = new THREE.Mesh(body, this.solid);
    this.spinner.add(this.coinBody);
    // The ASCII portrait's sources: the characters, and the portrait's light (drawn again once the photo is in).
    const glyphs = new THREE.CanvasTexture(asciiAtlas());
    const redraw = texture => () => { texture.needsUpdate = true; this.renderUntil = performance.now() + 100; };
    const field = new THREE.CanvasTexture(portraitField());
    portraitField(redraw(field));
    const photo = new THREE.CanvasTexture(portraitPhoto());
    photo.colorSpace = THREE.SRGBColorSpace;
    portraitPhoto(redraw(photo));
    this.asciiTextures = [glyphs, field, photo];
    this.faces = [0, 1].map(side => {
      const material = new THREE.ShaderMaterial({
        vertexShader: LIT_VERTEX,
        fragmentShader: FACE_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color() },
          uShade: { value: new THREE.Color() },
          uHighlight: { value: new THREE.Color() },
          uMark: { value: new THREE.Color() },
          uRoughness: { value: .48 },
          uMarkOpacity: { value: 0 },
          uMask: { value: this.blankMask() },
          uMode: { value: 0 }, uOnDark: { value: 0 }, uCells: { value: 42 }, uHover: { value: 0 }, uTime: { value: 0 },
          uNear: { value: .2 }, uPointer: { value: new THREE.Vector2(.5, .5) },
          uField: { value: field }, uGlyphs: { value: glyphs }, uPhoto: { value: photo },
          uAsciiInk: { value: new THREE.Color() }, uAsciiHot: { value: new THREE.Color() },
        },
      });
      // Clear of the cap and bevel (±.12), and drawn in front of them whatever the
      // depth buffer's precision: the mark never flickers against the coin.
      material.polygonOffset = true;
      material.polygonOffsetFactor = -4;
      material.polygonOffsetUnits = -4;
      const face = new THREE.Mesh(new THREE.CircleGeometry(.97, 128), material);
      face.position.z = side === 0 ? .145 : -.145;
      face.renderOrder = 1;
      if (side === 1) face.rotation.y = Math.PI;
      this.spinner.add(face);
      return face;
    });
    this.coin.visible = false;
    this.coinScene.add(this.coin);
    this.fitCoin(this.hero);
    this.paint();
  }

  /**
   * The coin is the i's dot itself: the same disc, bevel and thickness, scaled
   * so its outer edge is radius 1 (the radius the hero measures in dotPoint),
   * with the marks the same small step proud of it. Otherwise the dot visibly
   * swells and changes shape the moment the stage takes it over.
   */
  fitCoin(scene) {
    const dot = scene?.dot?.geometry;
    if (!dot) return;
    dot.computeBoundingBox();
    const box = dot.boundingBox;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = (box.max.x - box.min.x) / 2;
    this.coinBody.geometry.dispose();
    this.coinBody.geometry = dot.clone().translate(-centre.x, -centre.y, -centre.z).scale(1 / radius, 1 / radius, 1 / radius);
    const z = ((box.max.z - box.min.z) / 2 + .04) / radius;
    this.faces.forEach((face, side) => { face.position.z = side ? -z : z; });
    this.syncRow();
    // The drawings of it (the about's bench) are of the old shape: drawn again when next asked for.
    this.dropSketch();
  }

  /**
   * The coin as a drawing, for the about's bench (aboutTransition SKETCH): its
   * outline (the edges of its rim and bevel, as it would be sketched) and its
   * wireframe (every edge of the mesh, as it is modelled), in ink, round the
   * same shape, turning with it. Made the first time they are asked for.
   */
  makeSketch() {
    if (this.sketch) return;
    const geometry = this.coinBody.geometry;
    const ink = opacity => new THREE.LineBasicMaterial({ color: this.palette.ink, transparent: true, opacity, depthWrite: false });
    this.sketch = {
      outline: new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), ink(.95)),
      wire: new THREE.LineSegments(new THREE.WireframeGeometry(geometry), ink(.3)),
    };
    Object.values(this.sketch).forEach(lines => { lines.visible = false; this.spinner.add(lines); });
  }

  dropSketch() {
    if (!this.sketch) return;
    Object.values(this.sketch).forEach(lines => { lines.removeFromParent(); lines.geometry.dispose(); lines.material.dispose(); });
    this.sketch = null;
  }

  /**
   * What the coin is (aboutTransition SKETCH): its outline, its wireframe, or
   * (anything else, or null) the solid coin with its faces. Changed only while
   * it is edge on, as a face's mark is, so the change is never seen.
   */
  showSketch(kind) {
    const drawn = kind === SKETCH.outline || kind === SKETCH.wire;
    if (drawn) this.makeSketch();
    this.coinBody.visible = !drawn;
    this.faces.forEach(face => { face.visible = !drawn; });
    if (!this.sketch) return;
    this.sketch.outline.visible = kind === SKETCH.outline;
    this.sketch.wire.visible = kind === SKETCH.wire;
  }

  /**
   * The rest of the row of tools: copies of the coin (the same body and
   * material; faces of their own, for their own marks). The coin from the i
   * is the first of the row; these come out from behind it.
   */
  makeRow() {
    this.row = { coins: [], tools: null, wave: null };
    for (let i = 1; i < ROW_MAX; i++) {
      const group = new THREE.Group(), spinner = new THREE.Group();
      group.add(spinner);
      const body = new THREE.Mesh(this.coinBody.geometry, this.solid);
      spinner.add(body);
      const faces = this.faces.map(face => {
        const copy = new THREE.Mesh(face.geometry, face.material.clone());
        copy.position.copy(face.position);
        copy.rotation.copy(face.rotation);
        copy.renderOrder = face.renderOrder;
        spinner.add(copy);
        return copy;
      });
      faces.forEach(face => { face.material.uniforms.uMarkOpacity.value = 1; });
      group.visible = false;
      this.coinScene.add(group);
      this.row.coins.push({ group, spinner, body, faces });
    }
  }

  /** The copies take the coin's shape whenever it is fitted to the hero's dot. */
  syncRow() {
    this.row?.coins.forEach(coin => {
      coin.body.geometry = this.coinBody.geometry;
      coin.faces.forEach((face, side) => { face.position.z = this.faces[side].position.z; });
    });
  }

  /**
   * The row for this frame: for each coin (0 is the one from the i), its
   * place, radius, size (0 → 1), the tool in front and the tool on its back,
   * and how far it has turned over (0 → π). The row comes out of the first
   * coin with the scroll (splitAt); when the reader moves to another project
   * the coins turn over one after another to its tools, going to its places,
   * coins coming in or going as the number of tools changes. Returns whether
   * it is still turning.
   */
  stepRow(dt) {
    const row = this.row, k = this.k;
    // The book has moved on but the copy has not been laid out for it yet: the row holds as it was until it has.
    if (this.rowState && this.active >= 0 && this.work?.toolsFor !== this.active) return true;
    const tools = this.coinTools();
    const slots = this.work?.tools ?? [];
    const first = slots[0] ?? { x: this.dot.x, y: this.dot.y, r: this.dot.r };
    const same = row.tools && row.tools.length === tools.length && row.tools.every((tool, i) => tool === tools[i]);
    if (!same) {
      // Before the row is out (or with reduced motion) it takes the new tools as they are; after, it turns over to them.
      if (!row.tools || k < ROW.split.start || reducedMotion) { row.tools = tools; row.wave = null; }
      else if (!row.wave) row.wave = { from: row.tools, to: tools, t: 0 };
    }
    let wave = row.wave;
    if (wave) {
      wave.t += dt;
      const n = Math.max(wave.from.length, wave.to.length);
      if (wave.t >= WAVE.turn + WAVE.stagger * (n - 1)) { row.tools = wave.to; row.wave = wave = null; }
    }
    const mix = (a, b, t) => a + (b - a) * t;
    const out = [];
    for (let i = 0; i < ROW_MAX; i++) {
      if (wave) {
        const s = smootherStep(clamp((wave.t - WAVE.stagger * i) / WAVE.turn, 0, 1));
        const coming = i >= wave.from.length, going = i >= wave.to.length;
        if (coming && going) { out.push(null); continue; }
        // In the new project's row, as its copy lays it out (the row moves with the copy, never across it); a
        // coin going carries on past the end of the new row, spaced as it is.
        const last = slots[slots.length - 1] ?? first, prev = slots[slots.length - 2] ?? last;
        const step = slots.length > 1 ? last.x - prev.x : first.r * 2.6;
        const at = slots[i] ?? { x: last.x + step * (i - slots.length + 1), y: last.y, r: last.r };
        out.push({
          x: at.x, y: at.y, r: at.r,
          size: coming ? s : going ? 1 - s : 1,
          front: wave.from[i] ?? wave.to[i], back: wave.to[i] ?? wave.from[i], turn: Math.PI * s,
        });
      } else {
        if (i >= row.tools.length) { out.push(null); continue; }
        const slot = slots[i] ?? first;
        const e = i === 0 ? 1 : splitAt(k, i);
        out.push({ x: mix(first.x, slot.x, e), y: mix(first.y, slot.y, e), r: mix(first.r, slot.r, e), size: e > .001 ? 1 : 0,
          front: row.tools[i], back: row.tools[i], turn: 0 });
      }
    }
    this.rowState = out;
    return Boolean(wave);
  }

  /** A face (its mesh) showing `tool`'s mark, or Saad's face (PORTRAIT in ASCII, MESH in polygons), or (SKETCH, none) nothing. */
  paintFace(face, tool) {
    const u = face.material.uniforms, mode = tool === PORTRAIT ? 1 : tool === MESH ? 2 : 0;
    u.uMode.value = mode;
    u.uMask.value = mode || !tool || Object.values(SKETCH).includes(tool) ? this.blankMask() : this.maskFor(tool);
  }

  blankMask() {
    if (!this.blank) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      this.blank = new THREE.CanvasTexture(canvas);
    }
    return this.blank;
  }

  /**
   * The tool's face: its official mark in its own colours (coinMarks.js, the same
   * drawing the hero's coin uses), in the version made for this coin's ground.
   */
  maskFor(tool) {
    const dark = isDark(this.palette.figure);
    const key = `${tool}|${dark}`;
    if (this.masks.has(key)) return this.masks.get(key);
    const texture = new THREE.CanvasTexture(markCanvas(tool, dark));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.masks.set(key, texture);
    markCanvas(tool, dark, () => {
      texture.needsUpdate = true;
      this.renderUntil = performance.now() + 100;
    });
    return texture;
  }

  /** What the coin turns through in the work: the project on show's tools, or with none, the skills. */
  coinTools() {
    return this.active >= 0 ? this.projectTools(this.active) : COIN_SKILLS;
  }

  /** The tools of project `i` the coin has a face for, in the project's order. */
  projectTools(i) {
    const tools = (this.work?.projects[i]?.tools ?? []).filter(hasMark);
    return tools.length ? tools : ['Custom code'];
  }

  /**
   * Compile an object's drawing code now, while nothing is moving, instead of
   * on the first frame it is shown (which would stall that frame, mid-scroll).
   */
  warm(scene, object, renderer = this.renderer, camera = this.camera) {
    if (!renderer || !object) return;
    const was = object.visible;
    object.visible = true;
    const parents = [];
    for (let p = object.parent; p; p = p.parent) { parents.push([p, p.visible]); p.visible = true; }
    try { renderer.compile(scene, camera); } catch { /* compiled on first draw instead */ }
    parents.forEach(([p, v]) => { p.visible = v; });
    object.visible = was;
  }

  /* ----- the journey against the scroll ------------------------------ */

  /** Where the pinned screen has got to: 0 while pinned, then how far it has scrolled off. */
  pinOffset(scroll) {
    const { top, height, vh } = this.work;
    return clamp(scroll, top, top + height - vh) - scroll;
  }

  /**
   * The journey's movements for this scroll. `k` is where the coin is on its
   * way (0 on the letter, 1 the work in view, 2 settled in the work). A future
   * following section can opt into a fold; the current page keeps it open.
   */
  progress(scroll, vh) {
    const { top, height } = this.work;
    const s = scroll - top - SCROLL.ROPE * vh;
    const zoomEnd = SCROLL.START + SCROLL.ZOOM * vh;
    const holdEnd = zoomEnd + SCROLL.HOLD * vh;
    const shutEnd = holdEnd + SCROLL.SHUT * vh;
    const recedeEnd = shutEnd + SCROLL.RECEDE * vh;
    const end = height - vh - SCROLL.ROPE * vh;
    const foldStart = end - SCROLL.FOLD * vh;
    const zoom = clamp((s - SCROLL.START) / (zoomEnd - SCROLL.START), 0, 1);
    const shut = clamp((s - holdEnd) / (shutEnd - holdEnd), 0, 1);
    const recede = clamp((s - shutEnd) / (recedeEnd - shutEnd), 0, 1);
    return {
      k: zoom < 1 ? zoom : shut < 1 ? 1 + shut : 2 + recede,
      fold: SCROLL.FOLD > 0 ? clamp((s - foldStart) / Math.max(1, end - foldStart), 0, 1) : 0,
    };
  }

  engage() {
    // The coin carries on from exactly where the dot was: its turn (so its
    // faces), and the angle the pointer's parallax had it seen at.
    this.heroSkill = this.hero.skillCoin?.snapshot();
    this.seal.shown = null;
    const start = this.heroSkill?.angle ?? 0;
    this.turn = {
      start,
      land: (Math.floor(start / Math.PI + 1e-6) + TRAVEL_FLIPS) * Math.PI,
      view: this.heroSkill?.view ?? { yaw: 0, pitch: 0 },
    };
    this.home = this.hero.dotPoint();
    this.k = this.kRaw = 0;
    Object.assign(this.dot, { x: this.home.x, y: this.home.y, z: 0, r: this.home.r });
    this.engaged = true;
    this.hero.setDotHidden(true);
  }

  disengage() {
    this.engaged = false;
    this.k = this.kRaw = 0;
    this.gate = null;
    this.coin.visible = false;
    this.book.group.visible = false;
    const home = this.home ?? this.hero.dotPoint();
    this.setTransition(coinTransition(0, { home }, reducedMotion));
    this.row?.coins.forEach(coin => { coin.group.visible = false; });
    // Draw the empty frame now: the scroll may already have stopped, and a
    // coin left painted on this canvas would sit beside the letter's own dot.
    this.renderUntil = performance.now() + 100;
    this.hero.setDotHidden(false);
    this.setPhase('hero');
    this.setRevealed(false);
  }

  setPhase(phase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.hero?.setOffstage?.(phase === 'work');
    this.work?.onPhase?.(phase);
  }

  setRevealed(revealed) {
    if (revealed === this.revealed) return;
    this.revealed = revealed;
    this.work?.onReveal?.(revealed);
  }

  setTransition(state) {
    const values = [state.work, state.title, state.names, state.details, state.intro ?? 0, state.leave ?? 0, state.lens ?? 0, state.lensX ?? 0, state.lensY ?? 0, state.lensR ?? 0];
    const key = values.map(value => value.toFixed(5)).join('|');
    if (key === this.transitionKey) return;
    this.transitionKey = key;
    this.work?.onTransition?.(state);
  }

  /**
   * The book for this scroll: it flies up from below into the middle of the
   * screen once the coin is there, stands shut, then opens with the scroll
   * and shuts as the reader scrolls back (Book openAngles); after that it
   * turns only to bring another project round. Returns whether it needs drawing.
   */
  stepBook(dt, scroll) {
    const room = this.work.stage, group = this.book.group;
    if (!room) { group.visible = false; return false; }
    // Nowhere to be seen until the coin is in the middle of the screen; then it flies up into view.
    group.visible = this.k >= FLIGHT[0];
    // The way in and out, with the scroll: it opens (the pages flipping over
    // one by one) and shuts as the reader scrolls back up (folding down toward
    // them together). Which of the two it plays follows the scroll's
    // direction, eased, so a change of mind never jumps.
    // It opens only when the reader scrolls on past the book standing shut (k 2 on), and never while it has a
    // reason to stay shut (the stickers, the book turned away: holdingShut), which `k` already waits for (gateK).
    const open = reducedMotion ? (this.k >= OPEN.at && !this.holdingShut() ? 1 : 0) : clamp((this.k - OPEN.at) / BOOK.open, 0, 1);
    if (this.k < this.kWas - 1e-4) this.leaving = true;
    else if (this.k > this.kWas + 1e-4) this.leaving = false;
    this.kWas = this.k;
    const exitWas = this.exit;
    this.exit += ((this.leaving ? 1 : 0) - this.exit) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 7));
    if (Math.abs((this.leaving ? 1 : 0) - this.exit) < 1e-3) this.exit = this.leaving ? 1 : 0;
    const stepped = this.stepLeaf(dt);
    const held = this.stepHold(dt);
    // Standing shut and not in the hand, it floats: rising and settling a little, turning a little either way,
    // as a thing does that is waiting to be picked up. It comes in with the stretch and goes as it opens.
    this.floatTime = (this.floatTime ?? 0) + dt;
    const floating = reducedMotion ? 0 : smootherStep(clamp((this.k - 1) / .2, 0, 1)) * (1 - clamp((this.openDrawn ?? 0) / .1, 0, 1)) * (this.hold.held ? 0 : 1);
    this.floatAmount = (this.floatAmount ?? 0) + (floating - (this.floatAmount ?? 0)) * (1 - Math.exp(-dt * 3));
    const f = this.floatAmount, ft = this.floatTime;
    const bob = Math.sin(ft * 1.2) * 9 * f;
    const sway = (Math.sin(ft * .7) * .07 + Math.sin(ft * 1.9) * .015) * f;
    const nod = Math.sin(ft * .95 + 1.3) * .035 * f;
    // From standing shut to the open book's angle, place and size as it starts to open.
    const turn = reducedMotion ? (open > 0 ? 1 : 0) : smootherStep(clamp(open / OPEN.turn, 0, 1));
    // Shut, it stands in the middle of the room under the header, SHUT of it tall (or wide, on a narrow screen);
    // open, it is sized so the whole open book stays inside its room, whatever the screen (fitBook).
    const W = window.innerWidth, vh = this.work.vh;
    const tall = 1 + 2 * MAKE.cover.margin / PAGE_ASPECT;
    const { size: shutSize, cy: shutCentre } = this.shutBox();
    const fit = this.fitBook(room);
    this.book.setSize(shutSize + (fit.width - shutSize) * turn);
    const lean = reducedMotion ? { x: 0, y: 0 } : this.lean;
    // The entry: it flies up from below the screen, head first and leaning into it, fast off the mark and
    // slowing as it arrives, turning and banking, and straightens as it comes to a stop; its pages fan with the
    // motion (Book's ajar and riffle) and settle as it comes to rest.
    const flight = clamp((this.k - FLIGHT[0]) / (FLIGHT[1] - FLIGHT[0]), 0, 1);
    const entry = reducedMotion ? 0 : 1 - smootherStep(flight);
    const rise = reducedMotion ? 1 : 1 - (1 - flight) ** 3;
    const bank = reducedMotion ? 0 : ENTRY.bank * Math.sin(Math.PI * 2 * flight) * (1 - flight);
    // Shut, it stands as a book stands, spine on the left, the front cover to the reader, in the reader's hand
    // (turned and tipped about its own middle), leaning a little toward the pointer.
    const q = this._q ??= new THREE.Quaternion(), qOpen = this._qOpen ??= new THREE.Quaternion();
    const euler = this._euler ??= new THREE.Euler();
    const hand = this._hand ??= new THREE.Quaternion(), step = this._step ??= new THREE.Quaternion();
    hand.setFromEuler(euler.set(this.hold.tip + nod, 0, 0)).multiply(step.setFromEuler(euler.set(0, this.hold.yaw + sway, 0)));
    q.setFromEuler(euler.set(ENTRY.pitch * entry + lean.y * .1, ENTRY.yaw * entry + lean.x * .18, ENTRY.roll * entry + bank))
      .multiply(hand).multiply(UPRIGHT);
    // Open, at the open book's angle, as it has always been (Book.VIEW).
    qOpen.setFromEuler(euler.set(VIEW.pitch + lean.y * BOOK.lean.y, VIEW.yaw + lean.x * BOOK.lean.x, VIEW.roll));
    const middle = this._middle ??= new THREE.Vector3();
    middle.set(0, this.book.length * (1 + MAKE.cover.overhang - MAKE.cover.lip) / 2, 0).applyQuaternion(q);
    const pin = this.pinOffset(scroll);
    const shutX = W / 2 - middle.x, shutY = -(shutCentre + pin) - middle.y;
    const openX = room.x + fit.dx, openY = -(room.y + fit.dy + pin);
    group.quaternion.copy(q).slerp(qOpen, turn);
    group.position.set(shutX + (openX - shutX) * turn, shutY + (openY - shutY) * turn, 0);
    // From wholly below the bottom of the screen (tipped as it is there, it reaches a little further).
    group.position.y -= (1 - rise) * (vh - shutCentre + this.book.width * tall * .75 + ENTRY.below);
    group.position.y += bob * (1 - turn);

    const shaking = this.shakeBook(group);

    const at = this.leaf.at;
    const lit = this.lit.amount;
    const moved = at !== this.leafDrawn || lit !== this.litDrawn || open !== this.openDrawn || this.exit !== exitWas;
    this.openDrawn = open;
    this.leafDrawn = at;
    this.litDrawn = lit;
    // The paper goes on settling for a moment after everything else has stopped.
    const settling = this.book.update(at, this.lens, open, this.exit, lit, reducedMotion ? 0 : dt);
    // The coin sticker on the front cover, on the pinned screen, for the coin to land on (and leave from).
    if (COVER_STICKER) {
      const centre = this._stickerCentre ??= new THREE.Vector3(), edge = this._stickerEdge ??= new THREE.Vector3();
      this.book.coverPoint(COVER_STICKER.u, COVER_STICKER.v, COVER_STICKER.r, centre, edge);
      // The sticker in the world: where it is, how big, which way the cover faces, which way is up on it.
      const matrix = this.book.covers[1].matrixWorld;
      const pose = this.coverPose ??= { centre: new THREE.Vector3(), normal: new THREE.Vector3(), up: new THREE.Vector3(), r: 1, facing: 1 };
      pose.centre.copy(centre);
      pose.r = centre.distanceTo(edge);
      pose.normal.setFromMatrixColumn(matrix, 1).normalize();
      pose.up.set(Math.sin(COVER_STICKER.a), 0, -Math.cos(COVER_STICKER.a)).transformDirection(matrix);
      this._toCamera ??= new THREE.Vector3();
      this._toCamera.copy(this.camera.position).sub(centre).normalize();
      pose.facing = pose.normal.dot(this._toCamera);
      const W = this.viewW, H = this.viewH, pin = this.pinOffset(scroll);
      centre.project(this.camera); edge.project(this.camera);
      const cx = (centre.x + 1) / 2 * W, cy = (1 - centre.y) / 2 * H;
      const ex = (edge.x + 1) / 2 * W, ey = (1 - edge.y) / 2 * H;
      this.coverAt = { x: cx, y: cy - pin, r: Math.hypot(ex - cx, ey - cy) };
    }
    return moved || stepped || settling || held || shaking || this.floatAmount > 1e-3 || gsap.isTweening(this.lit);
  }

  /**
   * The book shaken by the coin in its seat (SHAKE), on top of wherever it is
   * this frame: trembling as the coin fights the stickers piled on it, harder
   * and harder, knocked down each time it heaves; kicked as it breaks out,
   * and pressed down again by its weight as it drops back into its seat. Turned
   * about the book's middle, so the coin on its cover goes with it. Returns
   * whether it is shaking.
   */
  shakeBook(group) {
    if (reducedMotion) return false;
    const escape = this.escape, now = performance.now(), t = now / 1000;
    let x = 0, y = 0, roll = 0, tip = 0;
    const fight = (this.struggle ?? 0) ** 1.5;
    if (fight > 0) {
      const knock = Math.max(0, Math.sin(TAU * SHAKE.knock * t + Math.sin(t * 2.3))) ** 6;
      x += fight * SHAKE.tremble * (Math.sin(t * 61) * .6 + Math.sin(t * 97 + 1.1) * .4);
      y += fight * (SHAKE.tremble * .7 * Math.sin(t * 73 + .4) - SHAKE.thump * knock);
      roll += fight * SHAKE.roll * (Math.sin(t * 47 + .7) * .7 + Math.sin(t * 89) * .3);
      tip += fight * SHAKE.tip * knock;
    }
    if (escape?.free) {
      // Each a blow that rings out: down first, back up past where it was, and settling.
      const s = (now - escape.freeAt) / 1000;
      const ring = (from, amount) => { const u = s - from; return u < 0 || u > 1.4 ? 0 : amount * Math.exp(-u * SHAKE.decay) * Math.sin(u * SHAKE.ring); };
      const kick = ring(0, 1), land = ring(ESCAPE.popTime, .75);
      y -= SHAKE.drop * (kick + land);
      tip += SHAKE.tip * 2 * (kick + land);
      roll += SHAKE.roll * 2 * kick;
    }
    if (!x && !y && !roll && !tip) return false;
    // About its middle: where the middle is now, turned by the shake, put back where it was.
    const { overhang, lip } = MAKE.cover;
    const pivot = this._pivot ??= new THREE.Vector3(), shake = this._shake ??= new THREE.Quaternion();
    pivot.set(0, this.book.length * (1 + overhang - lip) / 2, 0).applyQuaternion(group.quaternion);
    const euler = this._shakeEuler ??= new THREE.Euler();
    shake.setFromEuler(euler.set(tip, 0, roll));
    group.quaternion.premultiply(shake);
    group.position.add(pivot).sub(pivot.applyQuaternion(shake));
    group.position.x += x;
    group.position.y += y;
    return true;
  }

  /**
   * The shut book (SHUT), for this screen: its size (Book setSize), the middle
   * of the room it stands in (`cy`, px on the pinned screen), and its outline
   * on the screen (`w`, `h`), told to the journey (onShut) whenever it changes,
   * for the lines about it to be set round it.
   */
  shutBox() {
    const W = window.innerWidth, vh = this.work.vh, stacked = Boolean(this.work.stacked);
    // (Clear of the strip at the bottom a phone's address bar can cover.)
    const top = clamp(this.work.shutTop ?? 0, 0, vh * .5), room = vh - top - (this.work.barInset ?? 0);
    const tall = 1 + 2 * MAKE.cover.margin / PAGE_ASPECT, wide = (1 + MAKE.cover.overhang + MAKE.cover.lip) / PAGE_ASPECT;
    const height = stacked ? room * SHUT.stackedHeight : Math.min(SHUT.height * vh, room * SHUT.fill);
    const size = Math.min(height / tall, (stacked ? SHUT.stackedWidth : SHUT.width) * W / wide);
    const box = { size, cy: top + room / 2, w: size * wide, h: size * tall, top };
    const key = [box.w, box.h, top, box.cy].map(Math.round).join('|');
    if (key !== this.shutKey) { this.shutKey = key; this.work.onShut?.(box); }
    return box;
  }

  /**
   * The book's size and place in its room (`.work__stage`, measured by the
   * journey): as big as BOOK allows, but never past the room's edges, so it
   * never runs into the copy beside or below it. Seen from the side (VIEW), the
   * open book's ring of pages reaches well beyond its width, so its real
   * outline on screen is measured (the open ring, its covers and a margin for
   * the lean toward the pointer, projected through the camera), it is shrunk
   * until that fits and moved so that it is centred. Worked out once per room
   * and screen size, never with the scroll, so the book never changes size as
   * the reader scrolls.
   */
  fitBook(room) {
    const W = this.viewW, H = this.viewH;
    const key = [room.x, room.y, room.w, room.h, W, H].map(Math.round).join('|');
    if (this.bookFit?.key === key) return this.bookFit;
    const most = Math.min(room.w * BOOK.width, room.h * BOOK.height * .5 * PAGE_ASPECT);
    const pad = Math.max(8, Math.min(room.w, room.h) * .03);
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(VIEW.pitch, VIEW.yaw, VIEW.roll));
    const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let width = most, dx = 0, dy = 0;
    for (let pass = 0; pass < 5; pass++) {
      const L = width / PAGE_ASPECT;
      // The open book's envelope: its ring (the covers' reach, and a little for the paper's bend and the lean), the length of its covers along the spine.
      const reach = L * (1 + MAKE.cover.overhang) * 1.06;
      const half = width / 2 + L * MAKE.cover.margin + 2;
      matrix.compose(point.set(room.x + dx, -(room.y + dy), 0), turn, one);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const x of [-half, half]) for (let a = 0; a < 36; a++) {
        const t = a / 36 * Math.PI * 2;
        point.set(x, Math.cos(t) * reach, Math.sin(t) * reach).applyMatrix4(matrix).project(this.camera);
        const sx = (point.x + 1) / 2 * W, sy = (1 - point.y) / 2 * H;
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      const scale = Math.min((room.w - 2 * pad) / (maxX - minX), (room.h - 2 * pad) / (maxY - minY));
      width = Math.min(most, width * scale);
      dx += room.x - (minX + maxX) / 2;
      dy += room.y - (minY + maxY) / 2;
    }
    this.bookFit = { key, width, dx, dy };
    return this.bookFit;
  }

  /** Where the coin is on screen for this scroll: on the i, then at its place in the work. */
  stepDot(dt, kTarget, scroll, vh) {
    const was = this.k;
    // Lenis already smooths this position. A second spring would desync the DOM.
    // The scroll's way, and the way the book and all after it follow: held at the shut book while it has a reason
    // to stay shut, then opening as the reader scrolls on (gateK). The copy, the rope and the coin follow it too.
    this.kRaw = kTarget;
    this.k = this.gateK(kTarget, dt);
    if (!this.home) this.home = this.hero.dotPoint();
    // The coin comes off the i to the dead middle of the screen, nearer (bigger) as it goes, and back to its own
    // size there; the book flies up to it, and it sticks to the cover; later it goes to the first of the project's tools.
    const W = window.innerWidth, home = this.home;
    // (The middle of the room the shut book will stand in, for the book to fly up to it.)
    const centre = { x: W / 2, y: this.shutBox().cy, r: Math.max(home.r * NEAR.times, Math.min(W, vh) * NEAR.most) };
    const first = this.work.rope ? this.ropeSeat() : this.work.tools?.[0];
    const pose = coinTransition(this.k, { home, centre, first, cover: this.coverAt }, reducedMotion);
    this.pose = pose;
    this.shown = pose;
    const dot = this.dot;
    dot.z = 0;
    dot.r = pose.radius;
    dot.x = pose.x;
    dot.y = pose.y + this.pinOffset(scroll);
    // The window onto the work grows out of the coin's edge to the screen's
    // farthest corner. It starts at the coin's own size, so nothing pops in round it.
    const far = Math.hypot(Math.max(dot.x, W - dot.x), Math.max(dot.y, vh - dot.y)) + 4;
    const lensR = pose.lens > 0 ? dot.r + (far - dot.r) * pose.lens : 0;
    this.setTransition({ ...pose, lensX: dot.x, lensY: dot.y, lensR });
    this.sealGliding = false;
    // The book is only drawn inside the window while it opens (drawing-buffer px, from the bottom).
    const dpr = this.renderer.getPixelRatio();
    this.lens.set(dot.x * dpr, (vh - dot.y) * dpr, pose.lens < .999 ? Math.max(.5, lensR) * dpr : 0);
    return this.k !== was;
  }

  /** The book, the coin, then the rope over them, each with a fresh depth buffer. */
  render() {
    this.renderCount = (this.renderCount ?? 0) + 1;
    this.renderer.clear();
    this.renderer.render(this.workScene, this.camera);
    // The coin over everything, except while it lies in its seat on the cover: then it is part of the book.
    if (!(this.coinSeated && this.coin.visible && this.pose?.onBook)) this.renderer.clearDepth();
    const clip = this.coinClip;
    if (clip) {
      // Round the back of the about's tower (stepAbout): drawn everywhere but over the column, a piece at a time
      // (scissor boxes in px from the foot of the canvas): beside it to the left, to the right, and over its top.
      const W = this.viewW || window.innerWidth, H = this.viewH || window.innerHeight;
      const top = clamp(clip.top, 0, H);
      this.renderer.setScissorTest(true);
      for (const [x, y, w, h] of [[0, 0, clip.x0, H], [clip.x1, 0, W - clip.x1, H], [clip.x0, H - top, clip.x1 - clip.x0, top]]) {
        if (w <= 0 || h <= 0) continue;
        this.renderer.setScissor(x, y, w, h);
        this.renderer.render(this.coinScene, this.camera);
      }
      this.renderer.setScissorTest(false);
    } else this.renderer.render(this.coinScene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.uiScene, this.camera);
  }

  /* ----- the about: the other side of the coin ----------------------- */

  /* ----- the contact: the seal ------------------------------------------ */

  /**
   * The contact (components/contact): `{ proxy, pose }`. The coin there is the
   * letter's seal, and it goes wherever `proxy` is: an element on the page the
   * size of the coin, which the reader drags and the contact flies about (so
   * the page's own layout, scroll and animations carry it). `pose`, changed by
   * the contact: whether it is `shown`, how much bigger it is held (`lift`, as
   * it is raised to stamp), how far it has turned over (`spin`, rad), its lean
   * (`tiltX`, `tiltY`, rad, as it is dragged or shakes its head) and whether it
   * is at `rest` (then it leans toward the pointer by itself), and its face: the
   * one the reader has `seen` and the one it is turning to (`face`; either
   * null for Saad's monogram, or coinMarks sealFace, the reader's own seal).
   */
  setContact(contact) {
    this.contact = contact;
    if (this.renderer && contact) this.maskFor(MONOGRAM);
    this.renderUntil = performance.now() + 100;
  }

  /** The seal, this frame, on top of whatever came before. Returns whether to draw. */
  stepContact(dt) {
    const contact = this.contact, coin = this.coin;
    const box = contact?.pose.shown ? contact.proxy.getBoundingClientRect() : null;
    const vh = this.viewH || window.innerHeight;
    const on = Boolean(box && box.width > 0 && box.bottom > -box.height && box.top < vh + box.height);
    if (!on) {
      if (!this.contactOn) return false;
      this.contactOn = false;
      // Off the screen (above or below), and nothing else has it: out of sight.
      if (!this.aboutOn || this.aboutWasGone) coin.visible = false;
      return true;
    }
    this.contactOn = true;
    const pose = contact.pose;
    const x = box.left + box.width / 2, y = box.top + box.height / 2, r = box.width / 2 * (1 + pose.lift);
    coin.visible = true;
    coin.position.set(x, -y, 0);
    coin.scale.setScalar(r);
    coin.quaternion.identity();
    this.showSketch(null);
    // The seal: Saad's monogram, or once they have signed, the reader's own. The side toward them shows the one they
    // have seen (`seen`); a new one (`face`) goes on the side facing away, and comes round as the coin turns over.
    const facing = mod(Math.round(pose.spin / Math.PI), 2);
    this.paintFace(this.faces[facing], pose.seen ?? MONOGRAM);
    this.paintFace(this.faces[1 - facing], pose.face ?? MONOGRAM);
    this.faces.forEach(side => { side.material.uniforms.uMarkOpacity.value = 1; });
    this.spinner.rotation.y = pose.spin;
    // At rest it leans toward the pointer, and sways a little by itself.
    const tilt = this.contactTilt ??= { x: 0, y: 0, rest: 0 };
    tilt.rest += ((pose.rest && !reducedMotion ? 1 : 0) - tilt.rest) * (1 - Math.exp(-dt * 3));
    const ease = 1 - Math.exp(-dt * 5), W = this.viewW || window.innerWidth;
    tilt.y += (clamp((this.pointer.x - x) / (W * .35), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.y) * ease;
    tilt.x += (clamp((this.pointer.y - y) / (vh * .35), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.x) * ease;
    const t = performance.now() / 1000 * ABOUT_COIN.swaySpeed, sway = ABOUT_COIN.sway * tilt.rest;
    this.aligner.rotation.set(pose.tiltX + tilt.x + sway * Math.sin(t * 1.3 + .5) * .6, pose.tiltY + tilt.y + sway * Math.sin(t), 0);
    return true;
  }

  /** How far the about's screen has come up at this scroll: 0 its top still below the screen, 1 pinned (and on). */
  aboutEnterAt(scroll) {
    const about = this.about;
    return about ? clamp(1 - (about.top - scroll) / about.vh, 0, 1) : 0;
  }

  /** Tell components/about what the page shows (aboutTransition), when that changes. */
  reportAbout(state) {
    const key = [state.enter, state.title, state.lede, state.card, state.line, state.bench, state.stopOn, state.stepOn, state.climb ?? 0]
      .map(value => value.toFixed(4)).join('|');
    if (key === this.aboutKey) return;
    this.aboutKey = key;
    this.about.onTransition?.(state);
  }

  /**
   * The coin in the about, this frame, on top of where the journey has put it
   * (aboutTransition has the choreography, all of it a function of the scroll):
   *
   *   jump    off the rope where it stood (which is scrolling away with the
   *           work), tossed end over end in an arc into the middle of the
   *           about's screen as that comes up, growing as it comes;
   *   card    there, turning over to the portrait, swaying a little and
   *           leaning toward the pointer;
   *   line    down onto the tower's road (tower.js), and up it from stop to
   *           stop: rolling on its edge, whole turns, so it stands upright at
   *           each, where it turns round to the reader and over to that
   *           stop's tool; between stops it turns with the road, edge on at
   *           the column's sides, and round the back it is hidden by the
   *           column (render: coinClip), coming out the other side;
   *   bench   off the summit to its place beside the process, where each step
   *           makes it again (its outline, its wireframe, plain, finished).
   *
   * Before the about it does nothing but note where the coin stands on the
   * rope, for the jump to leave from. Returns whether to draw.
   */
  stepAbout(dt, scroll) {
    const about = this.about, coin = this.coin;
    // Hidden by the tower only while it is round the back of it (below), this frame.
    this.coinClip = null;
    if (!about || (this.aboutEnter <= 0 && this.hop.phase === 'rope')) {
      // On the rope (on the pinned work's screen, without the pin): where it will jump from.
      if (coin.visible) this.aboutFrom = { x: coin.position.x, y: -coin.position.y - (this.work ? this.pinOffset(scroll) : 0), r: coin.scale.x, c: this.walk.c };
      if (!this.aboutOn) return false;
      this.aboutOn = false;
      this.aboutCame = null;
      this.ring?.hide();
      this.showSketch(null);
      this.reportAbout(aboutTransition(-1, about?.line.stops.length ?? 1, about?.steps ?? 1, reducedMotion));
      return true;
    }
    this.aboutOn = true;
    const vh = about.vh, n = about.line.stops.length;
    const q = clamp((scroll - about.top) / vh, 0, (about.height - vh) / vh) + this.aboutEnter - 1;
    const state = aboutTransition(q, n, about.steps, reducedMotion);
    const mix = (a, b, t) => a + (b - a) * t;
    const { card, line, bench } = about;
    const tower = line.tower, angles = line.stops;
    // How far up the tower's road the coin has come (rad round the column), for the page to draw the road behind it:
    // from its foot as the coin drops onto the first stop, to the summit once it has left.
    state.climb = state.seg === 'jump' || state.seg === 'card' ? tower.from
      : state.seg === 'toLine' ? mix(tower.from, angles[0], state.e)
        : state.seg === 'line' ? mix(angles[state.stop], angles[Math.min(n - 1, state.stop + 1)], state.travel)
          : tower.to;
    this.reportAbout(state);
    // The about's screen: coming up from below (its top's distance down the screen), pinned (0), or scrolled away.
    const offset = clamp(scroll, about.top, about.top + about.height - vh) - scroll;
    const gone = offset < -vh - about.card.r;
    if (gone) { coin.visible = false; this.ring?.hide(); return this.aboutWasGone !== (this.aboutWasGone = true); }
    this.aboutWasGone = false;

    // On the tower's road at angle θ: standing on it, its middle a radius over the road's.
    const onTower = angle => {
      const at = towerAt(tower, angle);
      return { x: line.x + at.x, y: line.y + at.y - line.r, r: line.r };
    };
    const stopAt = i => onTower(angles[i]);
    // Turned the way the road goes round the column (its face square to the column's), or, at a stop, partly round
    // to face the reader (TOWER face) for its tool to be seen.
    const roundAt = (angle, facing) => Math.atan2(Math.sin(angle), Math.cos(angle)) * (1 - TOWER.face * facing);
    const lift = e => (reducedMotion ? 0 : Math.sin(Math.PI * e) * ABOUT_COIN.arc * vh);
    let x, y, r, roll = 0, yaw = 0;
    const e = state.e;
    // Squashed and stretched (across, and up and down the screen), as a thing with some give in it is.
    let sx = 1, sy = 1, leap = 0;
    if (state.seg === 'jump') {
      // Its place on the card, coming up the screen with it (the hop takes it there: stepHop).
      ({ x, y, r } = card);
      y += offset;
    } else {
      if (state.seg === 'card') ({ x, y, r } = card);
      else if (state.seg === 'toLine') {
        const to = stopAt(0);
        x = mix(card.x, to.x, e); y = mix(card.y, to.y, e) - lift(e); r = mix(card.r, to.r, e);
        yaw = roundAt(angles[0], 1) * e;
      } else if (state.seg === 'line') {
        const i = state.stop, j = Math.min(n - 1, i + 1), t = state.travel;
        const angle = mix(angles[i], angles[j], t);
        ({ x, y, r } = onTower(angle));
        // Rolling up the road, a whole number of turns from stop to stop (by the length of the road between them,
        // round the column and up it): upright at each.
        const length = Math.abs(angles[j] - angles[i]) * Math.hypot(tower.R, tower.pitch);
        roll = -TAU * Math.round(length / (TAU * r)) * t;
        // Square to the reader at the stops, turning with the road between them: edge on at the column's sides.
        yaw = roundAt(angle, 1 - smootherStep(clamp(Math.min(t, 1 - t) / .22, 0, 1)));
        // Round the back of the column: hidden by it, but for whatever shows beside it or over its top.
        if (Math.cos(angle) < 0) {
          const left = line.x + tower.cx - tower.R;
          this.coinClip = { x0: left, x1: left + 2 * tower.R, top: line.y + tower.topY - tower.ry + offset };
        }
      } else if (state.seg === 'toBench') {
        const from = stopAt(n - 1);
        x = mix(from.x, bench.x, e); y = mix(from.y, bench.y, e) - lift(e); r = mix(from.r, bench.r, e);
      } else ({ x, y, r } = bench);
      y += offset;
    }
    // In the air between the rope and the card (or crouched to go): the hop has it.
    const hopped = this.stepHop(dt, scroll, { x, y, r }, vh);
    if (hopped) ({ x, y, r, sx, sy, leap } = hopped);
    coin.visible = true;
    coin.position.set(x, -y, 0);
    coin.scale.set(r * sx, r * sy, r);
    this.aboutPose = { x, y, r };
    // Turned round the upright (yaw, on the tower), then rolled about its own middle.
    coin.quaternion.setFromAxisAngle(this._yAxis ??= new THREE.Vector3(0, 1, 0), yaw)
      .multiply((this._roll ??= new THREE.Quaternion()).setFromAxisAngle(this._zAxis ??= new THREE.Vector3(0, 0, 1), roll));

    // Its faces: what it came off the rope showing, the portrait, each stop's tool, the process. The next comes
    // onto the side facing away, so no face ever changes in view; while it is tossed, that is the same tool again.
    this.aboutCame ??= this.seal.shown ?? COIN_SKILLS[0];
    const list = this.aboutList = aboutFaces(this.aboutCame, PORTRAIT, about.faces, MONOGRAM);
    // On the card, once it has turned over to the portrait, it is the reader's to spin (stepHand): its two sides
    // are the two sides of Saad, his face in code (the engineer) and his face in polygons (the artist).
    const inHand = state.seg === 'card' && state.flips >= 1 - 1e-3 && !hopped;
    const spun = this.stepHand(dt, inHand, state.e);
    const turned = state.flips + spun / Math.PI;
    const base = this.flip.angle, at = Math.floor(turned + 1e-6);
    const face = i => (inHand ? (mod(i - 1, 2) === 0 ? PORTRAIT : MESH) : list[clamp(i, 0, list.length - 1)]);
    const front = Math.round(base / Math.PI) + at;
    this.paintFace(this.faces[mod(front, 2)], face(at));
    this.paintFace(this.faces[mod(front + 1, 2)], state.seg === 'jump' || hopped ? face(at) : face(at + 1));
    this.faces.forEach(side => { side.material.uniforms.uMarkOpacity.value = 1; });
    this.spinner.rotation.y = base + Math.PI * turned;
    this.showSketch(face(Math.round(turned)));
    this.stepAscii(dt, inHand, card);
    // Which of his sides is up (null off the card), for the words under it to follow.
    const up = inHand ? face(Math.round(turned)) : null;
    if (up !== this.sideUp) { this.sideUp = up; about.onSide?.(up === PORTRAIT ? 'engineer' : up === MESH ? 'artist' : null); }

    // The reviews' ring round it: opening out from behind it once it has landed on the card, and folding back into
    // it as it leaves (for the tower, or back up to the rope), wherever it is.
    if (this.ring) {
      const scrolled = scroll - (this.ringScroll ?? scroll);
      this.ringScroll = scroll;
      const want = this.hop.phase === 'card' && (state.seg === 'jump' || state.seg === 'card' || state.seg === 'toLine') ? 1 : 0;
      this.ringOpen = reducedMotion ? want : this.ringOpen + (want - this.ringOpen) * (1 - Math.exp(-dt * (want ? 2.6 : 5)));
      // (Folding as the scroll takes the coin down to the tower, in step with it.)
      const leaving = state.seg === 'toLine' ? smootherStep(clamp(e / .6, 0, 1)) : 0;
      const open = this.ringOpen * (1 - leaving);
      if (narrowScreen.matches || open < .001) this.ring.hide();
      else this.ring.place({
        x, y, r, open, dt, scrolled,
        spin: this.coinHand.spin, pointer: this.pointer, camera: this.camera, dpr: this.renderer.getPixelRatio(),
      });
    }

    // At rest (on the card, on the bench) it sways a little by itself and leans toward the pointer.
    const tilt = this.aboutTilt, ease = 1 - Math.exp(-dt * 4);
    const resting = !reducedMotion && (state.seg === 'card' || state.seg === 'bench') ? 1 : 0;
    tilt.rest += (resting - tilt.rest) * (1 - Math.exp(-dt * 2.5));
    const W = this.viewW || window.innerWidth;
    tilt.y += (clamp((this.pointer.x - x) / (W * .4), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.y) * ease;
    tilt.x += (clamp((this.pointer.y - y) / (vh * .4), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.x) * ease;
    const t = performance.now() / 1000 * ABOUT_COIN.swaySpeed;
    const sway = ABOUT_COIN.sway * tilt.rest;
    this.aligner.rotation.set(
      TAU * ABOUT_COIN.turns * leap + tilt.x + sway * Math.sin(t * 1.3 + .5) * .6,
      tilt.y + sway * Math.sin(t),
      0,
    );
    return true;
  }

  /**
   * The hop between the rope and the card (HOP), this frame. It begins the
   * moment the about's screen starts to come up under the work (and the hop
   * back, the moment it has gone again) and runs by the clock from there,
   * whatever the scroll does meanwhile, landing wherever the coin's place
   * (`target`: x, y, r on the screen) is by then. The rope sags under it as
   * it crouches and whips back once it has gone, and goes back to the edge
   * (ropeAway) while the coin is off it. Returns the coin's pose ({ x, y, r,
   * sx, sy, leap }) while the hop has it, or null once it is on the card.
   */
  stepHop(dt, scroll, target, vh) {
    const hop = this.hop, enter = this.aboutEnter, was = hop.phase, about = this.about;
    const moved = this.scrolled ?? 0;
    // Into the about (scrolling down past the end of the work, or there already), or back out of it (scrolling up
    // off the card, or above it already). The page is taken there once the coin is in the air (not if something
    // else is gliding it already).
    const other = gliding(), ours = other === 'hop', take = !reducedMotion && !other;
    if ((was === 'rope' || was === 'down') && (enter >= 1 || (enter > .02 && moved > 0 && !ours))) {
      Object.assign(hop, { phase: 'up', t: was === 'down' ? 1 - hop.t : 0, launch: null, page: enter < 1 && take ? about.top : null });
    } else if ((was === 'up' || was === 'card') && (enter <= 0 || (enter < .98 && moved < 0 && !ours))) {
      // From where it was last drawn (kept on the screen: its place on the card may be scrolled away below already).
      const last = this.aboutPose ?? target, start = { x: last.x, y: Math.min(last.y, vh - last.r * .6), r: last.r };
      Object.assign(hop, { phase: 'down', t: was === 'up' ? 1 - hop.t : 0, start, launch: null, page: enter > 0 && take ? about.top - about.vh : null });
    }
    if (reducedMotion && hop.phase !== 'rope' && hop.phase !== 'card') hop.phase = hop.phase === 'up' ? 'card' : 'rope';
    const { phase } = hop;
    this.ropeAway = phase === 'rope' ? 0 : 1;
    if (phase === 'rope' || phase === 'card') return null;
    const t = hop.t = Math.min(1, hop.t + dt / HOP.time);
    const mix = (p, q, k) => p + (q - p) * k;
    // Off the ground: the page goes now, to arrive as the coin lands.
    if (hop.page != null && t >= HOP.crouch) {
      const ease = k => (k < .5 ? 4 * k * k * k : 1 - (2 - 2 * k) ** 3 / 2);
      scrollToY(hop.page, { duration: Math.max(.3, (1 - t) * HOP.time), easing: ease, lock: true, by: 'hop' });
      hop.page = null;
    }

    // The rope under it at scroll `at` (it goes up the screen with the work), its low point sagging `dip`: the coin
    // sits in the V it makes, on both sides of it (a line y = k|x| touches an ellipse a, b at √(a²k² + b²)).
    const from = this.aboutFrom ?? { ...target, c: .5 };
    const rope = this.ropeLine(), c = clamp(from.c ?? .5, .02, .98), span = rope ? rope.x1 - rope.x0 : 1;
    const seat = (dip, sx = 1, sy = 1, at = scroll) => (rope ? rope.y + dip + this.walk.droop * 4 * c * (1 - c) - ROPE_HALF : from.y + from.r)
      + (this.work ? this.pinOffset(at) : 0) - Math.hypot(from.r * sx * Math.max(0, dip) / (Math.min(c, 1 - c) * span), from.r * sy);
    const setRope = dip => {
      Object.assign(this.walk, { c: from.c ?? this.walk.c, dip, dipV: 0 });
      this.ropebar?.placeLine(scroll);
    };
    // Over in its arc (`f` 0 → 1: the flight, then the landing), stretched by its speed, turning end over end,
    // growing (or shrinking) to its size there; landing squashed and standing up again. It makes for where its place
    // will be once the page has got there (`home`), and for where it is (`live`) as it comes down.
    const flight = (a, home, live, f) => {
      const air = 1 - HOP.land, k = clamp(f / air, 0, 1), along = mix(k, smootherStep(k), .5);
      const b = { x: mix(home.x, live.x, smootherStep(clamp((k - .7) / .3, 0, 1))), y: mix(home.y, live.y, smootherStep(clamp((k - .7) / .3, 0, 1))) };
      const land = f > air ? Math.sin(Math.PI * (f - air) / HOP.land) : 0, fly = Math.sin(Math.PI * k) * (1 - land);
      return {
        x: mix(a.x, b.x, along), y: mix(a.y, b.y, k) - Math.sin(Math.PI * k) * HOP.height * vh, r: mix(a.r, live.r, smootherStep(k)),
        sx: (1 - .08 * fly) * (1 + .2 * land), sy: (1 + .16 * fly) * (1 - .24 * land), leap: smootherStep(k),
      };
    };
    const deep = TIGHTROPE.weight + HOP.sag;
    let pose;
    if (phase === 'up') {
      if (t < HOP.crouch) {
        // Crouching into the rope, squashed, the rope giving under it.
        const k = smootherStep(t / HOP.crouch), sx = 1 + .14 * k, sy = 1 - .3 * k, dip = TIGHTROPE.weight + HOP.sag * k;
        setRope(dip);
        pose = { x: from.x, y: seat(dip, sx, sy), r: from.r, sx, sy, leap: 0 };
      } else {
        // Off, from where the rope was as it went (in the air, it no longer goes up the screen with the work); the
        // rope snapping back up past straight and wobbling out.
        hop.launch ??= { x: from.x, y: seat(deep), r: from.r };
        const since = (t - HOP.crouch) * HOP.time, [hz, damping] = HOP.recoil;
        if (since < 1.6) setRope(deep * Math.exp(-damping * since) * Math.cos(TAU * hz * since));
        const home = { x: about.card.x, y: about.card.y };
        pose = flight(hop.launch, home, target, (t - HOP.crouch) / (1 - HOP.crouch));
      }
      this.ropeAway = smootherStep(clamp((t - .3) / .4, 0, 1));
      if (t >= 1) hop.phase = 'card';
    } else {
      // Back: a crouch where it is, then over onto the rope (back under it before it lands).
      const live = { x: from.x, y: seat(TIGHTROPE.weight), r: from.r };
      const home = { x: from.x, y: seat(TIGHTROPE.weight, 1, 1, about.top - about.vh) };
      if (t < HOP.crouch) {
        const k = smootherStep(t / HOP.crouch);
        pose = { ...hop.start, sx: 1 + .12 * k, sy: 1 - .22 * k, leap: 0 };
        pose.y += hop.start.r * .22 * k;
      } else {
        pose = flight(hop.start, home, live, (t - HOP.crouch) / (1 - HOP.crouch));
        pose.leap = -pose.leap;
      }
      this.ropeAway = 1 - smootherStep(clamp(t / .5, 0, 1));
      if (t >= 1) hop.phase = 'rope';
    }
    return pose;
  }

  /**
   * The coin in the reader's hand on the card (components/about tells the
   * stage what the hand does: coinGrab, coinTurn, coinLet). Held, it turns as
   * far as the hand moves; let go, it spins on as fast as it was flicked,
   * slowing, and settles on whichever face is nearest, the portrait or a tool.
   * Off the card (`inHand` false, or the scroll taking it on: `e` near the
   * card's end), it turns home to the portrait, so what follows begins as it
   * always does. Returns how far it is turned by hand (rad, a whole number of
   * turns once it is home, which is no turn at all).
   */
  stepHand(dt, inHand, e) {
    const hand = this.coinHand;
    if (hand.held && inHand) return hand.angle;
    hand.held = false;
    const settling = inHand && e < .9;
    if (settling && Math.abs(hand.spin) > HAND.settle) {
      hand.spin *= Math.exp(-HAND.friction * dt);
      hand.angle += hand.spin * dt;
      return hand.angle;
    }
    // Onto the nearest face (a half-turn), or home to the portrait (a whole one), by a spring.
    const unit = settling ? Math.PI : TAU, target = Math.round(hand.angle / unit) * unit;
    const [w, z] = HAND.spring, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      hand.spin += (w * w * (target - hand.angle) - 2 * z * w * hand.spin) * h;
      hand.angle += hand.spin * h;
    }
    if (Math.abs(target - hand.angle) < 1e-4 && Math.abs(hand.spin) < 1e-3) {
      hand.spin = 0;
      hand.angle = target;
      // Settled on the portrait: a whole number of turns is no turn (on a tool, the turns say which tool, so they stay).
      if (Math.abs(mod(target + Math.PI, TAU) - Math.PI) < 1e-6) hand.angle = 0;
    }
    return hand.angle;
  }

  /** components/about: the hand takes hold of the coin on the card. */
  coinGrab() {
    Object.assign(this.coinHand, { held: true, spin: 0 });
    this.renderUntil = performance.now() + 100;
  }

  /** The hand has moved `px` across it, holding it: it turns with it. */
  coinTurn(px) {
    if (!this.coinHand.held) return;
    this.coinHand.angle += px * HAND.perPx;
    this.renderUntil = performance.now() + 100;
  }

  /** Let go, the hand moving at `pxPerSecond`: it spins on. */
  coinLet(pxPerSecond) {
    const hand = this.coinHand;
    if (!hand.held) return;
    hand.held = false;
    hand.spin = clamp(pxPerSecond * HAND.perPx, -HAND.fastest, HAND.fastest);
  }

  /** The pointer over the coin on the card: `at` across its face ({ u, v }, 0 → 1, v up), or null when it is not. */
  coinPoint(at) {
    const hand = this.coinHand;
    hand.over = Boolean(at);
    if (at) { hand.u = at.u; hand.v = at.v; }
  }

  /** A tap on the coin: it turns over to his other side (a flick of a half-turn, settled by stepHand). */
  coinTap() {
    const hand = this.coinHand;
    hand.held = false;
    hand.spin = HAND.tap;
  }

  /**
   * The portrait's live part, this frame: the lens where the pointer is over
   * the coin on the card (eased in and out), the clock its churning edge runs
   * on, and how many characters across the
   * face is, for the coin's size there (about 10px a character: big enough to be read as type, not as dots).
   */
  stepAscii(dt, inHand, card) {
    const hand = this.coinHand, now = performance.now();
    hand.hover += ((inHand && hand.over && !reducedMotion ? 1 : 0) - hand.hover) * (1 - Math.exp(-dt * 6));
    const cells = clamp(Math.round(card.r * 2 / 10.5), 22, 40);
    for (const face of this.faces) {
      const u = face.material.uniforms;
      u.uHover.value = hand.hover;
      u.uPointer.value.set(hand.u, hand.v);
      u.uTime.value = now / 1000;
      u.uCells.value = cells;
    }
  }

  /* ----- the loop ---------------------------------------------------- */

  /**
   * Put the drawing away while something covers the whole screen (components/work PageViewer): both canvases
   * (this one and the hero's) shrink to a pixel, freeing their drawing buffers, and nothing is drawn, so a phone has
   * the memory for what is on top; brought back as they were when it is gone.
   */
  suspend(on) {
    if (!this.renderer || Boolean(on) === Boolean(this.suspended)) return;
    this.suspended = Boolean(on);
    const hero = this.hero;
    if (hero) hero.suspended = this.suspended;
    document.documentElement.classList.toggle('is-suspended', this.suspended);
    if (on) {
      this.renderer.setSize(1, 1, false);
      hero?.renderer?.setSize(1, 1, false);
      return;
    }
    this.viewW = null;
    this.handleResize();
    hero?.handleResize?.();
    this.renderUntil = performance.now() + 200;
  }

  tick(time, deltaMs) {
    if (!this.renderer || document.hidden || this.suspended) return;
    const dt = Math.min(deltaMs, 40) / 1000;
    const scroll = window.scrollY, vh = this.viewH;
    const now = performance.now();
    let need = scroll !== this.lastScroll || now < this.renderUntil;
    /** Which way the page moved since the last frame (px). */
    this.scrolled = scroll - (this.lastScroll ?? scroll);
    this.lastScroll = scroll;
    const ready = this.work && this.hero && this.heroRest;
    // How far the about's screen has come up under the work (the coin jumps off the rope into it).
    this.aboutEnter = this.engaged ? this.aboutEnterAt(scroll) : 0;

    // How far the scroll rope has come into the project's copy as the tightrope (RopeScrollbar reads it).
    if (this.work) {
      // (On the book's way, gateK: held back with it while it is held shut.)
      const t = clamp((this.k - TIGHTROPE.from) / TIGHTROPE.span, 0, 1);
      // Once the coin has jumped off it into the about, the rope goes back to the edge: the scrollbar again.
      const away = this.ropeAway ?? 0;
      const tight = (this.work.rope && this.engaged ? (reducedMotion ? (t > 0 ? 1 : 0) : t) : 0) * (1 - away);
      if (tight !== this.tightrope) need = true;
      this.tightrope = tight;
    }
    if (this.stepRopeLine(dt)) need = true;
    // First the rope leaves the word and becomes the scrollbar.
    if (this.work && this.hero && this.ropebar) {
      const ropeProgress = (scroll - this.work.top) / (SCROLL.ROPE * vh);
      if (this.ropebar.update(ropeProgress)) need = true;
    }

    if (ready) {
      const s = scroll - this.work.top - SCROLL.ROPE * vh;
      if (!this.engaged && s > SCROLL.START) this.engage();
      else if (this.engaged && s <= SCROLL.START) { this.disengage(); need = true; }
    } else if (this.engaged) {
      this.disengage();
      need = true;
    }
    if (!this.engaged) {
      if (need) this.render();
      return;
    }

    const { k: kTarget } = this.progress(scroll, vh);
    const dot = this.dot;
    if (this.stepDot(dt, kTarget, scroll, vh)) need = true;

    // Pointer access follows the visible section; opacity is scrubbed separately.
    this.setPhase(this.pose.lens < .999 ? 'hero' : 'work');
    this.setRevealed(this.shown.details > .98);

    // The light at the reader's pointer, held a little in front of the screen, for the covers and the stickers to catch.
    this.book?.shared.uCursor.value.set(this.pointer.x, -this.pointer.y, this.distance * .35);
    if (this.stepBook(dt, scroll)) need = true;
    // Whether the shut book can be picked up now: the journey turns its hold on and off (Work.css .work__hold).
    const holdable = this.canHold();
    if (holdable !== this.holdable) { this.holdable = holdable; this.work.onHoldable?.(holdable); }
    if (this.sealGliding) need = true;

    const selected = this.active;
    this.coin.visible = true;
    this.coin.position.set(dot.x, -dot.y, dot.z);
    this.coin.scale.setScalar(dot.r);
    // The row of tools (the coin is its first).
    if (this.stepRow(dt)) need = true;
    const rowState = this.rowState;
    const offset = this.pinOffset(scroll);
    this.row.coins.forEach((coin, n) => {
      const state = this.k >= 1 ? rowState[n + 1] : null;
      // (Not with the rope in the copy: there the one coin balances on it and turns to each tool in turn.)
      coin.group.visible = Boolean(state && state.size > .001 && !this.work?.rope);
      if (!coin.group.visible) return;
      // Behind the first until they have come out from it.
      coin.group.position.set(state.x, -(state.y + offset), -8 - 2 * n);
      coin.group.scale.setScalar(state.r * state.size);
      coin.spinner.rotation.y = state.turn;
      coin.faces[0].material.uniforms.uMask.value = this.maskFor(state.front);
      coin.faces[1].material.uniforms.uMask.value = this.maskFor(state.back);
    });
    // One coin. On the way down it carries the dot's own turn on by
    // TRAVEL_FLIPS half-turns, scrubbed by the scroll: the hero's next skill
    // passes, and it lands on the project on show's first tool. In the work it
    // turns through that project's tools (with none on show, the skills).
    // Either side only takes a new mark while it faces away, so no mark ever
    // changes in view.
    const turn = this.turn, seal = this.seal;
    const wrap = (i, n) => ((i % n) + n) % n;
    let flipTarget;
    const sides = [];
    if (this.k < 1) {
      const tools = this.coinTools();
      flipTarget = turn.start + (turn.land - turn.start) * this.pose.yaw / Math.PI;
      const landing = Math.round(turn.land / Math.PI);
      // With no project on show it lands on the next skill in the sequence;
      // scrolling back up out of the work, it lands where it was.
      if (selected < 0) seal.shown = COIN_SKILLS[wrap(landing, COIN_SKILLS.length)];
      seal.shown ??= tools[0];
      Object.assign(seal, { project: selected, index: Math.max(0, tools.indexOf(seal.shown)), hold: 0, turns: 0, progress: 0, flip: null });
      const mark = i => (i === landing ? seal.shown : COIN_SKILLS[wrap(i, COIN_SKILLS.length)]);
      const n = Math.floor(flipTarget / Math.PI + 1e-6);
      sides[wrap(n, 2)] = mark(n);
      sides[wrap(n + 1, 2)] = mark(n + 1);
      // Sticking to the cover it turns over to its other face, the monogram (it has landed on its face by then).
      if (this.pose.onBook) sides[1 - wrap(landing, 2)] = MONOGRAM;
    } else {
      // Off the i it faces the reader, the first of the row: it turns over only with the row, to a new project's first tool.
      const state = rowState[0];
      // On the rope it turns to each of the project's tools in turn, by itself.
      const balancing = this.balancing();
      // Landing on the cover it turns over to its other face, the monogram, and turns back as it lifts off.
      flipTarget = turn.land + (state?.turn ?? 0);
      const facing = wrap(Math.round(turn.land / Math.PI), 2);
      sides[facing] = state?.front ?? seal.shown;
      // Its other face is the monogram while it is on the book (it lands on it and lies monogram up).
      sides[1 - facing] = this.pose.onBook ? MONOGRAM : state?.back ?? seal.shown;
      if (state) seal.shown = state.front;
      if (state && state.size < 1 && !balancing) this.coin.scale.setScalar(dot.r * Math.max(.001, state.size));
      if (balancing) {
        const tools = this.coinTools();
        // By the clock, not the frame: the same pace on a slow screen as a fast one.
        const now = performance.now();
        const cycle = this.cycle ??= { t: 0, n: 0, project: selected, at: now };
        if (cycle.project !== selected) Object.assign(cycle, { t: 0, n: 0, project: selected });
        cycle.t += reducedMotion ? 0 : Math.min(.25, (now - cycle.at) / 1000);
        cycle.at = now;
        // Standing at a tool's tag (hold), then walking on to the next one's (walk), turning over to it as it goes:
        // along the rope and back again (pace).
        const period = TIGHTROPE.hold + TIGHTROPE.walk;
        while (cycle.t >= period) { cycle.t -= period; cycle.n++; }
        const f = tools.length > 1 ? smootherStep(clamp((cycle.t - TIGHTROPE.hold) / TIGHTROPE.walk, 0, 1)) : 0;
        const n = tools.length > 1 ? cycle.n : 0;
        cycle.f = f;
        const landing = Math.round(turn.land / Math.PI);
        flipTarget = turn.land + Math.PI * (n + f);
        sides[wrap(landing + n, 2)] = tools[pace(n, tools.length)];
        sides[wrap(landing + n + 1, 2)] = tools[pace(n + 1, tools.length)];
        seal.shown = tools[pace(f > .5 ? n + 1 : n, tools.length)];
        need = true;
      } else this.cycle = null;
      const shown = balancing ? seal.shown : null;
      if (shown !== this.toolShown) { this.toolShown = shown; this.onTool?.(shown); }
    }
    sides.forEach((tool, side) => this.paintFace(this.faces[side], tool));
    for (const face of this.faces) face.material.uniforms.uMarkOpacity.value = this.heroSkill ? 1 : this.pose.mark;
    // It leaves at the angle the reader was seeing the dot from, and straightens as it lifts.
    const seen = reducedMotion ? 0 : 1 - smootherStep(clamp(this.k / .45, 0, 1));
    this.aligner.rotation.set(this.pose.pitch + turn.view.pitch * seen, -turn.view.yaw * seen, this.pose.roll);
    // The flip follows the scroll exactly, like everything else.
    if (Math.abs(this.flip.angle - flipTarget) > 1e-5) need = true;
    this.flip.angle = flipTarget;
    this.spinner.rotation.y = this.flip.angle;
    // The coin in its seat, for a sticker laid over it to be stretched over it (a bump in the sticker): its place on
    // the front cover, its radius, and how high its face stands, as far as it has come to rest there.
    if (this.book?.stickers) {
      const { overhang, lip, margin } = MAKE.cover;
      const across = 1 + overhang + lip, half = PAGE_ASPECT / 2 + margin;
      const radius = COVER_STICKER.r * across;
      // In its seat only once it has landed there (not on its way down onto it, nor flicked off as the book opens).
      this.stepEscape();
      const seated = Boolean(this.pose.onBook && this.pose.stick >= .999 && (this.pose.lift <= .001 || (this.escape?.trapped && !this.escape.free)));
      // Its faces stand faceZ of its radius off its middle, and its middle as far off the board: so its face twice that;
      // the sticker clears it by a pixel or two (the coin's face is drawn pulled toward the camera, its polygon offset).
      // (With room to spare for a phone's coarser depth buffer.) Fighting under them, the bump slides with it.
      const face = Math.abs(this.faces[0].position.z) * 2 * radius, slid = this.coinSlide() * radius;
      this.book.stickers.setCoin(COVER_STICKER.u * across - lip + slid * Math.sin(COVER_STICKER.a),
        COVER_STICKER.v * 2 * half - half - slid * Math.cos(COVER_STICKER.a), radius, face * 1.06 + .012, seated);
    }
    // On the book: sticking to the cover, lying on it, flicked off it (placeOnBook).
    if (this.pose.onBook && this.coverPose && this.book.group.visible) {
      this.placeOnBook(dot, scroll);
      need = true;
    } else {
      this.coin.quaternion.identity();
      this.coinSeated = false;
      if (this.balancing()) { this.balance(dt, scroll); need = true; }
    }
    if (!this.balancing()) {
      this.balanceIn = 0;
      if (this.restRope()) need = true;
    }
    // The rope where the coin is now standing on it, and the tags hanging from it with it.
    if (this.ropebar?.placeLine(scroll)) need = true;
    this.reportRope();
    // The faces are drawn pulled toward the camera, so the mark never flickers against the coin; by the slope too
    // (polygonOffsetFactor), except while the coin lies in its seat: seen edge on, that pull grows with the angle
    // and would drag the face out in front of a sticker laid over it. There, a fixed nudge (the units) is enough.
    const factor = this.coinSeated ? 0 : -4;
    for (const face of this.faces) face.material.polygonOffsetFactor = factor;
    // In the about, the coin is its own (stepAbout), whatever the journey made of it above.
    if (this.stepAbout(dt, scroll)) need = true;
    // In the contact, the coin is the letter's seal (stepContact), wherever its stand-in on the page is.
    if (this.stepContact(dt)) need = true;

    if (need) this.render();
  }
}

/** The one stage. Mounted by components/stage, fed by the hero and the journey. */
export const stage = new DotStage();
