import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { reducedMotion } from '../../brand/motion.js';
import { currentScheme, onSchemeChange, toggleScheme } from '../../brand/scheme.js';
import { TICK_LEN, tickPath } from '../hero/Rails.jsx';
import './PullCord.css';

/**
 * The lamp.
 *
 * The light switch. A little Luxo-style lamp hangs on its own cord from the
 * top edge, out in the right-hand margin — outside the rail, in the strip of
 * paper beyond it, where nothing else lives. Its bell of a shade is open
 * underneath, the inside of the shade catches the light, and the bulb hangs
 * just out of the mouth.
 *
 * It hangs still, square to the page, centred in the clear strip between the
 * rail's graduations and the edge of the screen. It never swings and never
 * touches the rail: the ONLY way it moves is up and down its own cord. Pull it
 * down and the cord stretches; let go and it springs back up and settles.
 *
 * The light acts on the rail without anything touching it. A soft pool falls
 * from the bulb, masked to the margin so none of it reaches the page, and every
 * graduation in it shortens — the brighter the light on it, the smaller it
 * gets — with a slow swell running down through them. Pull the lamp down and
 * the shortening travels down the ruling with it. The rail line itself is
 * never moved.
 *
 * Pull it far enough and the lights go off: the page turns from porcelain to
 * graphite, or back, and the bulb goes out. Until it is pulled the page follows
 * the sun over Islamabad (brand/scheme.js); a pull is a reader's choice, kept
 * between visits.
 *
 * Drag   straight down against the cord's stretch — sideways movement of the
 *        hand is ignored — and the switch throws the moment the cord passes its
 *        stop, mid-pull, the way a real one does. Let go and it springs back.
 * Click  (or tap, or Enter) is a short tug: the cord pulls to the stop, throws,
 *        and lets go.
 *
 * Reduced motion: it hangs still, the light holds one level, and a click flips
 * the scheme at once.
 */

/* --- the lamp, in its own units ------------------------------------------------
   The cord's end is the origin and the head hangs below it. The whole head is
   scaled to fit the margin the viewport gives it, so these are shape, not size. */
const NECK_HALF = 2.6;        // the socket the cord goes into
const NECK_H = 6;
const CAP_Y = 5;              // the shade's rounded crown
const CAP_HALF = 4.4;
const RIM_Y = 19;             // the shade's mouth
const RIM_HALF = 14;          // the lamp's widest point
const MOUTH_RY = 2.6;         // the mouth, seen a little from below
const BULB_Y = 21.2;
const BULB_R = 4.3;
const HEAD_MID = 12;          // where the hand grabs it

const SHADE = [
  `M${-CAP_HALF} ${CAP_Y}`,
  `C${-CAP_HALF} ${CAP_Y - 1.2} ${CAP_HALF} ${CAP_Y - 1.2} ${CAP_HALF} ${CAP_Y}`,
  `C${CAP_HALF + 3.6} ${CAP_Y + 0.6} ${RIM_HALF - 3.6} ${CAP_Y + 4.4} ${RIM_HALF - 2.4} ${RIM_Y - 5}`,
  `C${RIM_HALF - 1.6} ${RIM_Y - 2.6} ${RIM_HALF - 0.6} ${RIM_Y - 0.9} ${RIM_HALF} ${RIM_Y}`,
  `A${RIM_HALF} ${MOUTH_RY} 0 0 1 ${-RIM_HALF} ${RIM_Y}`,
  `C${-RIM_HALF + 0.6} ${RIM_Y - 0.9} ${-RIM_HALF + 1.6} ${RIM_Y - 2.6} ${-RIM_HALF + 2.4} ${RIM_Y - 5}`,
  `C${-RIM_HALF + 3.6} ${CAP_Y + 4.4} ${-CAP_HALF - 3.6} ${CAP_Y + 0.6} ${-CAP_HALF} ${CAP_Y}Z`,
].join('');
/* A thin catch of light down the shade's far shoulder, for its roundness. */
const SHEEN = `M${CAP_HALF + 1.4} ${CAP_Y + 1.1}C${CAP_HALF + 3.8} ${CAP_Y + 2.2} ${RIM_HALF - 3.4} ${CAP_Y + 5.4} ${RIM_HALF - 2.1} ${RIM_Y - 3.6}`;

/* --- the pull ------------------------------------------------------------------
   The stretch at which the switch throws, the most the cord will give, the
   give's softness, and the pointer travel that still counts as a click. The
   cord's own stretch is a spring (`LEN_SPRING`) that stops bouncing at
   `LEN_DRAG`. */
const STOP = 26;
const MAX_STRETCH = 92;
const REACH = 70;
const CLICK_SLACK = 4;
const LEN_SPRING = 190;
const LEN_DRAG = 5.5;

/* --- where it hangs --------------------------------------------------------------
   `CLEARANCE` is the gap kept between the lamp and the rail's graduations on one
   side and the edge of the screen on the other; the lamp is sized to what is
   left and centred in it, so it can never meet the rail. */
const CLEARANCE = 3;
/** With no rails (a phone), how wide the lamp's strip at the screen's right edge is (px): inside the gutter, clear of the header. */
const BARE_STRIP = 16;

/* --- the light -----------------------------------------------------------------
   A soft pool falling from the bulb, in the lamp's own units: its middle and its
   two radii. It is drawn wider than the margin on purpose — the mask trims it to
   the strip — so it fills its channel instead of sitting inside it. `NEAR` is
   how close a pointer comes before the lamp answers it. */
const POOL_Y = 44;
const POOL_RX = 34;
const POOL_RY = 40;
const NEAR = 130;

/* What the light does to the graduations: how much length the brightest light
   takes away, how hard it bites, and the slow swell running down through them.
   `EDGE_FADE` is how many pixels the light fades over at the ruled line, so the
   boundary is a falling-off rather than a cut. */
const SHRINK = 0.6;
const GAIN = 1.8;
const SWELL = 0.18;
const SWELL_RATE = 1.4;
const EDGE_FADE = 3;

/** Rubber: the cord gives easily at first and less the harder it is hauled. */
const rubber = pull => MAX_STRETCH * pull / (pull + REACH);

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

export default function PullCord({ visible }) {
  const rootRef = useRef(null);
  const cordRef = useRef(null);
  const headRef = useRef(null);
  const lightRef = useRef(null);
  const poolRef = useRef(null);
  const maskRef = useRef(null);
  const edgeRef = useRef(null);
  const hitRef = useRef(null);
  const [scheme, setScheme] = useState(currentScheme);
  useEffect(() => onSchemeChange(setScheme), []);

  /* The whole state of the thing: how long the cord is, how fast that is
     changing, and how bright the lamp is. */
  const sim = useRef({ length: 0, give: 0, glow: 0, flare: 0, t: 0 });
  const drag = useRef(null);
  const pointer = useRef({ x: -9999, y: -9999 });
  const geom = useRef({ x: 0, rest: 0, scale: 1, ticks: [], left: 0, top: 0, offsetX: 0, offsetY: 0 });
  const ruled = useRef(new Set());
  const nightRef = useRef(false);
  nightRef.current = scheme === 'night';

  /**
   * Where the lamp hangs and how big it is. It is centred in the clear strip
   * between the rail's graduations and the edge of the screen, and sized so a
   * `CLEARANCE` gap is left on both sides. The light is masked to the margin.
   */
  const measure = () => {
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const found = document.querySelector('.rail--right');
    // On a phone there are no rails (Rails.css): the lamp hangs in a strip of its own at the screen's edge, with no
    // graduations to keep clear of or to light.
    const rail = found && found.getBoundingClientRect().width > 0 ? found : null;
    const scale = rail?.querySelector('.rail__scale');
    const railBox = rail?.getBoundingClientRect();
    const width = railBox ? railBox.width : BARE_STRIP;
    const left = railBox ? railBox.left - box.left : box.width - width;
    const room = Math.max(0, width - (rail ? TICK_LEN : 0) - CLEARANCE * 2);
    const fit = clamp(room / (RIM_HALF * 2), 0.3, 1.15);
    const scaleBox = scale?.getBoundingClientRect();

    if (maskRef.current) {
      maskRef.current.setAttribute('x', left.toFixed(2));
      maskRef.current.setAttribute('width', Math.max(0, box.width - left).toFixed(2));
      edgeRef.current.setAttribute('x1', left.toFixed(2));
      edgeRef.current.setAttribute('x2', (left + EDGE_FADE).toFixed(2));
    }

    geom.current = {
      x: left + (rail ? TICK_LEN : 0) + CLEARANCE + room / 2,
      rest: parseFloat(getComputedStyle(root).getPropertyValue('--cord-length')) || 120,
      scale: fit,
      ticks: scale ? Array.from(scale.querySelectorAll('.rail__tick')).map(el => ({ el, y: Number(el.dataset.y) })) : [],
      left: box.left,
      top: box.top,
      offsetX: scaleBox ? box.left - scaleBox.left : 0,
      offsetY: scaleBox ? box.top - scaleBox.top : 0,
    };
    if (!sim.current.length) sim.current.length = geom.current.rest;
  };

  /** Put the graduations back exactly the way Rails drew them. */
  const restore = () => {
    ruled.current.forEach(tick => tick.el.setAttribute('d', tickPath(tick.y)));
    ruled.current.clear();
  };

  /**
   * What the light does to the graduations. Each is asked how much of the pool
   * falls on its middle — in the lamp's own units, so the pool drawn and the
   * pool felt are the same shape — and gives up length from its far end in
   * proportion. The rail line itself is never touched.
   */
  const rule = (bx, by, glow) => {
    const { ticks, offsetX, offsetY, scale: k } = geom.current;
    if (!ticks.length) return;
    const t = sim.current.t;
    const still = new Set();
    for (const tick of ticks) {
      const y = tick.y + 0.5;
      let lit = 0;
      if (glow > 0.01) {
        const px = (TICK_LEN / 2 - offsetX - bx) / k;
        const py = (y - offsetY - by) / k;
        const u = px / POOL_RX;
        const v = (py - POOL_Y) / POOL_RY;
        const d2 = u * u + v * v;
        if (d2 < 1) {
          const below = clamp((py - RIM_Y) / 10, 0, 1);
          const swell = 1 - SWELL + SWELL * Math.sin(py * 0.14 - t * SWELL_RATE);
          lit = clamp(GAIN * glow * (1 - d2) ** 2 * below * swell, 0, 1);
        }
      }
      if (lit < 0.02) continue;
      const end = TICK_LEN * (1 - lit * SHRINK);
      tick.el.setAttribute('d', `M0 ${y}H${end.toFixed(2)}`);
      still.add(tick);
    }
    ruled.current.forEach(tick => { if (!still.has(tick)) tick.el.setAttribute('d', tickPath(tick.y)); });
    ruled.current = still;
  };

  /** Draw the cord, the lamp and its light at the cord's current length. */
  const paint = () => {
    const s = sim.current;
    const { x, scale: k } = geom.current;
    const y = s.length;

    cordRef.current.setAttribute('d', `M${x.toFixed(2)} 0V${y.toFixed(2)}`);
    const frame = `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(3)})`;
    headRef.current.setAttribute('transform', frame);
    poolRef.current.setAttribute('transform', frame);
    lightRef.current.setAttribute('opacity', clamp(s.glow, 0, 1).toFixed(3));
    hitRef.current.style.transform = `translate(${x.toFixed(1)}px, ${(y + HEAD_MID * k).toFixed(1)}px)`;

    rule(x, y, clamp(s.glow, 0, 1));
  };

  /** The switch throws. */
  const click = () => {
    toggleScheme();
    sim.current.flare = 1;
  };

  /** A short tug: the cord hauls itself to the stop, throws, and lets go. */
  const tug = () => {
    if (reducedMotion) { click(); return; }
    const s = sim.current;
    gsap.killTweensOf(s, 'length');
    gsap.to(s, {
      length: geom.current.rest + STOP * 1.1,
      duration: 0.2,
      ease: 'power2.in',
      onComplete() { click(); s.give = -220; },
    });
  };

  const onPointerDown = event => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gsap.killTweensOf(sim.current, 'length');
    drag.current = { id: event.pointerId, from: event.clientY, moved: false, thrown: false };
  };

  const onPointerMove = event => {
    const d = drag.current;
    if (!d || event.pointerId !== d.id || reducedMotion) return;
    const s = sim.current;
    // Only the downward pull counts: the lamp does not follow the hand sideways.
    const pull = Math.max(0, event.clientY - d.from);
    if (pull > CLICK_SLACK) d.moved = true;
    s.length = geom.current.rest + rubber(pull);
    s.give = 0;
    if (!d.thrown && s.length - geom.current.rest >= STOP) { d.thrown = true; click(); }
  };

  const onPointerUp = event => {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) tug();
  };

  const onKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tug(); }
  };

  // One ticker drives the cord's stretch, the brightness and the drawing.
  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    const s = sim.current;
    s.length = geom.current.rest;
    s.glow = 0;

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener('resize', measure);
    const onPointer = event => { pointer.current = { x: event.clientX, y: event.clientY }; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    const stop = () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer);
      restore();
    };

    if (reducedMotion) {
      s.glow = nightRef.current ? 0.15 : 0.75;
      paint();
      const off = onSchemeChange(next => { s.glow = next === 'night' ? 0.15 : 0.75; paint(); });
      return () => { off(); stop(); };
    }

    const step = () => {
      const dt = Math.min(gsap.ticker.deltaRatio() / 60, 1 / 20);
      s.t += dt;

      if (!drag.current) {
        // The cord's own stretch, springing back to its length.
        s.give += (geom.current.rest - s.length) * LEN_SPRING * dt;
        s.give *= Math.exp(-LEN_DRAG * dt);
        s.length += s.give * dt;
      }

      // The light answers a pointer coming near, and flares as the switch
      // throws; under all of it, a slow breath so it is never quite steady.
      const { x, scale: k, left, top } = geom.current;
      const near = 1 - clamp(Math.hypot(pointer.current.x - (left + x), pointer.current.y - (top + s.length + HEAD_MID * k)) / NEAR, 0, 1);
      const breath = 1 + 0.04 * Math.sin(s.t * 0.77);
      s.flare *= Math.exp(-4 * dt);
      const want = clamp(((nightRef.current ? 0.15 : 0.75) + near * 0.4 + s.flare * 0.5) * breath, 0, 1.3);
      s.glow += (want - s.glow) * Math.min(1, dt * 7);
      root.classList.toggle('cord--near', near > 0.25);

      paint();
    };
    gsap.ticker.add(step);
    return () => { gsap.ticker.remove(step); stop(); };
  }, []);

  // The lamp arrives when the loader hands over: lowered on its cord from the
  // top edge, settling with a small bounce.
  useLayoutEffect(() => {
    if (!visible) return;
    measure();
    const s = sim.current;
    gsap.set(rootRef.current, { autoAlpha: 1 });
    if (reducedMotion) { s.length = geom.current.rest; paint(); return; }
    s.length = 12;
    s.give = 0;
  }, [visible]);

  const night = scheme === 'night';
  const note = night ? 'turn the lights on' : 'turn the lights off';

  return (
    // `data-keeps-clock-open`: pressing the lamp while the clock is open must
    // switch the lights without the clock taking it as a click outside.
    <div className={`cord${visible ? ' cord--visible' : ''}${night ? ' cord--night' : ''}`} ref={rootRef} data-keeps-clock-open="">
      <svg className="cord__wire" aria-hidden="true" focusable="false">
        <defs>
          {/* The pool of light: brightest just under the bulb, falling away
              downwards and to the sides. The gradient's circle is exactly the
              ellipse, so it reaches nothing at the ellipse's edge — any wider
              and the edge of the shape shows as a faint hard arc. */}
          <radialGradient id="cord-pool" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.26">
            <stop className="cord__stop cord__stop--pool" offset="0" />
            <stop className="cord__stop cord__stop--pool-mid" offset="0.42" />
            <stop className="cord__stop cord__stop--out" offset="1" />
          </radialGradient>
          <radialGradient id="cord-bloom">
            <stop className="cord__stop cord__stop--bloom" offset="0" />
            <stop className="cord__stop cord__stop--out" offset="1" />
          </radialGradient>
          <radialGradient id="cord-bulb" cx="0.42" cy="0.4" r="0.62">
            <stop className="cord__stop cord__stop--filament" offset="0" />
            <stop className="cord__stop cord__stop--filament" offset="0.5" />
            <stop className="cord__stop cord__stop--glass" offset="1" />
          </radialGradient>
          {/* The light's channel: the margin, and nothing but. Black hides,
              white shows, and the few pixels at the ruled line are a fade. */}
          <linearGradient id="cord-edge" gradientUnits="userSpaceOnUse" ref={edgeRef} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id="cord-margin" maskUnits="userSpaceOnUse">
            <rect ref={maskRef} x="0" y="-120" width="0" height="1400" fill="url(#cord-edge)" />
          </mask>
        </defs>
        <g className="cord__light" ref={lightRef} mask="url(#cord-margin)">
          <g ref={poolRef}>
            <ellipse className="cord__pool" cx="0" cy={POOL_Y} rx={POOL_RX} ry={POOL_RY} />
            <circle className="cord__bloom" cx="0" cy={BULB_Y} r="12" />
          </g>
        </g>
        <path className="cord__line" ref={cordRef} d="" />
        <g ref={headRef}>
          <rect className="cord__neck" x={-NECK_HALF} y="-0.5" width={NECK_HALF * 2} height={NECK_H} rx="1.5" />
          <path className="cord__shade" d={SHADE} />
          <ellipse className="cord__mouth" cx="0" cy={RIM_Y} rx={RIM_HALF - 0.8} ry={MOUTH_RY - 0.5} />
          <circle className="cord__bulb" cx="0" cy={BULB_Y} r={BULB_R} />
          <path className="cord__sheen" d={SHEEN} />
        </g>
      </svg>
      <button
        type="button"
        className="cord__hit"
        ref={hitRef}
        role="switch"
        aria-checked={night}
        aria-label={note}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span className="cord__note" aria-hidden="true">{note}</span>
      </button>
    </div>
  );
}
