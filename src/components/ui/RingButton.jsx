import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import monogramRing from '../../assets/monogram-ring.svg?raw';
import './RingButton.css';

/*
 * THE RULE: every button wears the logo's ring as its border.
 *
 * The border is the monogram's own filled ring path, never a CSS border. A
 * round button shows the ring whole. A wider button cuts the ring down its
 * vertical centre line, puts the two halves at either end and bridges them
 * with straight bands exactly as thick as the ring at twelve and six o'clock.
 * Nothing is stretched, so the stroke keeps the logo's weight, wobble and
 * notch at any width, and its thickness is the logo's own share of the height.
 *
 * Measured from the path, in its 972-unit box: the ink spans x 9–964 and
 * y 12.5–958.5; the centre line is x 486.5, where the band runs y 12.5–36 at
 * the top and 934–958.5 at the bottom.
 */
const RING = / d="([^"]+)"/.exec(monogramRing)?.[1] ?? '';
const LEFT = 9;
const RIGHT = 964;
const TOP = 12.5;
const TALL = 958.5 - TOP;
const MID = 486.5;
const BANDS = [[12.5, 36], [934, 958.5]];

export function RingBorder({ shape = 'pill' }) {
  const path = <path d={RING} fillRule="evenodd" />;
  if (shape === 'round') {
    return (
      <span className="ring-border ring-border--round" aria-hidden="true">
        <svg viewBox={`${LEFT} ${TOP} ${RIGHT - LEFT} ${TALL}`} focusable="false">{path}</svg>
      </span>
    );
  }
  return (
    <span className="ring-border" aria-hidden="true">
      <svg className="ring-border__cap" viewBox={`${LEFT} ${TOP} ${MID - LEFT} ${TALL}`} preserveAspectRatio="xMinYMid meet" focusable="false">{path}</svg>
      <svg className="ring-border__span" viewBox={`0 ${TOP} 1 ${TALL}`} preserveAspectRatio="none" focusable="false">
        {BANDS.map(([from, to]) => <rect key={from} x="0" y={from} width="1" height={to - from} />)}
      </svg>
      <svg className="ring-border__cap" viewBox={`${MID} ${TOP} ${RIGHT - MID} ${TALL}`} preserveAspectRatio="xMaxYMid meet" focusable="false">{path}</svg>
    </span>
  );
}

/**
 * A link or button inside the logo's ring.
 * `motion` adds the GSAP hover and click behaviour; `arrow` adds a ↗ that
 * swaps on hover.
 */
export default function RingButton({ as: Tag = 'a', shape = 'pill', motion = false, arrow = false, className = '', children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => (motion ? animate(ref.current) : undefined), [motion]);
  const classes = ['ring-btn', `ring-btn--${shape}`, className].filter(Boolean).join(' ');
  const type = Tag === 'button' && !rest.type ? { type: 'button' } : null;
  return (
    <Tag ref={ref} className={classes} {...type} {...rest}>
      {motion && <span className="ring-btn__flood" aria-hidden="true"><span className="ring-btn__blob" /></span>}
      <RingBorder shape={shape} />
      <span className="ring-btn__label">
        {children}
        {arrow && <span className="ring-btn__arrow" aria-hidden="true"><span>↗</span><span>↗</span></span>}
      </span>
    </Tag>
  );
}

/*
 * Hover (mouse and pen): ink floods in from where the pointer entered, the
 * label turns ground-coloured, the ring turns accent like the logo's does,
 * the ↗ flies out and a fresh one flies in, and the button leans a few pixels
 * toward the pointer. Leaving drains the ink toward the exit point.
 * Keyboard focus floods from the centre.
 * Click: the button squashes on press and lands with a spring, and two copies
 * of the ring ripple outward, the way the clock's rings sound.
 * Reduced motion keeps only the colour change, with no movement.
 */
function animate(el) {
  if (!el) return undefined;
  const flood = el.querySelector('.ring-btn__flood');
  const blob = el.querySelector('.ring-btn__blob');
  const label = el.querySelector('.ring-btn__label');
  const border = el.querySelector('.ring-border');
  const arrows = [...el.querySelectorAll('.ring-btn__arrow > span')];
  let hovering = false;
  let focused = false;
  let pressed = false;
  let front = 0;

  gsap.set(blob, { xPercent: -50, yPercent: -50, scale: 0 });

  const local = e => {
    const box = el.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (el.offsetWidth / box.width),
      y: (e.clientY - box.top) * (el.offsetHeight / box.height),
    };
  };
  const centre = () => ({ x: el.offsetWidth / 2, y: el.offsetHeight / 2 });

  // The ink is a circle centred on a point, just big enough to cover the
  // button from there. Re-centring it while it covers everything is invisible.
  const place = ({ x, y }) => {
    const w = flood.offsetWidth;
    const h = flood.offsetHeight;
    const px = x - flood.offsetLeft;
    const py = y - flood.offsetTop;
    const r = Math.hypot(Math.max(px, w - px), Math.max(py, h - py)) + 1;
    // autoRound off: GSAP would round the size down to whole pixels.
    gsap.set(blob, { left: px, top: py, width: r * 2, height: r * 2, autoRound: false });
  };
  const token = name => getComputedStyle(el).getPropertyValue(name).trim();

  const fill = point => {
    if (gsap.getProperty(blob, 'scale') < 0.02) place(point);
    gsap.to(blob, { scale: 1, duration: reducedMotion ? 0 : 0.6, ease: EASE.arrive, overwrite: true });
    gsap.to(label, { color: token('--ground'), duration: reducedMotion ? 0 : 0.28, ease: EASE.blend, overwrite: 'auto' });
  };
  const drain = point => {
    if (point && gsap.getProperty(blob, 'scale') > 0.98) place(point);
    gsap.to(blob, { scale: 0, duration: reducedMotion ? 0 : 0.5, ease: 'power3.inOut', overwrite: true });
    gsap.to(label, { color: token('--ink'), duration: reducedMotion ? 0 : 0.3, ease: EASE.blend, overwrite: 'auto', clearProps: 'color' });
  };

  const swapArrow = () => {
    if (reducedMotion || arrows.length < 2) return;
    const travel = arrows[0].parentElement.offsetWidth;
    const out = arrows[front];
    const into = arrows[1 - front];
    front = 1 - front;
    gsap.to(out, { x: travel, y: -travel, duration: 0.3, ease: EASE.leave, overwrite: true });
    gsap.fromTo(into,
      { x: -travel, y: travel, visibility: 'visible' },
      { x: 0, y: 0, duration: 0.55, delay: 0.14, ease: EASE.arrive, overwrite: true });
  };

  const pullX = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
  const pullY = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
  const leanX = gsap.quickTo(label, 'x', { duration: 0.6, ease: 'power3.out' });
  const leanY = gsap.quickTo(label, 'y', { duration: 0.6, ease: 'power3.out' });
  const settle = () => { pullX(0); pullY(0); leanX(0); leanY(0); };

  const press = () => {
    if (reducedMotion) return;
    pressed = true;
    gsap.to(el, { scale: 0.93, duration: 0.14, ease: 'power2.out', overwrite: 'auto' });
  };
  const release = () => {
    if (!pressed) return;
    pressed = false;
    gsap.to(el, { scale: 1, duration: 0.8, ease: EASE.landTight, overwrite: 'auto' });
  };

  const ripple = () => {
    if (reducedMotion) return;
    [10, 20].forEach((reach, i) => {
      const echo = border.cloneNode(true);
      echo.classList.add('ring-border--echo');
      el.appendChild(echo);
      gsap.fromTo(echo,
        { top: 0, right: 0, bottom: 0, left: 0, opacity: 0.9 },
        { top: -reach, right: -reach, bottom: -reach, left: -reach, opacity: 0, duration: 0.8, delay: i * 0.12, ease: 'power2.out', onComplete: () => echo.remove() });
    });
  };

  const onEnter = e => {
    if (e.pointerType === 'touch') return;
    hovering = true;
    fill(local(e));
    swapArrow();
  };
  const onMove = e => {
    if (!hovering || reducedMotion) return;
    const p = local(e);
    const dx = p.x - el.offsetWidth / 2;
    const dy = p.y - el.offsetHeight / 2;
    pullX(dx * 0.12); pullY(dy * 0.2);
    leanX(dx * 0.06); leanY(dy * 0.1);
  };
  const onLeave = e => {
    release();
    if (!hovering) return;
    hovering = false;
    settle();
    if (!focused) drain(local(e));
  };
  const onDown = e => { if (e.button === 0) press(); };
  const onClick = e => {
    // A keyboard press has no pointerdown: squash and land in one go.
    if (e.detail === 0 && !reducedMotion) {
      gsap.timeline()
        .to(el, { scale: 0.93, duration: 0.1, ease: 'power2.out' })
        .to(el, { scale: 1, duration: 0.8, ease: EASE.landTight });
    }
    ripple();
  };
  const onFocus = () => {
    if (!el.matches(':focus-visible')) return;
    focused = true;
    fill(centre());
  };
  const onBlur = () => {
    if (!focused) return;
    focused = false;
    if (!hovering) drain();
  };

  const events = [
    ['pointerenter', onEnter], ['pointermove', onMove], ['pointerleave', onLeave],
    ['pointerdown', onDown], ['pointerup', release], ['pointercancel', release],
    ['click', onClick], ['focus', onFocus], ['blur', onBlur],
  ];
  events.forEach(([type, fn]) => el.addEventListener(type, fn));
  return () => {
    events.forEach(([type, fn]) => el.removeEventListener(type, fn));
    gsap.killTweensOf([el, blob, label, ...arrows]);
    gsap.set([el, label, ...arrows], { clearProps: 'all' });
    el.querySelectorAll('.ring-border--echo').forEach(echo => echo.remove());
  };
}
