import { useId, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import './Loader.css';

// Outline, tooth seam, four tooth divisions, then the cheek scar and stitches.
// Every line is drawn in ink; these windows share the percentage's progress.
const STROKES = [
  [0, .43, 1.7], [.08, .59, 1.7], [.34, .69, 1.25], [.34, .69, 1.25],
  [.49, .70, 1.25], [.49, .70, 1.25], [.55, .76, 1.25], [.55, .76, 1.25],
  [.61, .82, 1.25], [.61, .82, 1.25], [.67, .88, 1.25], [.67, .88, 1.25],
  [.68, .92, 1.3], [.80, .96, 1.3], [.87, 1, 1.3],
];

// A four-point anime glint. The same contour becomes the opening onto the page.
const GLINT = 'M0 -1 C.12 -.16 .16 -.12 1 0 C.16 .12 .12 .16 0 1 C-.12 .16 -.16 .12 -1 0 C-.16 -.12 -.12 -.16 0 -1 Z';

// A straight, closed grin. The two tooth seams share the same contour,
// so the teeth stay together throughout loading and the sparkle reveal.
const CLOSED = {
  top: [12,34, 8,14,12,7,24,9, 68,16,126,16,170,9, 182,7,186,14,182,34],
  bottom: [182,34, 179,70,146,96,97,96, 48,96,15,70,12,34],
  upper: [12,34, 37,42,67,44,97,44, 127,44,157,42,182,34],
  lower: [182,34, 157,42,127,44,97,44, 67,44,37,42,12,34],
};

function curve(points) {
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 6) d += ` C${points.slice(i, i + 6).join(' ')}`;
  return d;
}

// Sample a tooth edge and its outward normal so creases follow the drawn jaw.
function edgePoint(points, progress) {
  const segments = (points.length - 2) / 6;
  const segment = Math.min(segments - 1, Math.floor(progress * segments));
  const t = progress * segments - segment, v = 1 - t;
  const i = segment * 6;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = points.slice(i, i + 8);
  const x = v ** 3 * x0 + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t ** 3 * x3;
  const y = v ** 3 * y0 + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t ** 3 * y3;
  const dx = 3 * v * v * (x1 - x0) + 6 * v * t * (x2 - x1) + 3 * t * t * (x3 - x2);
  const dy = 3 * v * v * (y1 - y0) + 6 * v * t * (y2 - y1) + 3 * t * t * (y3 - y2);
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, nx: dy / length, ny: -dx / length };
}

function smilePaths(progress, pull) {
  const grow = progress * progress * (3 - 2 * progress);
  const stretch = (.78 + .22 * grow) * (1 + .25 * pull);
  const pose = {};
  for (const key of ['top', 'bottom', 'upper', 'lower']) {
    pose[key] = CLOSED[key].map((value, i) => i % 2 ? value : 97 + (value - 97) * stretch);
  }

  const { top, bottom, upper, lower } = pose;
  const paths = [curve(top), curve(bottom), curve(upper), curve(lower)];
  // Keep all eight creases attached to their own tooth band as the grin widens.
  for (const u of [.10, .21, .81, .92]) {
    const a = edgePoint(upper, u);
    const b = edgePoint(lower, 1 - u);
    const outside = edgePoint(bottom, 1 - u);
    const dx = outside.x - b.x, dy = outside.y - b.y;
    const depth = Math.min(.75, 14 / (Math.hypot(dx, dy) || 1));
    const bend = u < .5 ? 1.2 : -1.2;
    paths.push(`M${a.x + a.nx * 15} ${a.y + a.ny * 15} Q${a.x + a.nx * 7 + bend} ${a.y + a.ny * 7} ${a.x} ${a.y}`);
    paths.push(`M${b.x} ${b.y} Q${b.x + dx * depth * .5 + bend * .5} ${b.y + dy * depth * .5} ${b.x + dx * depth} ${b.y + dy * depth}`);
  }
  // Keep the scar above the cheek, clear of the moving lip, without dragging
  // it sideways with the stretch. The mouth stays level and closed.
  const scarX = 121 + 3 * pull;
  const scarY = -39 - 2 * pull;
  paths.push(
    `M${scarX} ${scarY} C${scarX + 18} ${scarY + 7} ${scarX + 47} ${scarY - 1} ${scarX + 64} ${scarY - 16}`,
    `M${scarX + 23} ${scarY - 6} Q${scarX + 25} ${scarY + 2} ${scarX + 25} ${scarY + 10}`,
    `M${scarX + 47} ${scarY - 17} Q${scarX + 50} ${scarY - 10} ${scarX + 54} ${scarY - 5}`,
  );
  return { paths, tooth: edgePoint(upper, .80) };
}

export default function Loader({ tracker, onReveal, onFinish }) {
  const id = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const readoutRef = useRef(null);
  const numberRef = useRef(null);
  const svgRef = useRef(null);
  const smileRef = useRef(null);
  const glintRef = useRef(null);
  const openingRef = useRef(null);
  const callbacks = useRef({ onReveal, onFinish });
  callbacks.current = { onReveal, onFinish };

  useLayoutEffect(() => {
    const counter = { value: 0 };
    const mouth = { pull: 0 };
    const sparkle = { blink: 0, reveal: 0 };
    const ink = smileRef.current.querySelectorAll('.loader__smile-ink');
    let exiting = false, cancelled = false, exit;
    let width = innerWidth, height = innerHeight;

    const paintMouth = () => {
      const { paths, tooth } = smilePaths(reducedMotion ? 1 : counter.value / 100, mouth.pull);
      ink.forEach((path, index) => path.setAttribute('d', paths[index]));
      const base = Math.max(180, Math.min(270, width * .2)) / 194;
      const transform = `translate(${width / 2} ${height / 2}) scale(${base}) translate(-97 -54)`;
      smileRef.current.setAttribute('transform', transform);
      // Anchor the shine to the right-hand tooth surface, not beside the face.
      const x = width / 2 + (tooth.x - 97) * base;
      const y = height / 2 + (tooth.y - 54) * base;
      const farthest = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
      // Keep the reference's tall, narrow shape in the site's original palette.
      // Account for that aspect ratio and the concave diagonals at full reveal.
      const smallRadius = 24 * base * sparkle.blink;
      const radius = smallRadius + farthest * 6.8 * sparkle.reveal;
      const glintTransform = `translate(${x} ${y}) scale(${radius * .52} ${radius})`;
      glintRef.current.setAttribute('transform', glintTransform);
      openingRef.current.setAttribute('transform', glintTransform);
      const blend = Math.min(1, sparkle.reveal / .035);
      const aperture = blend * blend * (3 - 2 * blend);
      openingRef.current.style.opacity = aperture;
      glintRef.current.style.fillOpacity = 1 - aperture;
      glintRef.current.style.opacity = Math.min(1, sparkle.blink) * (1 - Math.min(1, sparkle.reveal / .18));
      rootRef.current.dataset.phase = sparkle.reveal > 0 ? 'reveal' : sparkle.blink > 0 ? 'sparkle' : mouth.pull !== 0 ? 'stretch' : 'loading';
    };
    const paint = () => {
      numberRef.current.textContent = String(Math.round(counter.value)).padStart(3, '0');
      rootRef.current.setAttribute('aria-valuenow', String(Math.round(counter.value)));
      const progress = counter.value / 100;
      ink.forEach((path, index) => {
        const [start, end] = STROKES[index];
        const drawn = Math.max(0, Math.min(1, (progress - start) / (end - start)));
        path.style.strokeDashoffset = reducedMotion ? 0 : 1 - drawn;
        path.style.opacity = reducedMotion ? .35 + .65 * progress : drawn > 0 ? 1 : 0;
      });
      paintMouth();
    };
    const resize = () => {
      width = innerWidth; height = innerHeight;
      svgRef.current.setAttribute('viewBox', `0 0 ${width} ${height}`);
      paintMouth();
    };
    resize(); paint();
    window.addEventListener('resize', resize);
    const entrance = gsap.from(readoutRef.current, {
      yPercent: 120, autoAlpha: 0, duration: reducedMotion ? .3 : 1.1, ease: EASE.arrive, delay: .15,
    });
    tracker.set('boot', 1);
    const unsubscribe = tracker.subscribe((raw, settled) => {
      if (cancelled || exiting) return;
      if (!settled) {
        gsap.to(counter, { value: Math.min(99, raw * 100), duration: .9, ease: 'power2.out', overwrite: true, onUpdate: paint });
        return;
      }
      exiting = true;
      gsap.killTweensOf(counter);
      exit = gsap.timeline({ onComplete: () => { if (!cancelled) callbacks.current.onFinish?.(); } })
        .to(counter, { value: 100, duration: reducedMotion ? .2 : .55, ease: 'power2.inOut', onUpdate: paint });
      if (reducedMotion) {
        exit.call(() => { if (!cancelled) callbacks.current.onReveal?.(); })
          .to(rootRef.current, { autoAlpha: 0, duration: .25 });
      } else {
        // Hold the closed grin. A right-side glint twinkles twice, then
        // its own shape opens onto the hero while the expression stays still.
        exit.to(mouth, { pull: -.12, duration: .12, ease: 'power2.in', onUpdate: paintMouth })
          .addLabel('grin')
          .to(mouth, { pull: 1, duration: .30, ease: 'back.out(1.4)', onUpdate: paintMouth }, 'grin')
          .to(mouth, { pull: .75, duration: .16, ease: 'power2.out', onUpdate: paintMouth }, 'grin+=.30')
          .to(sparkle, { blink: 1, duration: .16, ease: 'back.out(1.5)', onUpdate: paintMouth }, 'grin+=.47')
          .to(sparkle, { blink: .12, duration: .12, ease: 'sine.inOut', onUpdate: paintMouth }, 'grin+=.64')
          .to(sparkle, { blink: 1, duration: .18, ease: 'back.out(1.3)', onUpdate: paintMouth }, 'grin+=.82')
          .call(() => { if (!cancelled) callbacks.current.onReveal?.(); }, [], 'grin+=1.05')
          .to(sparkle, { reveal: 1, duration: 1.10, ease: 'power2.inOut', onUpdate: paintMouth }, 'grin+=1.05')
          .to(readoutRef.current, { autoAlpha: 0, yPercent: -15, duration: .28, ease: 'sine.inOut' }, 'grin+=.10');
      }
    });
    return () => {
      cancelled = true; unsubscribe(); entrance.kill(); exit?.kill();
      gsap.killTweensOf(counter); window.removeEventListener('resize', resize);
    };
  }, [tracker]);

  return (
    <div ref={rootRef} className="loader" role="progressbar" aria-label="Loading Saad Aziz portfolio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
      <svg ref={svgRef} className="loader__stage" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-wash`} r="75%">
            <stop offset="0" stopColor="var(--ground-glow)" />
            <stop offset=".65" stopColor="var(--ground)" />
            <stop offset="1" stopColor="var(--ground-edge)" />
          </radialGradient>
          <mask id={`${id}-opening`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
            <rect width="100%" height="100%" fill="white" />
            <path ref={openingRef} d={GLINT} fill="black" />
          </mask>
        </defs>
        <g mask={`url(#${id}-opening)`}>
          <rect className="loader__wash" width="100%" height="100%" fill={`url(#${id}-wash)`} />
          <g ref={smileRef} className="loader__smile" fill="none">
            {STROKES.map(([, , strokeWidth], index) => (
              <path key={index} className={`loader__smile-ink${index >= 12 ? ' loader__scar' : ''}`} pathLength="1" strokeWidth={strokeWidth} />
            ))}
          </g>
        </g>
        <path ref={glintRef} className="loader__glint" d={GLINT} vectorEffect="non-scaling-stroke" />
      </svg>
      <div ref={readoutRef} className="loader__readout">
        <span ref={numberRef} className="loader__count">000</span>
        <span className="loader__unit">%</span>
      </div>
    </div>
  );
}
