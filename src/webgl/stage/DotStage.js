import * as THREE from 'three';
import gsap from 'gsap';
import { SURFACE_LIGHTING } from '../hero/lighting.glsl.js';
import { createSolidMaterial, paintSolid } from '../hero/materials.js';
import { brandPalette, onSchemeChange } from '../../brand/palette.js';
import { reducedMotion } from '../../brand/motion.js';
import RopeScrollbar from './RopeScrollbar.js';
import ReviewRing from './ReviewRing.js';
import { Band } from './Band.js';
import { Puzzle } from './PuzzleBoard.js';
import { processTransition, wordTurn } from './processTransition.js';
import { coinWords, loadWordsFace, MINE, YOURS } from './coinWords.js';
import { moreTransition, MORE } from './moreTransition.js';
import { coinTransition, splitAt, ROW, FLIGHT, CENTRE, STICK } from './coinTransition.js';
import { aboutTransition, aboutFaces, LINE, ABOUT_SCROLL, WHEEL } from './aboutTransition.js';
import { markCanvas, morphField, MORPH, isDark, hasMark, COIN_SKILLS, MONOGRAM, PORTRAIT, MESH, ASCII, portraitPhoto, asciiAtlas } from '../coinMarks.js';
import { COIN_LOG, coinLog } from '../coinLog.js';
import { startTour, stepTour, endTour, tourShown, tourFooting, stationAt, HIGH_TIME, TOSS } from './ropeTour.js';
import { warmGently, afterLoader, siteSettled } from '../gpuWork.js';
import { perf } from '../../lib/perf.js';
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

export const FOV = 30;
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
 * posts, and the coin, flicked off the cover, lands right on it and is tossed
 * along it, from one of the project's tools' tags to the next, turning up each
 * tool as it lands (ropeTour.js has the tour).
 *
 * The rope sags `droop` px at its middle by itself, and `weight` px more
 * under the coin, to a point where it stands (ropeDissolve ROPE_SAG).
 *
 * Balancing: how far it leans the way it is going (rad), how far it sways
 * standing, the knock a landing gives its lean (rad/s) and the lean's spring
 * (rad/s, damping: it rocks as it lands, and catches itself).
 */
const TIGHTROPE = {
  from: 2.02, span: .26,
  droop: 3, weight: 5,
  lean: .14, sway: .045, kick: 1.3, balance: [9, .28],
};
/** A mark changed in view off the rope (another project come round while the coin is on its way to it) is printed on from the middle out, over this long (s). */
const WIPE = { time: .55 };
/** How far the copy rises as it comes in (px; Work.css .work__copy), for the rope to rise with it. */
const COPY_RISE = 22;
/** Half the rope's thickness on the screen (px; RopeScrollbar DIAMETER), for the coin to stand on top of it. */
const ROPE_HALF = 2;
const UPRIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
/**
 * The book turning on its own: it rests on a page until the coin has been
 * along all of that project's tools (turnDue), then turns to the next over
 * `turn` seconds, slow away and slow in. Past the covers (after the last page,
 * on round to the first) the two places take `covers` of that. With no coin
 * on the rope to wait for, it rests `dwell` seconds on each page.
 */
const SPIN = { turn: 2, covers: 1.5, dwell: 3.4 };
const TAU = Math.PI * 2;
/** The turn's easing over one step: from rest, to rest. */
const spinEase = x => x - Math.sin(TAU * x) / TAU;
const spinSpeed = x => 1 - Math.cos(TAU * x);
const mod = (a, n) => ((a % n) + n) % n;
/** The lamp under the pointer: how long it takes to open wider and brighten, and to settle back (s). */
const LIT = { on: .7, off: .9 };
/**
 * The coin in the about (aboutTransition has the choreography): how many
 * times it turns end over end falling into it out of the sky, how far it leans
 * toward the pointer at rest (rad), how far it sways there by itself (rad, and
 * how fast), and how much of the way in the rope takes to leave the copy for
 * the edge again, the scrollbar.
 */
const ABOUT_COIN = { turns: 1, tilt: .26, sway: .07, swaySpeed: .9, rope: .35 };
/**
 * The reviews' ring round the coin on the card, going: it folds away, all of it, before the coin moves at all.
 * Scrolling on, over the about's FOLD (aboutTransition: after the card's stretch, the coin held just as it is), the
 * fold done `done` of the way through it so the coin is still a moment longer once the ring has gone; the coin
 * jumping back to the rope, by the clock, in `shut` s (it is shut by the time the coin is off the ground). Coming,
 * it opens at `open` /s, easing in.
 */
const RING_GO = { done: .85, shut: .2, open: 2.6 };
/**
 * The ring the coin becomes after the process (stepBand): how far it turns round its own axis with the scroll once it
 * is formed (rad/px), and its outer radius at radius 1 (Band: so the ring is as big as its place).
 */
const BAND = { turn: .0016, outer: 1.04 };
/** The ring at rest: how it is turned (rad, about y, then x, then z: its opening to the left, leaning right), and round its axis. */
const BAND_POSE = { euler: [-.32, 1.18, -.5], spin: .4 };
/** How finely the scroll draws a turn of what the coin says (coinSays). */
const SAID_STEPS = 60;
/** A narrow screen (as About.css has it): no ring of reviews round the coin there, they run as a ticker. */
const narrowScreen = window.matchMedia("(max-width: 600px), (max-aspect-ratio: 4/5)");
/**
 * The coin in the hand, on the card. A drag turns it over once, to his other
 * side, however hard it is flicked: how far it turns per px dragged, and at
 * most (`most` half-turns, held); how far it must be turned (`flip`, rad), or
 * how fast flicked (`flick`, rad/s), to go over rather than back; the most of
 * a flick it keeps (`fastest`, rad/s) into the spring that settles it on the
 * face (rad/s, damping); and the flick a tap gives it (rad/s). Left alone it
 * turns over by itself, `every` seconds; `after` the reader has turned it,
 * that long first.
 */
const HAND = { perPx: .012, most: 1.12, flip: .3, flick: 2, fastest: 10, spring: [9, .7], tap: 7.5, every: 5, after: 9 };
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
 * it in its own colours. Or (uMode) Saad himself, made every frame of his own
 * photograph's colours (uPhoto: him, cut out of the wall behind him, coinMarks
 * portraitPhoto), so either side is him exactly, seen at a glance:
 *
 *   1  the engineer: set in code, a grid of uCells characters across, each
 *      the colour of his photograph where it stands and the heavier the more
 *      light there is (on a light coin, uOnDark 0, the more dark), over the
 *      photograph itself, dimmed (lightened on a light coin), so from where
 *      it is seen it is his picture, and close to, it is all characters;
 *   2  the artist: a low-poly mesh of him, each facet flat, the colour of his
 *      photograph at its middle, a touch lighter or darker than the next as a
 *      modelled surface is, the wire of its edges faint over it.
 */
const ASCII_RAMP = ASCII.ramp.length.toFixed(1), ASCII_ALL = (ASCII.ramp.length + ASCII.scramble.length).toFixed(1);
const FACE_FRAGMENT = /* glsl */ `
uniform vec3 uColor, uShade, uHighlight, uMark, uAsciiInk, uAsciiHot;
uniform float uRoughness, uMarkOpacity, uMode, uOnDark, uCells, uTime, uWipe, uMorph, uGlint;
uniform sampler2D uMask, uMaskOld, uGlyphs, uPhoto, uMorphA, uMorphB;
varying vec3 vView, vNormal;
varying vec2 vUv;
${SURFACE_LIGHTING}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 engineer(vec2 uv) {
  vec2 grid = uv * uCells, cell = floor(grid), local = fract(grid);
  // The character's colour: his, averaged over its cell; and its weight, by how light (or dark) that is.
  vec4 tone = texture2D(uPhoto, (cell + .5) / uCells, 2.5);
  float light = dot(tone.rgb, vec3(.2126, .7152, .0722)), level = mix(1.0 - light, light, uOnDark);
  float index = floor(clamp(level * 1.15, 0.0, 1.0) * (${ASCII_RAMP} - 1.0) + .5);
  float glyph = smoothstep(.08, .55, texture2D(uGlyphs, vec2((index + clamp(local.x, .04, .96)) / ${ASCII_ALL}, local.y)).a);
  vec4 here = texture2D(uPhoto, uv);
  vec3 ground = mix(mix(here.rgb, vec3(1.0), .45), here.rgb * .6, uOnDark);
  vec3 type = mix(tone.rgb * .5, min(tone.rgb * 1.3 + .05, vec3(1.0)), uOnDark);
  return vec4(mix(ground, type, glyph), here.a);
}
vec2 jitter(vec2 v) { return v + (vec2(hash(v), hash(v + 17.3)) - .5) * .55; }
vec3 bary(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 v0 = b - a, v1 = c - a, v2 = p - a;
  float d = v0.x * v1.y - v1.x * v0.y;
  float y = (v2.x * v1.y - v1.x * v2.y) / d, z = (v0.x * v2.y - v2.x * v0.y) / d;
  return vec3(1.0 - y - z, y, z);
}
vec4 artist(vec2 uv) {
  float n = uCells * 1.9;
  vec2 g = uv * n, c = floor(g);
  vec2 p00 = jitter(c), p10 = jitter(c + vec2(1.0, 0.0)), p01 = jitter(c + vec2(0.0, 1.0)), p11 = jitter(c + vec2(1.0, 1.0));
  // Which of the cell's two triangles (split corner to corner) this is in, and how near its edges.
  vec3 b1 = bary(g, p00, p10, p11), b2 = bary(g, p00, p11, p01);
  bool first = min(b1.x, min(b1.y, b1.z)) >= min(b2.x, min(b2.y, b2.z));
  vec3 b = first ? b1 : b2;
  vec2 mid = (first ? (p00 + p10 + p11) : (p00 + p11 + p01)) / 3.0 / n;
  vec4 tone = texture2D(uPhoto, mid, .5);
  float shade = 1.0 + (hash(c + (first ? .3 : .7)) - .5) * .1;
  float wire = 1.0 - smoothstep(0.0, .045, min(b.x, min(b.y, b.z)));
  return vec4(tone.rgb * shade * (1.0 - wire * .16), smoothstep(.35, .65, tone.a));
}
vec4 portrait(vec2 uv) {
  vec4 drawn = uMode < 1.5 ? engineer(uv) : artist(uv);
  float rim = 1.0 - smoothstep(.002, .005, abs(length(vUv - .5) - .468));
  return vec4(mix(drawn.rgb, uAsciiInk, rim * (1.0 - drawn.a)), max(drawn.a, rim * .85));
}
/**
 * The tool's mark. One changed in view (paintFace: off the rope) is printed on: a ring of light runs out from the
 * middle to the rim (uWipe 0 → 1), the new mark inside it and the old outside, so the change is seen, not a swap.
 */
vec4 printed() {
  vec4 now = texture2D(uMask, vUv);
  if (uWipe >= 1.0) return now;
  vec4 before = texture2D(uMaskOld, vUv);
  float r = length(vUv - .5) * 2.0, front = uWipe * 1.08;
  vec4 mark = mix(before, now, 1.0 - smoothstep(front - .02, front, r));
  float ring = (1.0 - smoothstep(0.0, .03, abs(r - front))) * (1.0 - uWipe);
  return vec4(mix(mark.rgb, uAsciiHot, ring), max(mark.a, ring));
}
/** Smooth noise, 0 → 1, for stirring the marks as they melt. */
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
/**
 * One mark melting into another (uMode 3: the about's five years, uMorph 0 → 1). Each mark's shape is how far a
 * point is from its edge (coinMarks morphField: a half at the edge); the two are mixed and cut at a half, so the one
 * shape flows into the other. The change runs out from the middle of the face, the rim last; and while a point is
 * changing, it is liquid: its shape stirred by two drifting noises and a fine ripple running out, smeared a little
 * sideways with them. Each point takes one mark's colours or the other's (wholly the first's at the start and the
 * second's at the end, and between, whichever it is deeper in), with a fine seam of light where they meet; round the
 * moving shape, its outline echoes out over the face in fine rings of its colours, as ink rings out in water; and a
 * front of light runs out across the whole face with the change, as if the coin were being struck again.
 */
vec4 morphed() {
  float r = length(vUv - .5) * 2.0;
  float t = smoothstep(0.0, 1.0, clamp(uMorph * 1.3 - r * .3, 0.0, 1.0)), live = sin(3.14159265 * t);
  vec2 drift = vec2(uTime * .33, -uTime * .27);
  vec2 warp = vec2(vnoise(vUv * 5.0 + drift + 3.1), vnoise(vUv * 5.0 - drift + 7.7)) - .5;
  vec2 uv = vUv + warp * .035 * live;
  vec4 from = texture2D(uMorphA, uv), to = texture2D(uMorphB, uv);
  float stir = (vnoise(vUv * 7.0 + drift) - .5) * .9 + (vnoise(vUv * 15.0 - drift * 1.6) - .5) * .45;
  float ripple = sin(r * 34.0 - uTime * 6.0 - uMorph * 20.0);
  float edge = mix(from.a, to.a, t) + (stir * .055 + ripple * .01) * live;
  float soft = fwidth(edge) * .8 + 1e-4, shape = smoothstep(.5 - soft, .5 + soft, edge);
  float own = t - .5 + ((to.a - from.a) * 1.2 + stir * .06) * live, swap = fwidth(own) + 1e-4;
  vec3 colour = mix(from.rgb, to.rgb, smoothstep(-swap, swap, own));
  float seam = (1.0 - smoothstep(swap, swap * 2.5, abs(own))) * live;
  colour = mix(colour, uAsciiHot, seam * .8);
  // The echoes: a ring at every step out from the edge, moving out with the clock, fading with the distance.
  float beyond = .5 - edge, ring = beyond / .038 - uTime * 1.2, gap = abs(fract(ring + .5) - .5), fine = fwidth(ring) + 1e-4;
  float echo = (1.0 - smoothstep(fine * .9, fine * 2.4, gap)) * smoothstep(0.0, .02, beyond) * (1.0 - smoothstep(.03, .16, beyond)) * live;
  vec3 echoColour = mix(from.rgb, to.rgb, t);
  float reach = (uMorph * 1.3 - .5) / .3, front = (1.0 - smoothstep(0.0, .02, abs(r - reach))) * sin(3.14159265 * uMorph) * .35 * step(r, .985);
  vec3 lit = mix(uAsciiHot, echoColour, echo / max(echo + front, 1e-4));
  return vec4(mix(lit, colour, shape), max(shape, max(echo * .85, front)));
}
void main() {
  vec3 color = shadeSurface(vView, normalize(vNormal));
  vec4 mark = uMode > 2.5 ? morphed() : uMode > .5 ? portrait(vUv) : printed();
  vec3 face = mix(color, mark.rgb, mark.a * uMarkOpacity);
  // A glint (uGlint 0 → 1): a band of light (the letters' own glint) run once across the face, corner to corner, as a new coin catches it.
  float band = (vUv.x + vUv.y) * .5 - (uGlint * 1.5 - .25);
  face += uHighlight * exp(-band * band / .0035) * sin(3.14159265 * uGlint) * .9;
  gl_FragColor = vec4(face, 1.0);
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
    /** The coin's tour of the tools on the rope (ropeTour.js), and the spring of its lean (balance). */
    this.tour = null;
    this.balanceLean = { a: 0, v: 0 };
    /** Off the rope: where it stood on it and the tool it showed (leaveRope), to go back to; null once it is on the book again. */
    this.seat = null;
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
    /** The hop (stepHop): 'rope' (on it), 'up' (to the card), 'card' (on it), 'down' (back to the rope), how far through it is, and where it is `heading` ('card' or 'rope'). */
    this.hop = { phase: 'rope', t: 0, start: null };
    /** How far the ring of reviews round the coin is open (0 → 1, by the clock: it opens once the coin is on the card). */
    this.ringOpen = 0;
    this.aboutTilt = { x: 0, y: 0, rest: 0 };
    /** The reader's hand on the coin on the card: its turn and spin, whether held, the pointer over it, a tap's ring. */
    this.coinHand = { angle: 0, spin: 0, held: false, over: false, from: 0, target: null, rest: 0 };
  }

  get mounted() { return Boolean(this.renderer); }

  mount(canvas) {
    if (this.renderer) return true;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      perf.renderer('stage', this.renderer);
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
    this.puzzle = new Puzzle();
    this.puzzle.paint(this.palette);
    this.makeCoin();
    this.band = new Band(this.coinScene);
    this.band.paint(this.palette);
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
    this.coin.traverse(object => { object.geometry?.dispose(); });
    this.faces.forEach(face => face.material.dispose());
    this.asciiTextures?.forEach(texture => texture.dispose());
    this.band?.dispose();
    this.puzzle?.dispose();
    this.puzzle = null;
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
    // The opening is over: the work held back for it may start (gpuWork.afterLoader).
    siteSettled();
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
    // (Not before the loader has gone: the book is not on the first screen, and compiling it would stall the loader.)
    if (!this.bookWarm) { this.bookWarm = true; afterLoader(() => this.warm(this.workScene, this.book?.group), 'book shaders'); }
    this.renderUntil = performance.now() + 200;
  }

  /**
   * The about, measured by components/about:
   * `{ top, height, vh, card, line, piece, stops, faces, onTransition }` — `top` and `height` in page px; `card` and
   * `piece` the coin's places there (on the card, and where it leaves for the process), and `line` its place through the
   * five years (the wheel), all `{ x, y, r }` in px on the about's pinned screen; `stops` how many stops the five
   * years have and `faces` the tool of each.
   */
  setAbout(about) {
    this.about = about;
    this.aboutKey = null;
    if (!this.renderer || !about) return;
    // What is engraved round the ring the coin becomes, after the process (stepBand).
    if (about.more && this.band && this.band.lines !== about.more.engraving) this.band.engrave(about.more.engraving);
    // The ring of glass round it on the card (wide screens: on a narrow one the reviews run as a ticker, components/about).
    if (about.ring && !this.ring) {
      this.ring = new ReviewRing(this.coinScene, about.ring);
      this.ring.paint(this.palette);
      this.ring.setView(this.viewW ?? window.innerWidth, this.viewH ?? window.innerHeight);
    }
    // Its faces drawn now, while nothing moves (the portrait's engraving takes a moment).
    [MONOGRAM, ...about.faces].forEach(face => this.maskFor(face));
    // (And the five years' marks as shapes to melt, one at a time, a little after: each is a moment's work.)
    about.faces.forEach((face, i) => setTimeout(() => this.morphFor(face), 400 + i * 120));
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

  /**
   * The next place after position `from` that shows a page, how long the turn there takes, and when in it the
   * page on show changes (`change`, s: as the book comes half a place from it).
   */
  nextStep(from) {
    const count = this.work?.projects.length ?? 1;
    const to = itemAt(from + 1, count).cover ? from + 2 : from + 1;
    const duration = SPIN.turn * (to - from > 1 ? SPIN.covers : 1);
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const x = (lo + hi) / 2; if (spinEase(x) < 1 - .5 / (to - from)) lo = x; else hi = x; }
    return { from, to, clock: 0, duration, change: duration * hi };
  }

  /**
   * Whether the book, turning by itself, may turn on from the page it rests on: once the coin has been along all
   * of the project's tools (the tour, ropeTour.js), so a project with many is on show as long as they take; with no
   * coin on the rope, after SPIN.dwell.
   */
  turnDue(dt) {
    if (this.tour) { this.rested = 0; return this.tour.done; }
    this.rested = (this.rested ?? 0) + dt;
    return this.rested >= SPIN.dwell;
  }

  /**
   * What the coin's tour is asked for (ropeTour stepTour): the project on show, or the one the book is turning to
   * by itself, with its tools. The coin goes to that one once the page is about to change: tossed so that it is at
   * the top of its toss as the tags change under it.
   */
  tourWant() {
    let project = this.active, ready = true;
    if (this.leafMode === 'spin' && this.spin) {
      const item = itemAt(this.spin.to, this.work.projects.length);
      if (!item.cover) {
        project = item.project;
        ready = project === this.active || this.spin.clock >= this.spin.change - HIGH_TIME / 2 - TOSS.crouch;
      }
    }
    return { project, tools: this.projectTools(project), ready, auto: this.autoplay };
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
    // (The about's screen counts as coming in from .02, the same margin stepHop starts the jump at: no flicker on the line.)
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
    return stationAt(i, count);
  }

  /** Where along the rope (0 → 1) the coin's place is while it is off it: where it last stood, or the first tool's tag. */
  seatAt() {
    return this.seat?.c ?? this.station(0, this.coinTools().length);
  }

  /** The coin standing on the rope at its place there, as it is now (px, without the pin): where it lands. */
  ropeSeat() {
    const line = this.ropeLine(), r = this.work.tools?.[0]?.r ?? this.dot.r;
    const s = this.seatAt();
    return { x: line.x0 + s * (line.x1 - line.x0), y: line.y + this.sagAt(s) - ROPE_HALF - r, r };
  }

  /**
   * Where the coin stands on the rope, or is coming down onto it (px on the pinned screen, and how far along the
   * rope): where the hop into the about leaves from.
   */
  ropeStand() {
    const line = this.ropeLine(), r = this.dot.r;
    const c = this.tour ? tourFooting(this.tour) : this.seatAt();
    return { x: line.x0 + c * (line.x1 - line.x0), y: line.y + this.sagAt(c) - ROPE_HALF - r, r, c };
  }

  /**
   * The coin on the rope, this frame, as its tour has it (ropeTour.js): standing on the rope where the rope is
   * under it, squatting to go, in the air over it turning end over end, flattened as it lands; or, staying on the
   * tool it shows, spun round its upright where it stands, or rolling along the rope on its edge. Standing it sways,
   * never still; it leans the way it is going, and a landing knocks it that way, to rock and catch itself (the
   * lean is a damped spring). The rope gives where the tour says (walk: RopeScrollbar and the tags follow it).
   */
  balance(dt, scroll) {
    const tour = this.tour, walk = this.walk, coin = this.coin;
    Object.assign(walk, { c: tour.rope.c, dip: tour.rope.dip, v: 0, dipV: 0 });
    const line = this.ropeLine(), span = line.x1 - line.x0, r = this.dot.r, spring = this.balanceLean;
    const time = performance.now() / 1000;
    const sway = tour.phase === 'air' ? 0 : (Math.sin(time * 1.7) * .6 + Math.sin(time * 3.1 + 1) * .4) * TIGHTROPE.sway;
    // (Leaning to the right is a turn clockwise: negative.)
    const want = reducedMotion ? 0 : sway - tour.lean * TIGHTROPE.lean;
    spring.v -= tour.kick * TIGHTROPE.kick;
    const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps, [w, z] = TIGHTROPE.balance;
    for (let i = 0; i < steps; i++) {
      spring.v += (w * w * (want - spring.a) - 2 * z * w * spring.v) * h;
      spring.a += spring.v * h;
    }
    const lean = spring.a;
    // About the point it stands on: its foot on the rope (where the rope is, sagging under it), its middle over it.
    const footX = line.x0 + tour.c * span, footY = -(line.y + tour.sag - ROPE_HALF + this.pinOffset(scroll));
    coin.position.set(footX - Math.sin(lean) * r * tour.sy, footY + Math.cos(lean) * r * tour.sy + tour.h * r, coin.position.z);
    coin.scale.set(r * tour.sx, r * tour.sy, r);
    // Leaning (and rolling, on its edge); end over end (about the line across it, its top going away from the
    // reader first); and spun, round its upright.
    coin.quaternion.setFromAxisAngle(this._zAxis ??= new THREE.Vector3(0, 0, 1), lean + TAU * tour.roll)
      .multiply((this._tumble ??= new THREE.Quaternion()).setFromAxisAngle(this._xAxis ??= new THREE.Vector3(1, 0, 0), -Math.PI * tour.turns))
      .multiply((this._twirl ??= new THREE.Quaternion()).setFromAxisAngle(this._yAxis ??= new THREE.Vector3(0, 1, 0), TAU * tour.twirl));
    // Its sides' marks: the one it came onto the rope on the usual way up, the other the other way up, to come up
    // right when it is turned end over end. Spun round its upright instead, the side turned away is set the way
    // the side in view is (changed only while it is turned away: a spin begins and ends square to the reader).
    const up = tour.phase === 'spin' ? mod(Math.round(tour.turns), 2) : null;
    this.faces[tour.base].rotation.z = up === 1 ? Math.PI : 0;
    this.faces[1 - tour.base].rotation.z = up === 0 ? 0 : Math.PI;
  }

  /**
   * The coin lands on the rope and its tour of the tools begins (ropeTour.js), from its place on the rope
   * (seatAt), showing `tool`, as it landed. Its two sides: the one facing the reader now (`base`), and the other,
   * which the toss turns up (balance sets their marks the way up that needs).
   */
  startRope(tool) {
    const tour = startTour(this.active, this.coinTools(), this.seatAt(), tool, reducedMotion ? TIGHTROPE.weight : this.walk.dip);
    tour.base = mod(Math.round(this.turn.land / Math.PI), 2);
    tour.clock = performance.now();
    this.balanceLean = { a: 0, v: 0 };
    return tour;
  }

  /**
   * The coin has left the rope (scrolled back onto the book, or jumping into the about). A toss in the air is
   * brought down; where it stood and the tool it showed are kept (seat), so it goes on from there, and comes back
   * to there, with nothing changing in view. Its sides are set back the usual way up: if it is on its other side,
   * that is the same as having turned over the usual way, about its upright (the base of its turn).
   */
  leaveRope() {
    const { c, tool, over } = endTour(this.tour);
    if (over) this.turn.land += Math.PI;
    this.faces.forEach(face => { face.rotation.z = 0; });
    this.seat = { c, tool };
    this.tour = null;
  }

  /** Off the rope: it stands empty, sagging by itself; the coin lands at its place on it (seatAt). */
  restRope() {
    const walk = this.walk, c = this.seatAt();
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
    // On its own: from rest, a step at a time, round and round, each once the coin has been along the page's tools.
    if (this.autoplay && this.leafMode === 'rest' && this.turnDue(dt)) {
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
        spin.clock = Math.min(spin.duration, spin.clock + dt);
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
    // Turned: it rests on the page (turnDue).
    if (this.leafMode === 'spin' && this.spin.clock >= this.spin.duration) {
      this.spin = null;
      this.leafMode = 'rest';
      this.rested = 0;
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
    this.band?.paint(this.palette);
    this.puzzle?.paint(this.palette);
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
    const photo = new THREE.CanvasTexture(portraitPhoto());
    photo.colorSpace = THREE.SRGBColorSpace;
    portraitPhoto(redraw(photo));
    this.asciiTextures = [glyphs, photo];
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
          uMask: { value: this.blankMask() }, uMaskOld: { value: this.blankMask() }, uWipe: { value: 1 },
          uMorphA: { value: this.blankMask() }, uMorphB: { value: this.blankMask() }, uMorph: { value: 0 }, uGlint: { value: 0 },
          uMode: { value: 0 }, uOnDark: { value: 0 }, uCells: { value: 42 }, uTime: { value: 0 },
          uGlyphs: { value: glyphs }, uPhoto: { value: photo },
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

  /**
   * A face (its mesh) showing `tool`'s mark, or Saad's face (PORTRAIT in ASCII, MESH in polygons), or (none)
   * nothing; or (LINE) the five years' mark, melting from one stop's to the next's as far as `aboutMorph` says.
   */
  paintFace(face, tool, wipe = false) {
    const u = face.material.uniforms;
    if (tool === LINE) {
      const { from, to, t } = this.aboutMorph ?? {};
      face.userData.tool = LINE;
      u.uMode.value = from ? 3 : 0;
      if (from) { u.uMorphA.value = this.morphFor(from); u.uMorphB.value = this.morphFor(to); u.uMorph.value = t; }
      return;
    }
    const mode = tool === PORTRAIT ? 1 : tool === MESH ? 2 : 0;
    const next = mode || !tool ? null : tool, previous = face.userData.tool === LINE ? null : face.userData.tool ?? null;
    u.uMode.value = mode;
    if (next !== previous) {
      face.userData.tool = next;
      // A mark changing in view on a face that had one is printed on from the middle out; otherwise it is simply there.
      if (wipe && next && previous) { u.uMaskOld.value = u.uMask.value; u.uWipe.value = 0; } else u.uWipe.value = 1;
    }
    u.uMask.value = next ? this.maskFor(next) : this.blankMask();
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
    // (What the coin says in the process: set in the ground's colour, cut through the coin; coinWords.)
    if (tool === MINE || tool === YOURS) return this.wordsFor(tool);
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

  /** The coin's words in the process (coinWords), as a face's mark: drawn again once the display face is in. */
  wordsFor(words) {
    const colour = this.palette.ground, key = `${words}|${colour}`;
    if (this.masks.has(key)) return this.masks.get(key);
    const canvas = coinWords(document.createElement('canvas'), colour, -1, words), texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.masks.set(key, texture);
    document.fonts?.ready.then(() => {
      coinWords(canvas, colour, -1, words);
      texture.needsUpdate = true;
      this.renderUntil = performance.now() + 100;
    });
    return texture;
  }

  /**
   * What the coin says at `m` in the process (processTransition wordTurn, coinWords), as a face's mark: one canvas, drawn
   * again only as the scroll moves a turn along, and left alone between them.
   */
  coinSays(m) {
    const turn = wordTurn(m, reducedMotion), ground = this.palette.ground;
    let texture = this.masks.get('words:said');
    if (!texture) {
      texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      this.masks.set('words:said', texture);
      this.saidKey = null;
      // (Drawn again once its face is in.)
      loadWordsFace().then(() => { this.saidKey = null; this.renderUntil = performance.now() + 100; });
    }
    const moving = turn && turn.u < 1, u = moving ? Math.round(turn.u * SAID_STEPS) / SAID_STEPS : 1;
    const key = `${moving ? turn.from : ''}|${turn ? turn.to : -1}|${u}|${ground}`;
    if (key !== this.saidKey) {
      this.saidKey = key;
      coinWords(texture.image, ground, turn ? turn.from : -1, turn ? turn.to : -1, u);
      texture.needsUpdate = true;
    }
    return texture;
  }

  /**
   * The tool's mark as a shape to melt (coinMarks morphField), for the about's five years: empty until it is made
   * (it is made once its mark is drawn, a moment's work, after that), then the field.
   */
  morphFor(tool) {
    const dark = isDark(this.palette.figure), key = `morph|${tool}|${dark}`;
    if (this.masks.has(key)) return this.masks.get(key);
    const S = MORPH.size, texture = new THREE.DataTexture(new Uint8Array(S * S * 4), S, S, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.masks.set(key, texture);
    morphField(tool, dark, ({ data }) => {
      texture.image.data.set(data);
      texture.needsUpdate = true;
      this.renderUntil = performance.now() + 100;
    });
    return texture;
  }

  /** What the coin turns through in the work: the project on show's tools, or with none, the skills. */
  coinTools() {
    return this.active >= 0 ? this.projectTools(this.active) : COIN_SKILLS;
  }

  /**
   * Another tool than `tool`, for the coin to turn up as it is tossed into the about: the next of the project on
   * show's, or (that has one only) of the skills.
   */
  otherTool(tool) {
    const tools = this.coinTools();
    if (tools.length > 1) return tools[mod(tools.indexOf(tool) + 1, tools.length)];
    return COIN_SKILLS.find(skill => skill !== tool) ?? tool;
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
    if (!renderer || !object) return Promise.resolve();
    // Hidden or not, everything under `object` is compiled, a piece a frame (gpuWork.js).
    return warmGently(renderer, scene, camera, object);
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
    if (this.tour) this.leaveRope();
    this.seat = null;
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
    let drawn = 0;
    const count = () => { drawn += this.renderer.info.render.calls; };
    this.renderer.clear();
    this.renderer.render(this.workScene, this.camera);
    count();
    // The coin over everything, except while it lies in its seat on the cover: then it is part of the book.
    if (!(this.coinSeated && this.coin.visible && this.pose?.onBook)) this.renderer.clearDepth();
    // The process's puzzle (the coin in pieces), under the head's line only.
    if (this.puzzle?.group.visible) {
      const height = this.viewH || window.innerHeight, { top = 0, bottom = height } = this.puzzleClip ?? {};
      const below = Math.min(height, bottom), above = Math.max(0, Math.min(below, top));
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(0, height - below, this.viewW || window.innerWidth, below - above);
      this.renderer.render(this.puzzle.scene, this.camera);
      count();
      this.renderer.setScissorTest(false);
    }
    this.renderer.render(this.coinScene, this.camera);
    count();
    this.renderer.clearDepth();
    this.renderer.render(this.uiScene, this.camera);
    count();
    // Nothing on it: a full-screen sheet of nothing the browser need not blend over the page.
    const empty = drawn === 0;
    if (empty !== this.canvasEmpty) { this.canvasEmpty = empty; this.renderer.domElement.style.visibility = empty ? 'hidden' : ''; }
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

  /* ----- the process: the puzzle --------------------------------------- */

  /**
   * The process, laid out by components/process: `{ top, height, vh, clip, disc, spots, labels, tall }` — its place on
   * the page (px); how far down its pinned screen the puzzle starts (`clip`: the head's line); and on the pinned screen
   * the coin's place, `{ x, y, r }`, where each of its eight outer pieces goes as it comes apart (`spots`), what each is
   * (`labels`), and whether the screen is upright (Puzzle build).
   */
  setProcess(process) {
    this.process = process;
    this.puzzleBuilt = false;
    this.renderUntil = performance.now() + 100;
  }

  /**
   * The process, this frame (processTransition has the choreography, all of it with the scroll). The coin comes over
   * from the five years to its place in the middle of this screen, face on, his words on it (stepAbout: until then it
   * is the about's). There, once the light starts to show its seams, the puzzle takes
   * over from it (Puzzle place): the coin itself in pieces, put together, the same size, thickness and light, so what
   * changes in view is only the seams coming up; it opens, scatters and is drawn back in, and once its seams have shut
   * again the coin takes over from it, where it is, and a glint runs over it. Returns whether to draw.
   */
  stepProcess(dt, scroll) {
    const process = this.process, coin = this.coin, puzzle = this.puzzle;
    if (!process || !puzzle) return false;
    const vh = process.vh, m = (scroll - process.top) / vh, end = (process.height - vh) / vh;
    // (Before it the about has the coin, and after it the ring's screen does: stepBand.)
    if (m <= -1 || m > end) {
      if (puzzle.group.visible) puzzle.group.visible = false;
      return this.processOn !== (this.processOn = false);
    }
    this.processOn = true;
    const t = processTransition(m, reducedMotion);
    const off = clamp(scroll, process.top, process.top + process.height - vh) - scroll;
    const { disc } = process;
    // (Until it has come over from the five years, the coin is the about's: stepAbout.)
    if (m < 0) {
      if (puzzle.group.visible) puzzle.group.visible = false;
      return true;
    }
    // The coin itself, whenever it is whole: here while its seams are shut.
    if (t.reveal <= .001) {
      puzzle.group.visible = false;
      coin.visible = true;
      coin.position.set(disc.x, -(disc.y + off), 0);
      coin.scale.setScalar(disc.r);
      coin.quaternion.identity();
      this.aligner.rotation.set(0, 0, 0);
      this.ring?.hide();
      // What it says on both sides (whichever is up), face on (coinSays); and once it is whole again, a glint run over it.
      this.faces.forEach(side => {
        this.paintFace(side, YOURS);
        side.material.uniforms.uMask.value = this.coinSays(m);
        side.material.uniforms.uMarkOpacity.value = 1;
        side.material.uniforms.uGlint.value = t.glint;
      });
      this.spinner.rotation.y = Math.round(this.spinner.rotation.y / Math.PI) * Math.PI;
      return true;
    }
    // Opened up: the puzzle, as thick as the coin is at its size.
    coin.visible = false;
    this.ring?.hide();
    if (!this.puzzleBuilt) {
      const body = this.coinBody.geometry;
      body.computeBoundingBox();
      puzzle.build(process, (body.boundingBox.max.z - body.boundingBox.min.z) * disc.r);
      this.puzzleBuilt = true;
    }
    puzzle.group.visible = true;
    // (Cut off at the head's line as its screen comes up, and at the head, which stays, as it scrolls away; and at the
    // foot of its screen.)
    this.puzzleClip = { top: off >= 0 ? process.clip + off : process.clip, bottom: off + vh };
    puzzle.place({ m, off, t, words: this.coinSays(m), reduced: reducedMotion });
    return true;
  }

  /* ----- after the process: the ring -------------------------------- */

  /**
   * The coin, after the about's pinned screen, becoming a ring (Band) with the band of words threaded through it
   * (moreTransition has the choreography; components/about: `about.more`, `{ top, height, vh, spot, band, engraving }`:
   * its pinned screen's place on the page, and on it the ring's place and size, `{ x, y, r }`, and the band of words'
   * box, `{ top, bottom, left, right }`, px; and what is engraved round it). All of it with the scroll:
   *
   *   arrive   the coin following the reader down out of the process (the puzzle shut into it again: stepProcess) to the middle of the
   *            new screen, face on, turning once round its middle as it comes;
   *   melt     a ring of light running out over its face to the rim, the reader's words washed off before it (its faces'
   *            print-on wipe, run backwards and by the scroll);
   *   form     the plain coin, swapped for the ring's first shape (face on, they are the same), punched out: a hole
   *            opening at its middle, then its rim deepening into a band as it tips into its lean (BAND_POSE), turning;
   *   engrave  the words written round it;
   *   thread   the band of words, as the page draws it out through the ring, threaded: what of the ring is behind it
   *            seen only faintly through it.
   *
   * After that it turns round its axis as the reader scrolls, and goes with the screen once it scrolls on. Returns
   * whether to draw.
   */
  stepBand(scroll) {
    const about = this.about, more = about?.more, band = this.band;
    if (!more || !band) return false;
    const vh = more.vh, m = (scroll - more.top) / vh;
    const off = clamp(scroll, more.top, more.top + more.height - vh) - scroll;
    const R = more.spot.r / BAND.outer, x0 = more.spot.x, y0 = more.spot.y + off;
    const faces = this.faces;
    // (The coin's faces, given back their own mark once the scroll has gone back up past the wash.)
    const unwash = () => {
      if (!this.bandWashed) return;
      this.bandWashed = false;
      faces.forEach(face => { face.material.uniforms.uWipe.value = 1; });
    };
    if (m <= -1 || y0 < -R * 2.4) {
      unwash();
      const was = this.bandOn;
      this.bandOn = false;
      if (band.group.visible) band.hide();
      if (was && m > -1) this.coin.visible = false;
      return was;
    }
    this.bandOn = true;
    const t = moreTransition(m, reducedMotion);
    const zAxis = this._zAxis ??= new THREE.Vector3(0, 0, 1);
    if (t.form <= 0) {
      // The coin itself: on its way down to the middle of the screen, then there, face on, its mark washed off.
      band.hide();
      // (From its place in the puzzle, scrolling away with the process's screen.)
      const process = this.process;
      const end = process ? process.top + process.height - process.vh : about.top + about.height - about.vh;
      const from = process ? process.disc : about.piece;
      const fromY = from.y + (end - scroll);
      const e = t.arrive;
      const x = from.x + (x0 - from.x) * e, y = fromY + (y0 - fromY) * e, r = from.r + (R - from.r) * e;
      this.coin.visible = true;
      this.coin.position.set(x, -y, 0);
      this.coin.scale.setScalar(r);
      // (Face on; and, as it comes, once round its own middle, a coin set down spinning.)
      this.coin.quaternion.setFromAxisAngle(zAxis, reducedMotion ? 0 : -TAU * e);
      this.aligner.rotation.set(0, 0, 0);
      this.ring?.hide();
      // (The reader's words, both sides, as the process left them: not whatever the journey above gave its faces.)
      faces.forEach(face => { this.paintFace(face, YOURS); face.material.uniforms.uMarkOpacity.value = 1; face.material.uniforms.uGlint.value = 0; });
      if (t.melt > 0) {
        this.bandWashed = true;
        const mark = this.maskFor(YOURS), blank = this.blankMask();
        faces.forEach(face => {
          const u = face.material.uniforms;
          u.uMode.value = 0;
          u.uMaskOld.value = mark;
          u.uMask.value = blank;
          u.uWipe.value = t.melt;
        });
      } else unwash();
      return true;
    }
    // The ring: punched out of the coin, tipping into its lean, engraved; turning round its axis as the reader goes on.
    unwash();
    this.coin.visible = false;
    this.ring?.hide();
    const pose = this._bandPose ??= new THREE.Quaternion().setFromEuler(new THREE.Euler(...BAND_POSE.euler, 'YXZ'));
    const turned = this._bandTurned ??= new THREE.Quaternion();
    turned.slerpQuaternions(this._still ??= new THREE.Quaternion(), pose, t.tilt);
    const formed = Math.max(0, m - MORE.FORM[1]);
    // The band of words as it is drawn out through the ring: a thread from its middle to the rails, then opening.
    const b = more.band, cy = (b.top + b.bottom) / 2 + off, half = Math.max(1.5, (b.bottom - b.top) / 2 * t.open);
    band.place({
      x: x0, y: y0, r: R, quaternion: turned,
      spin: reducedMotion ? BAND_POSE.spin : BAND_POSE.spin * t.tilt + formed * vh * BAND.turn,
      hole: smootherStep(clamp(t.form / MORE.hole, 0, 1)), depth: t.tilt, engrave: t.engrave,
      band: t.thread > 0 ? { top: cy - half, bottom: cy + half, left: x0 - (x0 - b.left) * t.thread, right: x0 + (b.right - x0) * t.thread } : null,
      viewH: this.viewH || window.innerHeight, dpr: this.renderer.getPixelRatio(),
    });
    return true;
  }

  /** How far the about's screen has come up at this scroll: 0 its top still below the screen, 1 pinned (and on). */
  aboutEnterAt(scroll) {
    const about = this.about;
    return about ? clamp(1 - (about.top - scroll) / about.vh, 0, 1) : 0;
  }

  /** Tell components/about what the page shows (aboutTransition), when that changes. */
  reportAbout(state) {
    // (How far through the five years finer than the rest: the page sets its words and the coin's trail by it.)
    const key = [state.enter, state.title, state.lede, state.card, state.line, state.lineIn, state.lineOut, state.stopOn]
      .map(value => value.toFixed(4)).join('|') + '|' + state.along.toFixed(5);
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
   *   line    over to its place in the five years, tipping back and leaning
   *           as it goes, a wheel seen from the side (WHEEL); there it
   *           holds still, and the mark on its face melts from each stop's
   *           tool into the next's;
   *   toProcess on to the process: straightening up out of the wheel, face on,
   *           across to its place in the middle of the room and down to its
   *           size there, its mark fading off and its face starting to say how a
   *           project goes (coinSays).
   *
   * Before the about it does nothing but note where the coin stands on the
   * rope, for the jump to leave from. Returns whether to draw.
   */
  stepAbout(dt, scroll) {
    const about = this.about, coin = this.coin;
    if (!about || (this.aboutEnter <= 0 && this.hop.phase === 'rope')) {
      // On the rope (on the pinned work's screen, without the pin): where it will jump from.
      // (On its feet there: not where a toss has it in the air.)
      if (coin.visible) this.aboutFrom = this.work?.rope && this.ropeLine() && (this.tour || this.seat) ? this.ropeStand()
        : { x: coin.position.x, y: -coin.position.y - (this.work ? this.pinOffset(scroll) : 0), r: coin.scale.x, c: this.walk.c };
      if (!this.aboutOn) return false;
      this.aboutOn = false;
      this.aboutCame = this.aboutTurned = this.hopMarks = null;
      if (!this.tour) this.faces.forEach(mesh => { mesh.rotation.z = 0; });
      this.ring?.hide();
      this.reportAbout(aboutTransition(-1, about?.stops ?? 1, reducedMotion));
      return true;
    }
    this.aboutOn = true;
    const vh = about.vh, n = about.stops;
    const q = clamp((scroll - about.top) / vh, 0, (about.height - vh) / vh) + this.aboutEnter - 1;
    const state = aboutTransition(q, n, reducedMotion);
    const mix = (a, b, t) => a + (b - a) * t;
    const { card, line } = about;
    this.reportAbout(state);
    // The about's screen: coming up from below (its top's distance down the screen), pinned (0), or scrolled away.
    const offset = clamp(scroll, about.top, about.top + about.height - vh) - scroll;
    const gone = offset < -vh - about.card.r;
    if (gone) { coin.visible = false; this.ring?.hide(); return this.aboutWasGone !== (this.aboutWasGone = true); }
    this.aboutWasGone = false;

    // (A curve from `a` through `b` to `c`, `t` of the way: past its end for a `t` over 1.)
    const curve = (a, b, c, t) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * b.x + t * t * c.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * b.y + t * t * c.y });
    // (Out past where it is going and back, `over` of the way: an ease that overshoots.)
    const past = (t, over) => 1 + (over + 1) * (t - 1) ** 3 + over * (t - 1) ** 2;
    // (Arriving with a wobble: past, back, and still, as a thing set down does, `u` of the way.)
    const settle = (u, swing) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-5 * u) * Math.cos(swing * u) * (1 - u ** 6));
    let x, y, r, roll = 0, tipK = 0, leanK = 0;
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
        // Over to the five years: a swoop up and round, down into its place, a touch past it and back, growing (and
        // a touch over its size) and spinning into place; then, already showing its first mark, it is set down as
        // the wheel, tipping and leaning with a wobble, as a wheel stood up does.
        const p = clamp(state.p, 0, 1), go = reducedMotion ? e : past(p, 1.05);
        ({ x, y } = curve(card, { x: mix(card.x, line.x, .62), y: Math.min(card.y, line.y) - vh * .15 }, line, go));
        r = mix(card.r, line.r, reducedMotion ? e : past(p, 1.7));
        if (!reducedMotion) roll = (1 - past(p, 0)) * .9;
        const u = clamp((p - .3) / .7, 0, 1);
        tipK = reducedMotion ? e : settle(u, 9);
        leanK = reducedMotion ? e : settle(u, 7);
      } else if (state.seg === 'line') {
        // A wheel, in its place, holding still but for its mark melting from stop to stop; and while it does, it
        // breathes: swelling and lifting a touch, its face opening to the reader, rocking, and settling again.
        ({ x, y, r } = line);
        tipK = leanK = 1;
        if (!reducedMotion && state.travel > 0) {
          const breath = Math.sin(Math.PI * state.travel);
          r *= 1 + .045 * breath;
          y -= vh * .014 * breath;
          tipK = 1 - .11 * breath;
          roll = .055 * Math.sin(TAU * state.travel) * breath;
        }
      } else {
        // On to the process: straightening up out of the wheel, face on, as it goes across to its place in the middle of
        // the room and shrinks to its size there.
        const to = this.process?.disc ?? line;
        x = mix(line.x, to.x, e);
        y = mix(line.y, to.y, e);
        r = mix(line.r, to.r, e);
        tipK = leanK = 1 - e;
      }
      y += offset;
    }
    // In the air between the rope and the card (or crouched to go): the hop has it.
    const hopped = this.stepHop(dt, scroll, { x, y, r }, vh);
    if (hopped) ({ x, y, r, sx, sy, leap } = hopped);
    coin.visible = true;
    coin.position.set(x, -y, 0);
    coin.scale.set(r * sx, r * sy, r);
    this.aboutPose = { x, y, r };
    // Rolled about its own middle; and through the five years, a wheel seen from the side: tipped, its face turned
    // down to the right towards the reader, and leaning (WHEEL), so its face is an ellipse rising to the right, as
    // the page's words do.
    const zAxis = this._zAxis ??= new THREE.Vector3(0, 0, 1);
    coin.quaternion.setFromAxisAngle(zAxis, roll);
    if (tipK || leanK) {
      const d = Math.PI / 180;
      const lean = this._lean ??= new THREE.Quaternion(), tip = this._tip ??= new THREE.Quaternion();
      lean.setFromAxisAngle(zAxis, WHEEL.lean * d * leanK);
      tip.setFromAxisAngle(this._xAxis ??= new THREE.Vector3(1, 0, 0), WHEEL.tip * d * tipK);
      coin.quaternion.premultiply(tip).premultiply(lean);
    }

    // Its faces: the tool the jump off the rope turned up (below), the portrait, each stop's tool, the process. The
    // next comes onto the side facing away, so no face ever changes in view.
    this.aboutCame ??= this.seal.shown ?? COIN_SKILLS[0];
    this.aboutTurned ??= reducedMotion ? this.aboutCame : this.otherTool(this.aboutCame);
    const list = this.aboutList = aboutFaces(this.aboutTurned, PORTRAIT, MINE);
    // The five years' face: the mark of the stop the coin is at, melting into the next's as the reader goes on.
    const stopAt = Math.min(n - 1, state.stop), melt = state.seg === 'line' ? state.melt : 0;
    this.aboutMorph = { from: about.faces[stopAt], to: about.faces[Math.min(n - 1, stopAt + 1)], t: reducedMotion ? Math.round(melt) : melt };
    // On the card, once it has turned over to the portrait, it is the reader's to spin (stepHand): its two sides
    // are the two sides of Saad, his face in code (the engineer) and his face in polygons (the artist).
    const inHand = state.seg === 'card' && state.flips >= 1 - 1e-3 && !hopped;
    const spun = this.stepHand(dt, inHand, state.e);
    const turned = state.flips + spun / Math.PI;
    const base = this.flip.angle, at = Math.floor(turned + 1e-6);
    const face = i => (inHand ? (mod(i - 1, 2) === 0 ? PORTRAIT : MESH) : list[clamp(i, 0, list.length - 1)]);
    const front = Math.round(base / Math.PI) + at;
    if (hopped && turned < 1e-3) {
      // Tossed between the rope and the card, it turns up another tool, as a toss on the rope does: over into the
      // about, from the one it stood on the rope showing to another; and back onto the rope, to its tag's own again.
      // It goes end over end once, so its other side is seen on the way: that side takes the tool it is going to
      // (set the other way up, to be seen the right way up), and then, turned away in its turn, so does the first.
      const back = this.hop.heading === 'rope', to = back ? this.aboutCame : this.aboutTurned;
      const marks = this.hopMarks ??= [back ? this.aboutTurned : this.aboutCame, to];
      marks[Math.cos(TAU * ABOUT_COIN.turns * leap) > 0 ? 1 : 0] = to;
      marks.forEach((tool, side) => {
        const mesh = this.faces[mod(front + side, 2)];
        this.paintFace(mesh, tool);
        mesh.rotation.z = side ? Math.PI : 0;
      });
    } else {
      this.hopMarks = null;
      this.faces.forEach(mesh => { mesh.rotation.z = 0; });
      this.paintFace(this.faces[mod(front, 2)], face(at));
      this.paintFace(this.faces[mod(front + 1, 2)], state.seg === 'jump' || hopped ? face(at) : face(at + 1));
    }
    this.faces.forEach(side => {
      side.material.uniforms.uMarkOpacity.value = 1;
      side.material.uniforms.uGlint.value = 0;
    });
    this.spinner.rotation.y = base + Math.PI * turned;
    // On to the process: the last stop's mark fades off its face, and then it starts saying how a project goes. (Once
    // it has arrived, the process has what it says: stepProcess.)
    if (state.markOut > 0 && state.p < 1) {
      const u = this.faces[mod(front, 2)].material.uniforms, says = wordTurn(state.m, reducedMotion);
      u.uMarkOpacity.value = says ? 1 : 1 - state.markOut;
      if (says) {
        u.uMode.value = 0;
        u.uMask.value = this.coinSays(state.m);
        u.uWipe.value = 1;
      }
    }
    this.stepAscii(dt, inHand, card);
    // Which of his sides is up (null off the card), for the words under it to follow.
    const up = inHand ? face(Math.round(turned)) : null;
    if (up !== this.sideUp) { this.sideUp = up; about.onSide?.(up === PORTRAIT ? 'engineer' : up === MESH ? 'artist' : null); }

    // The reviews' ring round it: opening out from behind it once it has landed on the card and turned over to him, and folding back into
    // it as it leaves (for the five years, or back up to the rope), wherever it is.
    if (this.ring) {
      const scrolled = scroll - (this.ringScroll ?? scroll);
      this.ringScroll = scroll;
      // (Not until the coin has turned over to him: while it still shows the tool it came off the rope with, no ring.
      // Once it has, it stays open as he turns between his two sides, and folds away as the coin leaves the card.)
      const shown = (state.seg === 'card' && state.flips >= 1 - 1e-3) || state.seg === 'toLine';
      const want = this.hop.phase === 'card' && shown ? 1 : 0;
      // (Opening eases in; shutting is over in a moment, at a steady pace, with no long tail left round a coin already gone.)
      this.ringOpen = reducedMotion ? want
        : want ? this.ringOpen + (1 - this.ringOpen) * (1 - Math.exp(-dt * RING_GO.open)) : Math.max(0, this.ringOpen - dt / RING_GO.shut);
      // (Folding with the scroll over FOLD, the coin held still on the card, so it has gone before the coin moves at all.)
      const leaving = smootherStep(clamp((q - ABOUT_SCROLL.CARD) / (ABOUT_SCROLL.FOLD * RING_GO.done), 0, 1));
      const open = this.ringOpen * (1 - leaving);
      if (narrowScreen.matches || open < .001) this.ring.hide();
      else this.ring.place({
        x, y, r, open, dt, scrolled,
        spin: this.coinHand.spin, pointer: this.pointer, camera: this.camera, dpr: this.renderer.getPixelRatio(),
      });
    }

    // At rest on the card it sways a little by itself and leans toward the pointer.
    const tilt = this.aboutTilt, ease = 1 - Math.exp(-dt * 4);
    const resting = !reducedMotion && state.seg === 'card' ? 1 : 0;
    tilt.rest += (resting - tilt.rest) * (1 - Math.exp(-dt * 2.5));
    const W = this.viewW || window.innerWidth;
    tilt.y += (clamp((this.pointer.x - x) / (W * .4), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.y) * ease;
    tilt.x += (clamp((this.pointer.y - y) / (vh * .4), -1, 1) * ABOUT_COIN.tilt * tilt.rest - tilt.x) * ease;
    const t = performance.now() / 1000 * ABOUT_COIN.swaySpeed;
    const sway = ABOUT_COIN.sway * tilt.rest;
    this.aligner.rotation.set(TAU * ABOUT_COIN.turns * leap + tilt.x + sway * Math.sin(t * 1.3 + .5) * .6, tilt.y + sway * Math.sin(t), 0);
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
      Object.assign(hop, { phase: 'up', heading: 'card', t: was === 'down' ? 1 - hop.t : 0, launch: null, page: enter < 1 && take ? about.top : null });
    } else if ((was === 'up' || was === 'card') && (enter <= 0 || (enter < .98 && moved < 0 && !ours))) {
      // From where it was last drawn (kept on the screen: its place on the card may be scrolled away below already).
      const last = this.aboutPose ?? target, start = { x: last.x, y: Math.min(last.y, vh - last.r * .6), r: last.r };
      Object.assign(hop, { phase: 'down', heading: 'rope', t: was === 'up' ? 1 - hop.t : 0, start, launch: null, page: enter > 0 && take ? about.top - about.vh : null });
    }
    if (reducedMotion && hop.phase !== 'rope' && hop.phase !== 'card') hop.phase = hop.phase === 'up' ? 'card' : 'rope';
    const { phase } = hop;
    if (COIN_LOG && was !== phase) coinLog('hop', phase, `the coin ${was} → ${phase} (about enter ${enter.toFixed(3)}, scrolled ${moved.toFixed(0)}px)`);
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
      // (Down on the rope: it has the coin's weight, for the tour to take up from, startRope.)
      if (t >= 1) { hop.phase = 'rope'; this.walk.dip = TIGHTROPE.weight; }
    }
    return pose;
  }

  /**
   * The coin in the reader's hand on the card (components/about tells the
   * stage what the hand does: coinGrab, coinTurn, coinLet, coinTap). Held, it
   * turns as far as the hand moves; let go, it goes to the face the hand left
   * it for (`target`: his other side, or back as it was), by a spring. Left
   * alone, it turns over by itself every so often (HAND every), from one of his
   * sides to the other, the words under it following; not while the pointer is
   * on it, looking through it at him. Off the card (`inHand` false, or the
   * scroll taking it on: `e` near the card's end), it turns home to the
   * portrait, so what follows begins as it always does. Returns how far it is
   * turned by hand (rad, a whole number of turns once it is home, which is no
   * turn at all).
   */
  stepHand(dt, inHand, e) {
    const hand = this.coinHand;
    if (hand.held && inHand) return hand.angle;
    hand.held = false;
    const settling = inHand && e < .9;
    // Home to the portrait (a whole turn), off the card; on it, the face it was left for (or the nearest).
    if (!settling) { hand.target = Math.round(hand.angle / TAU) * TAU; hand.rest = 0; }
    hand.target ??= Math.round(hand.angle / Math.PI) * Math.PI;
    if (settling && !reducedMotion && !hand.over) {
      hand.rest += dt;
      if (hand.rest >= HAND.every) {
        hand.rest = 0;
        hand.target += Math.PI;
        hand.spin += HAND.tap * .6;
      }
    }
    const target = hand.target;
    const [w, z] = HAND.spring, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      hand.spin += (w * w * (target - hand.angle) - 2 * z * w * hand.spin) * h;
      hand.angle += hand.spin * h;
    }
    if (Math.abs(target - hand.angle) < 1e-4 && Math.abs(hand.spin) < 1e-3) {
      hand.spin = 0;
      hand.angle = target;
      // Settled on the portrait: a whole number of turns is no turn (on a tool, the turns say which tool, so they stay).
      if (Math.abs(mod(target + Math.PI, TAU) - Math.PI) < 1e-6) hand.angle = hand.target = 0;
    }
    return hand.angle;
  }

  /** components/about: the hand takes hold of the coin on the card (on the face it was on, or on its way to). */
  coinGrab() {
    const hand = this.coinHand;
    hand.from = hand.target ?? Math.round(hand.angle / Math.PI) * Math.PI;
    Object.assign(hand, { held: true, spin: 0 });
    this.renderUntil = performance.now() + 100;
  }

  /** The hand has moved `px` across it, holding it: it turns with it, as far as a little past his other side. */
  coinTurn(px) {
    const hand = this.coinHand;
    if (!hand.held) return;
    const most = HAND.most * Math.PI;
    hand.angle = hand.from + clamp(hand.angle + px * HAND.perPx - hand.from, -most, most);
    this.renderUntil = performance.now() + 100;
  }

  /**
   * Let go, the hand moving at `pxPerSecond`: turned far enough, or flicked, it goes over to his other side, the
   * way it was going, once (never spinning on round to the side it began on); else back as it was.
   */
  coinLet(pxPerSecond) {
    const hand = this.coinHand;
    if (!hand.held) return;
    hand.held = false;
    const moved = hand.angle - hand.from, spin = clamp(pxPerSecond * HAND.perPx, -HAND.fastest, HAND.fastest);
    const way = Math.abs(moved) > HAND.flip ? Math.sign(moved) : Math.abs(spin) > HAND.flick ? Math.sign(spin) : 0;
    hand.target = hand.from + way * Math.PI;
    hand.spin = way && Math.sign(spin) !== way ? 0 : spin;
    hand.rest = HAND.every - HAND.after;
  }

  /** The pointer over the coin on the card (`at`), or not (null): while it is, the coin waits to turn over by itself. */
  coinPoint(at) {
    this.coinHand.over = Boolean(at);
  }

  /** A tap on the coin: it turns over to his other side (a flick, settled there by stepHand). */
  coinTap() {
    const hand = this.coinHand;
    hand.held = false;
    hand.target = (hand.target ?? Math.round(hand.angle / Math.PI) * Math.PI) + Math.PI;
    hand.spin = HAND.tap;
    hand.rest = HAND.every - HAND.after;
  }

  /**
   * The faces' live part, this frame: the clock (the melting marks run on it), and how many characters across his
   * face in code is, for the coin's size on the card (about 7px a character: fine enough for his picture to be exact,
   * still big enough to be seen as type).
   */
  stepAscii(dt, inHand, card) {
    const now = performance.now(), cells = clamp(Math.round(card.r * 2 / 7), 34, 64);
    for (const face of this.faces) {
      const u = face.material.uniforms;
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

  /**
   * Console (coinLog 'stage'): where the coin is in its journey, and the mark on
   * each side as it turns. Only logged when one of them changes.
   */
  logCoin(flipTarget, sides) {
    const phase = this.coinPhase();
    const names = [0, 1].map(side => sides[side] ?? '-');
    coinLog('stage', `${phase}|${names.join('|')}`,
      `${phase} at k ${this.k.toFixed(3)}: side 0 shows ${names[0]}, side 1 shows ${names[1]} (turned ${(flipTarget / Math.PI).toFixed(3)} half-turns)`);
  }

  /** The coin's stage in its journey, by the scroll (k), for logCoin. */
  coinPhase() {
    const k = this.k;
    if (k < CENTRE.reach) return 'flying from the i to the middle';
    if (k < CENTRE.settle) return 'settling in the middle';
    if (k < STICK[1]) return 'sticking to the book';
    if (k < 2) return 'lying on the book';
    if (k < ROW.lift[1]) return 'flicked off the book';
    return this.balancing() ? 'on the rope' : 'in the row';
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
    /** The coin is on the rope this frame (its tour has its faces). */
    let onRope = false;
    const sides = [];
    // Off the rope (scrolled back toward the book, or jumping into the about), its tour is over.
    if (this.tour && !this.balancing()) this.leaveRope();
    // (Back on the book, it has no place on the rope to go back to: it lands at the first tag again.)
    if (this.k < OPEN.at) this.seat = null;
    if (this.k < 1) {
      flipTarget = turn.start + (turn.land - turn.start) * this.pose.yaw / Math.PI;
      // Still on the i, the dot shows the skills (SkillCoin, skillSpin.js), whatever project the stage has on show
      // (`active` is 0 from the first mount, so it is never "none"). The coin keeps that sequence and lands on the
      // skill the dot was showing, so its marks match the hero's, with no repeat where it lands.
      const landing = Math.round(turn.land / Math.PI);
      const skill = i => COIN_SKILLS[wrap(i, COIN_SKILLS.length)];
      seal.shown = skill(landing);
      Object.assign(seal, { project: -1, index: wrap(landing, COIN_SKILLS.length), hold: 0, turns: 0, progress: 0, flip: null });
      const n = Math.floor(flipTarget / Math.PI + 1e-6);
      sides[wrap(n, 2)] = skill(n);
      sides[wrap(n + 1, 2)] = skill(n + 1);
      // Sticking to the cover it turns over to its other face, the monogram (it has landed on its face by then).
      if (this.pose.onBook) sides[1 - wrap(landing, 2)] = MONOGRAM;
    } else {
      // Off the i it faces the reader, the first of the row: it turns over only with the row, to a new project's first tool.
      const state = rowState[0];
      // On the rope it is tossed to each of the project's tools in turn, by itself.
      const balancing = this.balancing(), roped = Boolean(this.work.rope);
      // With a rope to go to it does not turn with the row: it shows the tool it left the rope showing (the first
      // of the project's, before it has been on it), and the tour turns it over from there.
      flipTarget = turn.land + (roped ? 0 : state?.turn ?? 0);
      const facing = wrap(Math.round(turn.land / Math.PI), 2);
      const front = roped ? this.seat?.tool ?? this.coinTools()[0] : state?.front ?? seal.shown;
      sides[facing] = front;
      // Its other face is the monogram while it is on the book (it lands on it and lies monogram up).
      sides[1 - facing] = this.pose.onBook ? MONOGRAM : roped ? front : state?.back ?? seal.shown;
      if (roped || state) seal.shown = front;
      if (state && state.size < 1 && !balancing) this.coin.scale.setScalar(dot.r * Math.max(.001, state.size));
      if (balancing) {
        onRope = true;
        const want = this.tourWant();
        // (With reduced motion nothing is tossed: another project's first tool is simply there.)
        if (reducedMotion && this.tour && this.tour.project !== want.project) { this.leaveRope(); this.seat = null; }
        const tour = this.tour ??= this.startRope(this.seat?.tool ?? this.coinTools()[0]);
        // By the clock, not the frame: the same pace on a slow screen as a fast one.
        const now = performance.now(), line = this.ropeLine();
        const elapsed = reducedMotion ? 0 : Math.min(.25, (now - tour.clock) / 1000);
        tour.clock = now;
        const event = stepTour(tour, elapsed, want, { r: dot.r, span: line.x1 - line.x0, droop: this.walk.droop, weight: TIGHTROPE.weight });
        if (COIN_LOG && event) {
          coinLog('rope', `${event}|${now}`, event === 'land'
            ? `lands on ${tour.lit} (tag ${tour.at + 1} of ${tour.tools.length}, project ${tour.project})${tour.done ? ': the tour is done' : ''}`
            : event === 'toss' ? `tossed to ${tour.tools[tour.toss.to]}${tour.toss.high ? ', high: another project' : ''}`
              : event === 'spin' ? `spun where it stands: ${tourShown(tour)} again` : `rolls along to ${tourShown(tour)} again`);
        }
        // Its two sides, as the tour has them: the one it came onto the rope on, and the other.
        sides[tour.base] = tour.marks[0];
        sides[1 - tour.base] = tour.marks[1];
        seal.shown = tourShown(tour);
        need = true;
      }
      const shown = balancing ? this.tour.lit : null;
      if (shown !== this.toolShown) { this.toolShown = shown; this.onTool?.(shown); }
    }
    if (COIN_LOG) this.logCoin(flipTarget, sides);
    // On the rope a side only takes a new mark while it is turned away. Off it (the book open, the coin on its way
    // to the rope), a mark changing on the side in view is printed on from the middle out, never swapped. (Not in the
    // about: there its faces are the about's, stepAbout.)
    const inView = wrap(Math.round(flipTarget / Math.PI), 2), printed = !onRope && !this.aboutOn && this.k >= OPEN.at;
    sides.forEach((tool, side) => this.paintFace(this.faces[side], tool, printed && side === inView));
    for (const face of this.faces) {
      const u = face.material.uniforms;
      if (u.uWipe.value < 1) { u.uWipe.value = Math.min(1, u.uWipe.value + dt / WIPE.time); need = true; }
    }
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
    if (!this.balancing() && this.restRope()) need = true;
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
    // After it, the process: the coin taken apart and put back together (stepProcess).
    if (this.stepProcess(dt, scroll)) need = true;
    // After the process's pinned screen, the coin becomes the ring threaded through the band of words (stepBand).
    if (this.stepBand(scroll)) need = true;
    // In the contact, the coin is the letter's seal (stepContact), wherever its stand-in on the page is.
    if (this.stepContact(dt)) need = true;

    if (need) this.render();
  }
}

/** The one stage. Mounted by components/stage, fed by the hero and the journey. */
export const stage = new DotStage();
