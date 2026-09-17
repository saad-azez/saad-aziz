import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { EASE, reducedMotion } from '../../brand/motion.js';
import { useKarachiTime } from '../../lib/useKarachiTime.js';
import { PERSON } from '../../content/site.js';
import { sectionLink } from '../../lib/sectionLink.js';
import monogramRing from '../../assets/monogram-ring.svg?raw';
import RingButton, { RingBorder } from '../ui/RingButton.jsx';
import './SketchClock.css';

gsap.registerPlugin(DrawSVGPlugin);

/**
 * The sketched clock.
 *
 * The one live thing in the header. Its ring is the monogram's ring — the same
 * shape as the mark at the left of the header — with twelve hand-drawn hour
 * ticks around it, two hands and a wine second hand. At rest the hands tell
 * the time; opened, it shows as a pair of flip cards. It keeps Pakistan time. Inline SVG throughout,
 * animated with GSAP.
 *
 * There is exactly ONE clock drawing on the page. The small dial in the
 * header and the big clock in the middle of the viewport are the same SVG,
 * scaled and moved by GSAP; nothing is swapped, cross-faded or duplicated at
 * any point, so it cannot ever read as two clocks.
 *
 * It is also the navigation, and it says so the way an alarm clock does — as
 * a cartoon draws one ringing: little arcs of vibration pulse off both top
 * corners, where an old clock's two bells would be. The clock itself never
 * moves. At rest it rings in short bursts; under the pointer it stops.
 *
 * Idle    the face, ringing now and then, with the city beneath it.
 * Hover   the face grows a third, the ringing stops, and the sections take turns
 *         arriving on a curve under the ring — About, Work, Contact, Let's
 *         talk — each one a real link, the header's line dipping under them
 *         to make room. The cycle rests while the pointer is
 *         on a label. Rest there and not click, and an underline is drawn
 *         under the word: an invitation, not an instruction.
 * Click   the dial grows into a big clock, dead centre in the viewport. The
 *         page behind it is wiped away by a clock's own gesture: the second
 *         hand leaves the face and makes one full sweep round the viewport,
 *         and the ground follows it round like a radar trace; the twelve hour
 *         lines then run out to the edges as drafting hairlines. As it grows
 *         the hands fade out and all four sections rise in, together, in the
 *         middle of the ring — the navigation, whole. Click again, the ×, or
 *         Escape, and it folds back in its own order: the sections and the
 *         hairlines go first, the ring shrinks home with its hands returning,
 *         and only then does the hand sweep the page back in.
 *
 * Phone   (700px wide or less) there is no hover and no room under the clock
 *         for the curved names or the bending line. The clock takes the
 *         empty centre of the header at the mark's size and keeps ringing; a
 *         tap opens it. Once the header has scrolled away it floats at the
 *         bottom centre on a small coin: it sinks away while the page scrolls
 *         quickly and comes back, ringing once, as the scroll slows or stops.
 *         Opened, the ring is sized to the width, the two cards sit side by
 *         side with the names beneath, and the × waits at the bottom centre.
 *
 * Reduced motion: no ringing, no cycle (the labels become a plain row under
 * the clock), no expansion tween — every state jumps straight to its end.
 */

/** The stations, in the order they arrive. A `section` is a place on the page
    and goes through sectionLink — never a `#` in the URL (lib/sectionLink.js);
    an `href` is somewhere else entirely. */
const STOPS = [
  { label: 'About', section: 'about' },
  { label: 'Work', section: 'work' },
  { label: 'Contact', section: 'contact' },
  { label: 'Let’s talk', href: `mailto:${PERSON.email}` },
];

/** A station's link props: scrolls in place for a section, follows an href otherwise. */
const stopLink = (stop, then) => (stop.section
  ? sectionLink(stop.section, then)
  : { href: stop.href, onClick: then });

/* The time zone, as the system names it: "Pakistan Standard Time", "UTC+5". */
const zonePart = style => new Intl.DateTimeFormat('en-GB', { timeZone: PERSON.timezone, timeZoneName: style })
  .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
const ZONE = zonePart('long');
const OFFSET = zonePart('shortOffset').replace('GMT', 'UTC');

/* Phones — the same width at which the header drops to two columns (Hero.css). */
const COMPACT = '(max-width: 700px)';
const compactQuery = typeof window !== 'undefined' ? window.matchMedia(COMPACT) : null;
const isCompact = () => !!compactQuery?.matches;
/* On a phone the floating clock and the × sit this far above the bottom edge
   (plus the home-bar inset). Keep in step with SketchClock.css. */
const FLOAT_GAP = 20;

/* Timing of the curved labels, in seconds: arrive, hold, leave, and how long
   a pointer rests on a label before the clock takes it as interest. */
const IN = 0.65;
const HOLD = 2;
const OUT = 0.45;
const DWELL = 0.9;

/* The header's line makes room for the names: under the clock it dips into a
   soft bowl while a name is showing, and eases back to straight after. In
   screen px, from the rendered pixels: the lowest name ink and the resting
   underline reach 3px and 5px past the line, so the bowl bottoms out 9px down
   and spans 64px either side of the clock's centre (the widest name is ±37). */
const BEND_DEPTH = 9;
const BEND_HALF = 64;
const BEND_LEAD = 0.15;   // the line starts to dip this long before the first name

/* Geometry, in drawing units. The ring is r=40; everything else is relative. */
const RING = 40;
const TICK_IN = 47;
const TICK_W = 1.5;    // the ticks' stroke, in drawing units, at rest
// The section labels' arc, round the bottom. Chrome sets text on a path about
// a third of the font size nearer the centre than the path itself, so this is
// set from pixels, not arithmetic: at 90 every name clears the hour ticks by
// 3px or more. Below them the header's line bends out of the way (BEND_*).
const TEXT_R = 90;
// The legend of the big clock, on the inside of the ring: the city along the
// top, the time zone along the bottom. Chrome sets text on a path a third of
// its size towards the glyphs' tops (see TEXT_R), so these are checked in pixels.
const LEGEND_TOP_R = 34;
const LEGEND_BOTTOM_R = 36;
// On a phone the legend is set larger (3 units, not 2) so it stays legible on
// a small ring; its arcs move to keep the bigger letters off the ring.
const LEGEND_TOP_R_COMPACT = 33;
const LEGEND_BOTTOM_R_COMPACT = 35.3;   // the time zone's letters keep 3px or more off the ring's inner edge
const VB = 112;        // the viewBox — cropped to the sunburst; the rest overflows
const C = VB / 2;
const ORIGIN = `${C} ${C}`;

/* The monogram's ring: one filled path in a 972-unit box, lifted from the
   asset the mark itself uses, so the two can never drift apart. */
const MONOGRAM_BOX = 972;
const MONOGRAM_RING = /\sd="([^"]+)"/.exec(monogramRing)?.[1] ?? '';

/* --- the time ----------------------------------------------------------- */

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: PERSON.timezone,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function localParts(now = new Date()) {
  const p = {};
  for (const part of PARTS.formatToParts(now)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { h: (p.hour ?? 0) % 24, m: p.minute ?? 0, s: p.second ?? 0, ms: now.getMilliseconds() };
}

/** The hands only ever go forwards: pick the equivalent angle ahead of the last one. */
const forward = (prev, next) => (prev == null ? next : prev + ((((next - (prev % 360)) % 360) + 360) % 360));

/* --- the drawing -------------------------------------------------------- */

/** A small seeded generator so the wobble is the same on every render. */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = n => n.toFixed(2);

/** Catmull-Rom through the points, as cubic Béziers. */
function curve(p) {
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} `
      + `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} `
      + `${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** The sunburst: twelve strokes, one an hour, no minutes. */
function sketchTicks(c, rand, count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.05;
    const a = TICK_IN + (rand() - 0.5) * 1.4;
    const b = a + 8 + (rand() - 0.5) * 2.2;
    const skew = (rand() - 0.5) * 0.9;
    const x1 = c + Math.cos(t) * a, y1 = c + Math.sin(t) * a;
    const x2 = c + Math.cos(t) * b - Math.sin(t) * skew, y2 = c + Math.sin(t) * b + Math.cos(t) * skew;
    return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
  });
}

/** A hand: a stroke from just behind the centre to the tip, with a slight bow. */
function sketchHand(c, length, tail, rand) {
  const bow = (rand() - 0.5) * 1.6;
  return `M${f(c)} ${f(c + tail)}Q${f(c + bow)} ${f(c - length * 0.45)} ${f(c)} ${f(c - length)}`;
}

/** The curve the labels sit on: the lower arc, read left to right, upright. */
function textArc(c) {
  const a1 = (170 * Math.PI) / 180, a2 = (10 * Math.PI) / 180;
  return `M${f(c + Math.cos(a1) * TEXT_R)} ${f(c + Math.sin(a1) * TEXT_R)}`
    + `A${TEXT_R} ${TEXT_R} 0 0 0 ${f(c + Math.cos(a2) * TEXT_R)} ${f(c + Math.sin(a2) * TEXT_R)}`;
}

/**
 * A hand-drawn underline for a word on the curve: an arc just outside the
 * baseline, as wide as the word, with a little wander in it.
 */
function underline(c, length, seed) {
  const rand = mulberry32(seed);
  const r = TEXT_R + 4;
  const half = Math.min(length / 2 / r, 1.25);
  const n = 10;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI / 2 + half - (2 * half * i) / n;
    const rr = r + (rand() - 0.5) * 0.9;
    pts.push([c + Math.cos(t) * rr, c + Math.sin(t) * rr]);
  }
  return curve(pts);
}

/* The ringing marks. Where the two bells of an old alarm clock would sit —
   the top corners, just outside the hour ticks, between the ticks at 10 and
   11 and at 1 and 2 — and three arcs curling off each, facing away. */
const WAVE_R = 52;
const WAVE_SIDES = [-135, -45].map(deg => {
  const t = (deg * Math.PI) / 180;
  return { name: deg < -90 ? 'left' : 'right', deg, x: C + Math.cos(t) * WAVE_R, y: C + Math.sin(t) * WAVE_R };
});

/** Three hand-drawn arcs round a bell, each a little wobbly, facing outward. */
function waveArcs(side, rand) {
  const spread = (38 * Math.PI) / 180;
  const t0 = (side.deg * Math.PI) / 180;
  return [6, 11, 16].map(r => {
    const n = 7;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = t0 - spread + (2 * spread * i) / n;
      const rr = r + (rand() - 0.5) * 0.7;
      pts.push([side.x + Math.cos(a) * rr, side.y + Math.sin(a) * rr]);
    }
    return curve(pts);
  });
}

/** An arc for the legend: across the top reading clockwise, or across the bottom. */
function legendArc(c, r, top) {
  const [a1, a2] = top ? [200, 340] : [160, 20];
  const p = a => [c + Math.cos((a * Math.PI) / 180) * r, c + Math.sin((a * Math.PI) / 180) * r];
  const [x1, y1] = p(a1);
  const [x2, y2] = p(a2);
  return `M${f(x1)} ${f(y1)}A${r} ${r} 0 0 ${top ? 1 : 0} ${f(x2)} ${f(y2)}`;
}

/** The complete drawing, centred at `c`. */
function drawFace(c) {
  const rand = mulberry32(7);
  return {
    ticks: sketchTicks(c, rand),
    hour: sketchHand(c, 22, 4.5, rand),
    minute: sketchHand(c, 32, 5.5, rand),
    second: sketchHand(c, 36, 9, rand),
    arc: textArc(c),
    legendTop: legendArc(c, LEGEND_TOP_R, true),
    legendBottom: legendArc(c, LEGEND_BOTTOM_R, false),
    legendTopCompact: legendArc(c, LEGEND_TOP_R_COMPACT, true),
    legendBottomCompact: legendArc(c, LEGEND_BOTTOM_R_COMPACT, false),
    waves: WAVE_SIDES.map(side => ({ side, arcs: waveArcs(side, mulberry32(side.name === 'left' ? 21 : 22)) })),
  };
}

/* --- the face ------------------------------------------------------------- */

/**
 * The one face. The disc the big clock shows its sections on is already
 * here, hidden. The ring is the monogram's fill.
 */
function Face({ geo, c }) {
  const k = (RING * 2) / MONOGRAM_BOX;
  return (
    <g className="hero__clock-face" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle className="hero__clock-fill" cx={c} cy={c} r={RING} stroke="none" />
      <g className="hero__clock-ticks">
        {geo.ticks.map((d, i) => (
          <path key={i} className="hero__clock-tick" d={d} strokeWidth={TICK_W} />
        ))}
      </g>
      <g className="hero__clock-ring" mask="url(#hero-clock-reveal)">
        <path d={MONOGRAM_RING} transform={`translate(${c - RING} ${c - RING}) scale(${k})`} fill="currentColor" fillRule="evenodd" stroke="none" />
      </g>
      <g className="hero__clock-hand hero__clock-hand--hour">
        <path d={geo.hour} strokeWidth={2.6} />
      </g>
      <g className="hero__clock-hand hero__clock-hand--minute">
        <path d={geo.minute} strokeWidth={2} />
      </g>
      <g className="hero__clock-hand hero__clock-hand--second">
        <path d={geo.second} strokeWidth={1} />
      </g>
      <circle className="hero__clock-pin" cx={c} cy={c} r={1.8} stroke="none" />
    </g>
  );
}

/* --- the flip cards ---------------------------------------------------------- */

const pad = n => String(n).padStart(2, '0');

/** The time as the cards show it: 12-hour, no seconds, and which half of the day. */
function flipTime(now = new Date()) {
  const { h, m } = localParts(now);
  return { hour: String(h % 12 || 12), minute: pad(m), meridiem: h < 12 ? 'AM' : 'PM' };
}

/**
 * One card, in the manner of Fliqlo: a top and a bottom half that hold the
 * current figure, and two leaves that fold over when it changes. The hour card
 * carries AM or PM in its corner.
 */
function FlipCard({ kind }) {
  return (
    <span className={`hero__clock-card hero__clock-card--${kind}`} aria-hidden="true">
      <span className="hero__clock-card-half hero__clock-card-half--top"><span /></span>
      <span className="hero__clock-card-half hero__clock-card-half--bottom"><span /></span>
      <span className="hero__clock-card-half hero__clock-card-half--top hero__clock-card-leaf"><span /></span>
      <span className="hero__clock-card-half hero__clock-card-half--bottom hero__clock-card-leaf"><span /></span>
      {kind === 'hour' && <span className="hero__clock-card-meridiem" />}
    </span>
  );
}

/**
 * A card's arrival, the way a flip clock shows a time rather than fading one
 * in: its two flaps swing out of the split line into place — the top flap up,
 * then the bottom flap down. AM/PM appears as the top flap lands.
 */
function unfoldCard(card) {
  const [top, bottom] = card.querySelectorAll('.hero__clock-card-half:not(.hero__clock-card-leaf)');
  const meridiem = card.querySelector('.hero__clock-card-meridiem');
  const tl = gsap.timeline()
    .fromTo(top, { rotationX: -90, transformPerspective: 600, transformOrigin: '50% 100%' }, { rotationX: 0, duration: 0.3, ease: 'power2.out' })
    .fromTo(bottom, { rotationX: 90, transformPerspective: 600, transformOrigin: '50% 0%' }, { rotationX: 0, duration: 0.3, ease: 'power2.out' });
  if (meridiem) tl.set(meridiem, { autoAlpha: 1 }, 0.3);
  return tl;
}

/**
 * Keep the two cards on the time while the clock is open. A card flips only
 * when its own figure changes: the top leaf (old figure) folds down, then the
 * bottom leaf (new figure) folds open. Returns the stop.
 */
function runFlipCards(body) {
  const cards = {
    hour: body.querySelector('.hero__clock-card--hour'),
    minute: body.querySelector('.hero__clock-card--minute'),
  };
  const meridiem = body.querySelector('.hero__clock-card-meridiem');
  const shown = { hour: null, minute: null };
  const face = half => half.firstElementChild;
  const setCard = (card, value, animate) => {
    const [top, bottom, leafTop, leafBottom] = card.querySelectorAll('.hero__clock-card-half');
    const old = face(bottom).textContent;
    gsap.killTweensOf([leafTop, leafBottom]);
    if (!animate || !old) {
      [top, bottom, leafTop, leafBottom].forEach(half => { face(half).textContent = value; });
      gsap.set([leafTop, leafBottom], { rotationX: 0, autoAlpha: 0 });
      return;
    }
    face(top).textContent = value;
    face(leafTop).textContent = old;
    face(leafBottom).textContent = value;
    gsap.set(leafTop, { rotationX: 0, autoAlpha: 1, transformPerspective: 600, transformOrigin: '50% 100%' });
    gsap.set(leafBottom, { rotationX: 90, autoAlpha: 1, transformPerspective: 600, transformOrigin: '50% 0%' });
    gsap.timeline({ onComplete: () => { face(bottom).textContent = value; gsap.set([leafTop, leafBottom], { autoAlpha: 0 }); } })
      .to(leafTop, { rotationX: -90, duration: 0.28, ease: 'power2.in' })
      .to(leafBottom, { rotationX: 0, duration: 0.3, ease: 'power2.out' });
  };
  const tick = animate => {
    const t = flipTime();
    meridiem.textContent = t.meridiem;
    for (const kind of ['hour', 'minute']) {
      if (shown[kind] === t[kind]) continue;
      shown[kind] = t[kind];
      setCard(cards[kind], t[kind], animate && !reducedMotion);
    }
  };
  tick(false);
  const id = window.setInterval(() => tick(true), 1000);
  return () => window.clearInterval(id);
}

/* --- the component -------------------------------------------------------- */

export default function SketchClock({ draw = false }) {
  const time = useKarachiTime();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(isCompact);
  const rootRef = useRef(null);
  const dialRef = useRef(null);
  const svgRef = useRef(null);
  const portalRef = useRef(null);
  const bodyRef = useRef(null);
  const cycleRef = useRef(null);
  const hoverRef = useRef(null);
  const wavesRef = useRef(null);
  const bendRef = useRef(null);
  const openGeom = useRef(null);
  const floatRef = useRef(null);
  const safeRef = useRef(null);
  const portalTl = useRef(null);
  const closing = useRef(false);
  const viaKey = useRef(false);
  const angles = useRef({ h: null, m: null });

  const geo = useMemo(() => drawFace(C), []);

  // Phone or not, kept current as the window is resized or rotated.
  useEffect(() => {
    if (!compactQuery) return;
    const onChange = () => setCompact(compactQuery.matches);
    compactQuery.addEventListener('change', onChange);
    return () => compactQuery.removeEventListener('change', onChange);
  }, []);

  // The hands. Hour and minute are set once a minute, on the minute; the
  // second hand is a 60s tween on repeat whose progress is the current second,
  // re-seated whenever the tab comes back so it cannot drift.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const context = gsap.context(() => {
      const hour = root.querySelector('.hero__clock-hand--hour');
      const minute = root.querySelector('.hero__clock-hand--minute');
      const second = root.querySelector('.hero__clock-hand--second');
      const sweep = gsap.fromTo(second,
        { rotation: 0, svgOrigin: ORIGIN },
        { rotation: 360, duration: 60, ease: reducedMotion ? 'steps(60)' : 'none', repeat: -1, svgOrigin: ORIGIN, paused: true },
      );
      const turn = (hand, angle, first) => gsap.to(hand, {
        rotation: angle, svgOrigin: ORIGIN,
        duration: first || reducedMotion ? 0 : 0.6, ease: 'power3.out', overwrite: 'auto',
      });
      const seat = (first = false) => {
        const { h, m, s, ms } = localParts();
        const a = angles.current;
        a.m = forward(a.m, m * 6 + s * 0.1);
        a.h = forward(a.h, (h % 12) * 30 + m * 0.5);
        turn(hour, a.h, first);
        turn(minute, a.m, first);
        sweep.progress((s + ms / 1000) / 60).play();
      };
      seat(true);
      let interval = 0;
      const timeout = window.setTimeout(() => {
        seat();
        interval = window.setInterval(seat, 60000);
      }, 60000 - (Date.now() % 60000) + 50);
      const onVisible = () => { if (document.visibilityState === 'visible') seat(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        window.clearTimeout(timeout);
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }, root);
    return () => context.revert();
  }, []);

  // The ringing — drawn, never shaken. Little arcs of vibration pulse off both
  // top corners of the clock, the way an old twin-bell alarm clock is drawn
  // ringing in a cartoon; the clock itself does not move. Two states:
  // ringing at rest (a double "brring", then quiet), and quiet whenever the
  // pointer is on the clock, a label is being read, or the clock is open.
  useEffect(() => {
    const arcs = gsap.utils.toArray('.hero__clock-wave', rootRef.current);
    if (reducedMotion) {
      // No motion: the marks simply stay drawn, as they would on a page.
      gsap.set(arcs, { autoAlpha: 0.55 });
      return;
    }
    const sides = WAVE_SIDES.map(side => ({
      origin: `${f(side.x)} ${f(side.y)}`,
      arcs: arcs.filter(a => a.dataset.side === side.name),
    }));
    const context = gsap.context(() => {
      let mode = 'off';
      let tl = null;
      // One ripple off one corner: the arcs travel outward from the bell,
      // inner first, each flaring in and fading as it goes.
      const ripple = (side, pace, peak) => gsap.timeline()
        .fromTo(side.arcs, { autoAlpha: 0, scale: 0.55, svgOrigin: side.origin },
          { autoAlpha: peak, scale: 1, svgOrigin: side.origin, duration: 0.16 * pace, ease: 'power2.out', stagger: 0.08 * pace }, 0)
        .to(side.arcs, { scale: 1.18, svgOrigin: side.origin, duration: 0.3 * pace, ease: 'sine.out', stagger: 0.08 * pace }, 0.16 * pace)
        .to(side.arcs, { autoAlpha: 0, duration: 0.24 * pace, ease: 'power1.in', stagger: 0.08 * pace }, 0.22 * pace);
      // Both bells, the right a beat behind the left, like a real hammer.
      const both = (pace, peak) => gsap.timeline()
        .add(ripple(sides[0], pace, peak), 0)
        .add(ripple(sides[1], pace, peak), 0.05 * pace);
      const set = next => {
        if (mode === next) return;
        mode = next;
        tl?.kill();
        tl = null;
        if (next === 'ring') {
          // Brring-brring, then quiet.
          tl = gsap.timeline({ repeat: -1, repeatDelay: 2.6 })
            .add(both(1, 0.9), 0)
            .add(both(1, 0.9), 0.7);
        } else {
          tl = gsap.to(arcs, { autoAlpha: 0, duration: 0.25, ease: 'power1.out', overwrite: 'auto' });
        }
      };
      // Strike the bells now: the next burst starts at once, not after the pause.
      const kick = () => { if (mode === 'ring') tl?.restart(); };
      wavesRef.current = { set, kick };
      return () => { wavesRef.current = null; };
    }, rootRef);
    return () => context.revert();
  }, []);

  // The first reveal: the ring is wiped in through a masked arc, the sunburst
  // goes round, then the hands — and then the clock starts to ring. Fired with
  // the rest of the header, so it lands as the fade-in does.
  useEffect(() => {
    if (!draw || reducedMotion) return;
    const context = gsap.context(() => {
      const svg = svgRef.current;
      gsap.timeline({ defaults: { ease: 'power2.inOut' } })
        .from(svg.querySelector('.hero__clock-reveal'), { drawSVG: 0, duration: 1.1 }, 0.3)
        .from(svg.querySelectorAll('.hero__clock-tick'), { drawSVG: 0, duration: 0.3, stagger: 0.022, ease: 'power1.out' }, 1.05)
        .from(svg.querySelectorAll('.hero__clock-hand path'), { drawSVG: 0, duration: 0.5, stagger: 0.12 }, 1.5)
        .from(svg.querySelector('.hero__clock-pin'), { scale: 0, transformOrigin: '50% 50%', duration: 0.3, ease: EASE.press }, 1.55)
        .call(() => { if (!rootRef.current.matches(':hover')) wavesRef.current?.set('ring'); }, null, 2.6);
    }, rootRef);
    return () => context.revert();
  }, [draw]);

  // Hover: the dial grows a third, the ringing stops, and the city
  // label steps aside for the curve. Keyboard focus counts as hover so the
  // labels can be reached. Muted while the clock is open or closing.
  useEffect(() => {
    const root = rootRef.current;
    const dialEl = dialRef.current;
    const label = root.querySelector('.hero__clock-label');
    const context = gsap.context(() => {
      let hot = false;
      const sync = () => {
        if (root.classList.contains('hero__clock--open') || closing.current) return;
        // A phone has no hover (a tap fires a brief one): nothing grows or
        // steps aside, and the clock simply goes back to ringing.
        if (isCompact()) { wavesRef.current?.set('ring'); return; }
        const d = reducedMotion ? 0 : 0.5;
        gsap.to(dialEl, { scale: hot ? 1.3 : 1, duration: d, ease: EASE.arrive, overwrite: 'auto' });
        // The city and the section names share the space under the clock and
        // are never seen together: the city is gone before the first name
        // arrives (the names wait BEND_LEAD), and comes back only once the
        // name has turned away (OUT).
        gsap.to(label, hot
          ? { autoAlpha: 0, y: 6, duration: reducedMotion ? 0 : 0.14, ease: EASE.blend, overwrite: 'auto' }
          : { autoAlpha: 1, y: 0, duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : OUT, ease: EASE.blend, overwrite: 'auto' });
        // The pointer has its attention: the ringing stops while it is here.
        wavesRef.current?.set(hot ? 'still' : 'ring');
      };
      const settle = (on) => {
        if (hot === on) return;
        hot = on;
        sync();
      };
      const enter = () => settle(true);
      const leave = () => { if (!root.contains(document.activeElement)) settle(false); };
      const focusin = () => settle(true);
      const focusout = e => { if (!root.contains(e.relatedTarget) && !root.matches(':hover')) settle(false); };
      root.addEventListener('pointerenter', enter);
      root.addEventListener('pointerleave', leave);
      root.addEventListener('focusin', focusin);
      root.addEventListener('focusout', focusout);
      hoverRef.current = {
        sync: () => { hot = root.matches(':hover') || root.contains(document.activeElement); sync(); },
      };
      return () => {
        root.removeEventListener('pointerenter', enter);
        root.removeEventListener('pointerleave', leave);
        root.removeEventListener('focusin', focusin);
        root.removeEventListener('focusout', focusout);
        hoverRef.current = null;
      };
    }, root);
    return () => context.revert();
  }, []);

  // The line makes room. The header's own rule, straight at rest, dips into a
  // soft bowl under the clock while a section name is showing, so a name never
  // sits on it, and eases back to straight once the names have gone. The
  // stretch under the clock is masked out of the rule and this component draws
  // the bowl in its place, in the rule's own colour, overlapping it 2px a side.
  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const rule = root.closest('.hero__top')?.querySelector('.hero__rule--top');
    const bend = root.querySelector('.hero__clock-bend');
    const path = bend?.querySelector('path');
    if (!rule || !bend || !path) return;
    const W = BEND_HALF * 2 + 4;
    const c = W / 2;
    const state = { depth: 0 };
    let target = false, gapLeft = 0, tween = null;

    const clearMask = () => {
      rule.style.removeProperty('mask-image');
      rule.style.removeProperty('-webkit-mask-image');
    };
    // The bowl's place: centred on the clock, its y=0.5 on the rule's centre line.
    const measure = () => {
      const r = root.getBoundingClientRect();
      const l = rule.getBoundingClientRect();
      const centre = r.left + r.width / 2;
      gapLeft = centre - l.left - BEND_HALF;
      bend.style.left = `${centre - r.left - c}px`;
      bend.style.top = `${l.top - r.top}px`;
    };
    const paint = () => {
      const d = state.depth;
      if (d < 0.05) {
        clearMask();
        bend.style.visibility = 'hidden';
        return;
      }
      const a = gapLeft, b = gapLeft + BEND_HALF * 2;
      const mask = `linear-gradient(to right, #000 ${a}px, transparent ${a}px, transparent ${b}px, #000 ${b}px)`;
      rule.style.setProperty('mask-image', mask);
      rule.style.setProperty('-webkit-mask-image', mask);
      const y = d + 0.5;
      path.setAttribute('d', `M0 0.5H2C26 0.5 ${c - 30} ${y} ${c} ${y}C${c + 30} ${y} ${W - 26} 0.5 ${W - 2} 0.5H${W}`);
      bend.style.visibility = 'visible';
    };
    const set = on => {
      if (on === target) return;
      target = on;
      if (on) measure();
      tween?.kill();
      tween = gsap.to(state, {
        depth: on ? BEND_DEPTH : 0,
        duration: on ? 0.35 : 0.4,
        delay: on ? 0 : 0.2,          // let the name turn away before the line rises
        ease: on ? 'power2.out' : 'power2.inOut',
        onUpdate: paint,
        onComplete: paint,
      });
    };
    const onResize = () => { measure(); paint(); };
    window.addEventListener('resize', onResize);
    measure();
    bendRef.current = { set };
    return () => {
      window.removeEventListener('resize', onResize);
      tween?.kill();
      bendRef.current = null;
      clearMask();
    };
  }, []);

  // The curve. While the pointer is on the clock the stations take turns —
  // arrive, hold, leave — and the cycle rests while the pointer (or keyboard
  // focus) is on a label, so it can be clicked. Rest there a moment longer
  // and the clock dwells with you: the word is underlined by hand until you
  // leave or click.
  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const stops = gsap.utils.toArray('.hero__clock-stop', root);
    if (!stops.length) return;
    const context = gsap.context(() => {
      let index = -1, current = -1, hovering = false, resting = false, wait = null;
      let dwellTimer = null, dwelling = -1;
      const clear = () => { wait?.kill(); wait = null; };
      const later = (delay) => { clear(); wait = gsap.delayedCall(delay, advance); };

      const dwellEnd = () => {
        dwellTimer?.kill();
        dwellTimer = null;
        if (dwelling < 0) return;
        const line = stops[dwelling].querySelector('.hero__clock-stop-line');
        dwelling = -1;
        gsap.to(line, { drawSVG: '100% 100%', autoAlpha: 0, duration: 0.3, ease: EASE.leave, overwrite: 'auto' });
        hoverRef.current?.sync();
      };
      const dwellStart = i => {
        dwellTimer = null;
        dwelling = i;
        const el = stops[i];
        const line = el.querySelector('.hero__clock-stop-line');
        const length = el.querySelector('text')?.getComputedTextLength?.() ?? 40;
        line.setAttribute('d', underline(C, length, 11 + i));
        wavesRef.current?.set('still');
        gsap.fromTo(line, { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 0.5, ease: 'power2.inOut', overwrite: 'auto' });
      };

      const leave = i => {
        const el = stops[i];
        el.style.pointerEvents = '';
        if (dwelling === i) dwellEnd();
        gsap.to(el, { rotation: 11, autoAlpha: 0, duration: OUT, ease: EASE.leave, svgOrigin: ORIGIN, overwrite: 'auto' });
        if (current === i) current = -1;
        // The last name has gone: the line can straighten.
        if (current < 0 && !hovering) bendRef.current?.set(false);
      };
      const arrive = i => {
        if (current === i) return;
        bendRef.current?.set(true);
        if (current >= 0) leave(current);
        current = i;
        const el = stops[i];
        el.style.pointerEvents = 'auto';
        gsap.fromTo(el, { rotation: -9, autoAlpha: 0 }, { rotation: 0, autoAlpha: 1, duration: IN, ease: EASE.arrive, svgOrigin: ORIGIN, overwrite: 'auto' });
        gsap.fromTo(el.querySelectorAll('tspan'), { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.3, ease: EASE.blend, stagger: { each: 0.045, from: 'center' }, overwrite: 'auto' });
      };
      const advance = () => {
        clear();
        if (!hovering || resting) return;
        index = (index + 1) % stops.length;
        arrive(index);
        later(IN + HOLD);
      };
      const enter = () => {
        if (isCompact() || hovering || root.classList.contains('hero__clock--open') || closing.current) return;
        hovering = true;
        // The line dips first, so a name never lands on it.
        bendRef.current?.set(true);
        if (current < 0) later(BEND_LEAD);
        else later(HOLD);
      };
      const exit = () => {
        hovering = false;
        clear();
        if (current >= 0 && !stops.includes(document.activeElement)) leave(current);
      };
      const stop = () => { hovering = false; resting = false; clear(); if (current >= 0) leave(current); };
      const handlers = stops.map((el, i) => {
        const rest = () => {
          resting = true;
          clear();
          dwellTimer?.kill();
          dwellTimer = gsap.delayedCall(DWELL, () => dwellStart(i));
        };
        const resume = () => {
          resting = false;
          dwellTimer?.kill();
          dwellTimer = null;
          if (dwelling === i) dwellEnd();
          if (hovering) later(HOLD / 2);
        };
        const focus = () => { clear(); index = i; arrive(i); };
        const blur = e => {
          if (stops.includes(e.relatedTarget)) return;
          if (hovering) later(HOLD / 2);
          else leave(i);
        };
        const click = () => { if (dwelling === i) dwellEnd(); };
        el.addEventListener('pointerenter', rest);
        el.addEventListener('pointerleave', resume);
        el.addEventListener('focus', focus);
        el.addEventListener('blur', blur);
        el.addEventListener('click', click);
        return () => {
          el.removeEventListener('pointerenter', rest);
          el.removeEventListener('pointerleave', resume);
          el.removeEventListener('focus', focus);
          el.removeEventListener('blur', blur);
          el.removeEventListener('click', click);
        };
      });
      root.addEventListener('pointerenter', enter);
      root.addEventListener('pointerleave', exit);
      cycleRef.current = { stop, enter };
      return () => {
        clear();
        dwellTimer?.kill();
        root.removeEventListener('pointerenter', enter);
        root.removeEventListener('pointerleave', exit);
        handlers.forEach(off => off());
        cycleRef.current = null;
      };
    }, root);
    return () => context.revert();
  }, []);

  // Open and close. The dial's own SVG is scaled and moved to the middle of
  // the viewport and back; the sweep overlay (the veil and the hairlines) sits
  // beneath it and the section copy above it, both fixed to the viewport.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const button = dialRef.current;
    const svg = svgRef.current;
    const overlay = portalRef.current;
    const body = bodyRef.current;
    if (!root || !button || !svg || !overlay || !body) return;

    const label = root.querySelector('.hero__clock-label');
    const ticks = svg.querySelectorAll('.hero__clock-tick');
    const hands = svg.querySelectorAll('.hero__clock-hand, .hero__clock-pin');
    const links = body.querySelectorAll('.hero__clock-portal-nav a');
    const cards = body.querySelectorAll('.hero__clock-card');
    const close = body.querySelector('.hero__clock-portal-close');
    const legend = svg.querySelector('.hero__clock-legend');
    const fill = svg.querySelector('.hero__clock-fill');
    const waves = svg.querySelector('.hero__clock-waves');
    const veil = overlay.querySelector('.hero__clock-veil');
    const lines = overlay.querySelector('.hero__clock-lines');
    const rays = lines.querySelectorAll('.hero__clock-ray');
    const sweep = lines.querySelector('.hero__clock-sweep');
    const arm = lines.querySelector('.hero__clock-sweep-arm');

    // Once the ring is home: hover state is whatever the pointer says now,
    // and the curve picks up again if the pointer is still here.
    const settled = () => {
      hoverRef.current?.sync();
      if (root.matches(':hover')) cycleRef.current?.enter();
      floatRef.current?.recheck();
    };

    if (!open) {
      if (!portalTl.current) { overlay.inert = true; body.inert = true; delete root.dataset.big; return; }
      portalTl.current.kill();
      const wasInside = body.contains(document.activeElement);
      overlay.inert = true;
      body.inert = true;
      // Escape hands focus back to the dial once it is home; a click leaves
      // focus where the click was.
      const returnFocus = wasInside && viaKey.current;
      if (wasInside && !returnFocus) document.activeElement?.blur?.();
      viaKey.current = false;
      closing.current = true;
      const done = () => {
        closing.current = false;
        delete root.dataset.big;
        settled();
        if (returnFocus) button.focus({ preventScroll: true });
      };

      // Closing, in order — never the opening run backwards. 1. What the big
      // clock added leaves: the time, the sections, the legend, the × and the
      // hairlines. 2. The same
      // SVG shrinks home and its hands come back. 3. From the small clock,
      // the hand sweeps the page back in anticlockwise. There is no handover:
      // the small clock that remains is the one that was big.
      const home = button.getBoundingClientRect();
      const hx = home.left + home.width / 2, hy = home.top + home.height / 2;
      const size = button.offsetWidth;                     // the dial at rest, px
      const sweepNow = parseFloat(getComputedStyle(veil).getPropertyValue('--sweep')) || 360;
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: () => {
          gsap.set(overlay, { autoAlpha: 0 });
          // Home, and exactly the size the stylesheet gives it: hand it back.
          gsap.set(svg, { clearProps: 'position,left,top,width,height,transform' });
          portalTl.current = null;
          done();
        },
      });
      tl.to([cards[1], ...links, cards[0]], { autoAlpha: 0, y: -8, duration: 0.25, ease: EASE.leave, stagger: 0.03 }, 0)
        .to([legend, close], { autoAlpha: 0, duration: 0.2, ease: EASE.leave }, 0)
        .to(rays, { drawSVG: '0%', duration: 0.3, ease: 'power2.in', stagger: 0.015 }, 0)
        .to(body, { autoAlpha: 0, duration: 0.3, ease: EASE.leave }, 0.05)
        .to(svg, { x: 0, y: 0, width: size, height: size, duration: 0.65, force3D: false, autoRound: false }, 0.2)
        .to(ticks, { attr: { 'stroke-width': TICK_W }, duration: 0.65 }, 0.2)
        .to(fill, { autoAlpha: 0, duration: 0.4, ease: EASE.blend }, 0.3)
        .to(hands, { autoAlpha: 1, duration: 0.35, ease: EASE.blend }, 0.5)
        .set(veil, { '--cx': `${hx}px`, '--cy': `${hy}px` }, 0.85)
        .set(sweep, { x: hx, y: hy }, 0.85)
        .set(arm, { rotation: sweepNow, autoAlpha: 1 }, 0.85)
        .to(veil, { '--sweep': '0deg', duration: 0.75 }, 0.9)
        .to(arm, { rotation: 0, duration: 0.75 }, 0.9)
        .to(arm, { autoAlpha: 0, duration: 0.2, ease: EASE.blend }, 1.5)
        .to(waves, { autoAlpha: 1, duration: 0.25, ease: EASE.blend }, 1.55);
      portalTl.current = tl;
      if (reducedMotion) tl.progress(1);
      return;
    }

    // The big clock is up (and stays marked so until it is home again): its
    // drawing covers much of the viewport and must not wear the dial's pointer.
    root.dataset.big = '';
    cycleRef.current?.stop();
    wavesRef.current?.set('still');
    portalTl.current?.kill();
    // A click usually comes moments after the pointer arrives, while the
    // hover grow is still running. Left alone, that tween would finish after
    // this point and scale the whole move with it — landing the big clock
    // low and oversized. Stop it where it is.
    gsap.killTweensOf([button, label]);

    // Where the dial is, and where the middle of the viewport is. The hover
    // scale on the button (wherever its tween had got to) is folded into the
    // SVG's own transform, so the drawing on screen does not change at the
    // instant the grow begins. The viewport is measured without any
    // scrollbar, so the middle is the middle of what the reader sees.
    const box = button.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const bs = Number(gsap.getProperty(button, 'scale')) || 1;
    const unit = (box.width / bs) / VB;                    // px per drawing unit, at rest
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.clientHeight;
    const R = Math.hypot(W, H);
    // The sunburst reaches 1.4 r past the centre: this keeps it clear of the
    // edges. On a phone the width decides, and the ring sits no lower than
    // leaves the bottom centre free for the ×.
    const compactNow = isCompact();
    const safeBottom = safeRef.current?.offsetHeight || 0;
    const r1 = compactNow
      ? Math.max(110, Math.min((W / 2 - 6) / 1.4, H * 0.3))
      : Math.max(150, Math.min(W * 0.28, H * 0.33, 400));
    const cx1 = W / 2;
    const cy1 = compactNow
      ? Math.min(H / 2, H - (FLOAT_GAP + safeBottom + 44 + 14) - r1 * 1.4)
      : H / 2;
    const closeTop = H - FLOAT_GAP - safeBottom - 44;       // the phone ×'s top edge
    const s1 = r1 / (RING * unit);
    root.style.setProperty('--r1', `${r1}px`);
    openGeom.current = { cx: cx1, cy: cy1, r: r1 };
    // The × sits just outside the ring at half past one: where a close button
    // is looked for, in the gap between the 1 and 2 o'clock ticks, clear of
    // everything else. It is placed from the centre of the dialog, which is
    // the centre of the ring.
    if (compactNow) {
      // On a phone the × waits at the bottom centre — where a thumb already is,
      // and where the floating clock itself sits.
      const closeSize = 44;
      const centreY = H - FLOAT_GAP - safeBottom - closeSize / 2;
      root.style.setProperty('--close-size', `${closeSize}px`);
      close.style.left = '50%';
      close.style.top = `calc(50% + ${(centreY - cy1).toFixed(1)}px)`;
    } else {
      const closeSize = Math.round(Math.min(44, Math.max(34, r1 * 0.13)));
      const closeR = r1 * 1.035 + closeSize / 2;
      root.style.setProperty('--close-size', `${closeSize}px`);
      close.style.left = `calc(50% + ${(closeR * Math.SQRT1_2).toFixed(1)}px)`;
      close.style.top = `calc(50% - ${(closeR * Math.SQRT1_2).toFixed(1)}px)`;
    }
    overlay.inert = false;
    body.inert = false;

    // The sweep: a veil of the ground colour masked by a conic gradient that
    // opens from twelve, led by a hand the length of the viewport's diagonal;
    // both are centred on the ring and travel down with it. Then the hour
    // lines, out to the edges.
    // Each hairline carries on along its own hour tick, so the drawn tick and
    // its hairline are one straight stroke. The ticks are hand-drawn — each has
    // a little angle and a little lean of its own — so a hairline is taken from
    // its tick's actual ends at the big clock's size, never from a perfect 30°
    // step, which left them visibly out of line.
    const k = s1 * unit;                                   // screen px per drawing unit, once grown
    lines.setAttribute('viewBox', `0 0 ${W} ${H}`);
    rays.forEach((ray, i) => {
      const [x1, y1, x2, y2] = geo.ticks[i].match(/-?\d+(?:\.\d+)?/g).map(Number);
      const ax = cx1 + (x1 - C) * k, ay = cy1 + (y1 - C) * k;   // the tick's inner end, on screen
      const bx = cx1 + (x2 - C) * k, by = cy1 + (y2 - C) * k;   // its outer end
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const gap = r1 * 1.5 - Math.hypot(bx - cx1, by - cy1);   // start where the hairlines always started
      // On a phone the × sits at the bottom centre, right on the 6 o'clock
      // hairline's path: that one stops 10px short of it.
      const reach = compactNow && uy > 0.9 ? Math.max(gap, (closeTop - 10 - by) / uy) : R;
      ray.setAttribute('x1', bx + ux * gap); ray.setAttribute('y1', by + uy * gap);
      ray.setAttribute('x2', bx + ux * reach); ray.setAttribute('y2', by + uy * reach);
    });
    const pivot = arm.querySelector('rect');
    pivot.setAttribute('x', -R); pivot.setAttribute('y', -R); pivot.setAttribute('width', 2 * R); pivot.setAttribute('height', 2 * R);
    const hand = arm.querySelector('line');
    hand.setAttribute('x1', 0); hand.setAttribute('y1', 0); hand.setAttribute('x2', 0); hand.setAttribute('y2', -R);

    // The SVG is resized, never CSS-scaled. A transform scale of ×10 or more
    // is painted by the browser as the small drawing blown up as a bitmap —
    // the hour ticks dissolve and the ring goes grey and soft — whereas a
    // resized SVG is redrawn as vectors at its real size on every frame. So:
    // out of flow, centred on the dial, at exactly the size it is on screen.
    const rest = box.width / bs;                           // the dial at rest, px
    gsap.set(button, { scale: 1 });
    gsap.set(svg, { position: 'absolute', left: '50%', top: '50%', width: box.width, height: box.width, xPercent: -50, yPercent: -50, x: 0, y: 0, force3D: false, autoRound: false });
    gsap.set(overlay, { autoAlpha: 1 });
    gsap.set(veil, { '--cx': `${cx}px`, '--cy': `${cy}px`, '--sweep': '0deg' });
    gsap.set(sweep, { x: cx, y: cy });
    gsap.set(arm, { rotation: 0, transformOrigin: '50% 50%', autoAlpha: 1 });
    gsap.set(hands, { autoAlpha: 1 });
    gsap.set(fill, { autoAlpha: 0 });
    gsap.set(body, { left: cx1, top: cy1, xPercent: -50, yPercent: -50, autoAlpha: 0, y: 0 });
    gsap.set(links, { autoAlpha: 0, y: 10 });
    gsap.set(cards, { autoAlpha: 0, y: 0 });
    gsap.set(body.querySelector('.hero__clock-card-meridiem'), { autoAlpha: 0 });
    gsap.set(close, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.6 });
    gsap.set(legend, { autoAlpha: 0 });
    const stopFlip = runFlipCards(body);

    // The grow. The ticks thin as the drawing scales so they stay a pen line
    // at any size; the hands give way to the sections, which rise in one
    // after another once the ring is most of the way there.
    const tl = gsap.timeline({ defaults: { duration: 0.9, ease: 'power2.inOut' } });
    tl.to(waves, { autoAlpha: 0, duration: 0.15, ease: EASE.blend }, 0)
      .to(label, { autoAlpha: 0, duration: 0.25, ease: EASE.blend }, 0)
      .to(veil, { '--sweep': '360deg', '--cx': `${cx1}px`, '--cy': `${cy1}px` }, 0)
      .to(sweep, { x: cx1, y: cy1 }, 0)
      .to(arm, { rotation: 360 }, 0)
      .to(arm, { autoAlpha: 0, duration: 0.25, ease: EASE.blend }, 0.85)
      .fromTo(rays, { drawSVG: '0%' }, { drawSVG: '0% 100%', duration: 0.5, stagger: 0.03, ease: 'power2.out' }, 0.8)
      .to(svg, { x: cx1 - cx, y: cy1 - cy, width: rest * s1, height: rest * s1, force3D: false, autoRound: false }, 0)
      // The attribute, not the CSS property: GSAP rounds CSS pixel values to
      // whole numbers, and 0.2 rounds to 0 — which erased the ticks.
      .to(ticks, { attr: { 'stroke-width': 1.5 / (s1 * unit) } }, 0)
      .to(fill, { autoAlpha: 1, duration: 0.5, ease: EASE.blend }, 0.1)
      .to(hands, { autoAlpha: 0, duration: 0.45, ease: EASE.blend }, 0.1)
      // The dialog itself appears at once; what is in it arrives by its own motion.
      .set(body, { autoAlpha: 1 }, 0.45)
      .to(links, { autoAlpha: 1, y: 0, duration: 0.55, ease: EASE.arrive, stagger: 0.06 }, 0.5)
      // The time arrives as a flip clock shows it, not by fading: each card
      // opens out of its split line, the hour first and the minute a beat after.
      .set(cards, { autoAlpha: 1 }, 0.5)
      .add(unfoldCard(cards[0]), 0.5)
      .add(unfoldCard(cards[1]), 0.74)
      .to(legend, { autoAlpha: 1, duration: 0.5, ease: EASE.blend }, 0.6)
      .to(close, { autoAlpha: 1, scale: 1, duration: 0.4, ease: EASE.press }, 0.85);
    portalTl.current = tl;

    // Focus moves in at the end of the grow, once the first section is on
    // screen: a link that is still hidden cannot take focus, and focus would
    // silently stay behind on the dial.
    const focusIn = () => links[0]?.focus({ preventScroll: true });
    if (reducedMotion) { tl.progress(1); focusIn(); }
    else tl.call(focusIn, null, 0.9);

    return () => { tl.pause(); stopFlip(); };
  }, [open]);

  // Phones: once the header has scrolled out of view the clock floats at the
  // bottom centre. While the page scrolls quickly it sinks out of the way; as
  // the scroll slows, or a moment after it stops, it comes back and rings once.
  // Back at the top, it is in the header again. Never while open or closing.
  useEffect(() => {
    const root = rootRef.current;
    const header = root.closest('.hero__top');
    const button = dialRef.current;
    const coin = root.querySelector('.hero__clock-coin');
    if (!header || !button || !coin) return;
    const targets = [button, coin];
    const HIDE_SPEED = 0.25;   // px per ms: faster than this, it sinks away
    const SHOW_SPEED = 0.12;   // slower than this, it comes back
    const QUIET = 160;         // ms without a scroll event counts as stopped
    let headerVisible = true, floating = false, shown = true;
    let lastY = window.scrollY, lastT = performance.now(), lastScroll = 0, speed = 0, travelled = 0, raf = 0;
    const busy = () => root.classList.contains('hero__clock--open') || closing.current;

    const show = () => {
      if (shown) return;
      shown = true;
      travelled = 0;
      gsap.to(targets, { y: 0, autoAlpha: 1, duration: reducedMotion ? 0 : 0.45, ease: EASE.arrive, overwrite: 'auto' });
      wavesRef.current?.kick?.();
    };
    const hide = () => {
      if (!shown || reducedMotion || root.contains(document.activeElement)) return;
      shown = false;
      gsap.to(targets, { y: 96, autoAlpha: 0, duration: 0.28, ease: EASE.leave, overwrite: 'auto' });
    };
    const watch = () => {
      if (raf) return;
      const step = () => {
        const quiet = performance.now() - lastScroll;
        if (floating && (quiet > QUIET || speed < SHOW_SPEED)) show();
        if (!floating || quiet > QUIET) { raf = 0; speed = 0; return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const setFloating = on => {
      if (on === floating || busy()) return;
      floating = on;
      gsap.killTweensOf(targets);
      // An attribute, not a class: React rewrites className on every render
      // (the time ticks every 15s), which would drop the floating state.
      root.toggleAttribute('data-float', on);
      if (on && !reducedMotion) {
        // It arrives at the bottom out of sight, and rises as the scroll settles.
        gsap.set(targets, { y: 96, autoAlpha: 0 });
        shown = false;
        watch();
      } else {
        gsap.set(targets, { y: 0, autoAlpha: 1 });
        shown = true;
      }
    };
    const recheck = () => setFloating(isCompact() && !headerVisible);
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dy = Math.abs(y - lastY);
      speed = speed * 0.6 + (dy / Math.max(1, now - lastT)) * 0.4;
      lastY = y;
      lastT = now;
      lastScroll = now;
      if (!floating) return;
      travelled += dy;
      if (shown && travelled > 24 && speed > HIDE_SPEED) hide();
      watch();
    };
    const observer = new IntersectionObserver(([entry]) => { headerVisible = entry.isIntersecting; recheck(); });
    observer.observe(header);
    window.addEventListener('scroll', onScroll, { passive: true });
    compactQuery?.addEventListener('change', recheck);
    floatRef.current = { recheck };
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      compactQuery?.removeEventListener('change', recheck);
      cancelAnimationFrame(raf);
      floatRef.current = null;
    };
  }, []);

  // Escape closes it, and so does the ×, and so does a click outside the ring —
  // except on the lamp, which switches the lights and leaves the clock open.
  // A click anywhere inside the ring — a card, the disc, the gap between two
  // names — does nothing, so a near-miss on a link never throws it shut.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); viaKey.current = true; setOpen(false); } };
    const onDown = e => {
      if (e.target.closest?.('.hero__clock-portal-close')) return;
      // Anything marked as standing apart from the clock — the lamp — is not a
      // click outside: using it leaves the clock exactly as it is.
      if (e.target.closest?.('[data-keeps-clock-open]')) return;
      const g = openGeom.current;
      if (g && Math.hypot(e.clientX - g.cx, e.clientY - g.cy) <= g.r * 1.05) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const className = [
    'hero__meta hero__meta--centre hero__clock',
    open ? 'hero__clock--open' : '',
    compact ? 'hero__clock--compact' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} ref={rootRef}>
      {/* The coin under the floating clock on a phone; and a probe that measures the home-bar inset. */}
      <span className="hero__clock-coin" aria-hidden="true"><RingBorder shape="round" /></span>
      <span className="hero__clock-safe" ref={safeRef} aria-hidden="true" />
      <svg className="hero__clock-bend" aria-hidden="true" focusable="false" width={BEND_HALF * 2 + 4} height={BEND_DEPTH + 2} viewBox={`0 0 ${BEND_HALF * 2 + 4} ${BEND_DEPTH + 2}`}>
        <path className="hero__clock-bend-line" d="" />
      </svg>
      {/* The dial opens the clock and nothing else. While the clock is open or
          closing, a click on its (big) drawing must not reopen it: a tap
          outside the ring closes it on pointerdown, and that same tap's click
          then lands here. */}
      <button
        type="button"
        className="hero__clock-dial"
        ref={dialRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="hero-clock-portal"
        aria-label={`${PERSON.city}, ${time} local. Sections`}
        onClick={() => { if (!open && !closing.current) setOpen(true); }}
      >
        <svg className="hero__clock-svg" ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} focusable="false">
          <defs>
            {/* The first reveal wipes the ring in along this arc. */}
            <mask id="hero-clock-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
              <circle className="hero__clock-reveal" cx={C} cy={C} r={RING - 4} fill="none" stroke="#fff" strokeWidth="28" transform={`rotate(-100 ${C} ${C})`} />
            </mask>
            <path id="hero-clock-arc" d={geo.arc} fill="none" />
            <path id="hero-clock-legend-top" d={geo.legendTop} fill="none" />
            <path id="hero-clock-legend-bottom" d={geo.legendBottom} fill="none" />
            <path id="hero-clock-legend-top-compact" d={geo.legendTopCompact} fill="none" />
            <path id="hero-clock-legend-bottom-compact" d={geo.legendBottomCompact} fill="none" />
          </defs>
          <Face geo={geo} c={C} />
          <g className="hero__clock-waves" aria-hidden="true">
            {geo.waves.map(({ side, arcs }) => arcs.map((d, i) => (
              <path key={`${side.name}-${i}`} className="hero__clock-wave" data-side={side.name} d={d} />
            )))}
          </g>
          <g className="hero__clock-legend" aria-hidden="true">
            <text textAnchor="middle"><textPath href={compact ? '#hero-clock-legend-top-compact' : '#hero-clock-legend-top'} startOffset="50%">{PERSON.city}</textPath></text>
            <text textAnchor="middle"><textPath href={compact ? '#hero-clock-legend-bottom-compact' : '#hero-clock-legend-bottom'} startOffset="50%">{`${ZONE} · ${OFFSET}`}</textPath></text>
          </g>
          {!reducedMotion && (
            <g className="hero__clock-stops">
              {STOPS.map((s) => {
                const chars = Array.from(s.label);
                return (
                  <a key={s.label} className="hero__clock-stop" {...stopLink(s, () => setOpen(false))}>
                    <text textAnchor="middle">
                      <textPath href="#hero-clock-arc" startOffset="50%">
                        {chars.map((ch, j) => <tspan key={j}>{ch === ' ' ? ' ' : ch}</tspan>)}
                      </textPath>
                    </text>
                    <path className="hero__clock-stop-line" d="" />
                  </a>
                );
              })}
            </g>
          )}
        </svg>
      </button>

      <span className="hero__clock-label" aria-hidden="true">{PERSON.city}</span>

      {reducedMotion && (
        <nav className="hero__clock-list" aria-label="Sections">
          {STOPS.map(s => (
            <a key={s.label} {...stopLink(s)}>{s.label}</a>
          ))}
        </nav>
      )}

      {/* The sweep — beneath the clock. */}
      <div className="hero__clock-portal" ref={portalRef} aria-hidden="true">
        <div className="hero__clock-veil" />
        <svg className="hero__clock-lines" focusable="false">
          <g className="hero__clock-rays">
            {Array.from({ length: 12 }, (_, i) => <line key={i} className="hero__clock-ray" />)}
          </g>
          <g className="hero__clock-sweep">
            <g className="hero__clock-sweep-arm">
              <rect className="hero__clock-sweep-box" />
              <line className="hero__clock-sweep-hand" />
            </g>
          </g>
        </svg>
      </div>

      {/* Inside the ring, above the clock: the hour, the sections and the
          minute in one row, dead centre — and the × just outside the ring. */}
      <div className="hero__clock-portal-body" id="hero-clock-portal" ref={bodyRef} role="dialog" aria-label="Sections">
        <span className="hero__clock-sr">{`${PERSON.city}, ${time} local time, ${ZONE}.`}</span>
        <div className="hero__clock-portal-row">
          <FlipCard kind="hour" />
          <nav className="hero__clock-portal-nav" aria-label="Sections">
            {STOPS.map(s => (
              <a key={s.label} {...stopLink(s, () => setOpen(false))}>{s.label}</a>
            ))}
          </nav>
          <FlipCard kind="minute" />
        </div>
        <RingButton as="button" shape="round" className="hero__clock-portal-close" aria-label="Close" onClick={() => setOpen(false)}>×</RingButton>
      </div>
    </div>
  );
}
