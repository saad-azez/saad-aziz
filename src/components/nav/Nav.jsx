import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import { useKarachiTime } from '../../lib/useKarachiTime.js';
import './Nav.css';

/**
 * The head rail.
 *
 * The site's navigation, built as the third drafting margin: a ruled strip
 * across the top that the two side rails hang from. It is a ruler, and the
 * page is what it measures — the name is the zero at its left end, the
 * sections are numbered graduations along it, the Karachi clock closes the
 * far end.
 *
 * The one moving part is a verdigris bead on the bottom edge. It rests on the
 * current section's tick (or on the zero, when no section is current), and
 * when the pointer reaches a station it launches there with mass behind it —
 * overshooting, settling, stretching with its own speed on the way — then
 * comes home when the pointer leaves. One pulse; everything else is still.
 */

const STATIONS = [
  { id: 'work', index: '01', label: 'Work' },
  { id: 'about', index: '02', label: 'About' },
  { id: 'contact', index: '03', label: 'Contact' },
];

/** How much the bead lengthens per px/ms of travel, and the most it may. */
const STRETCH = 1.4;
const STRETCH_MAX = 3;

function fromHash() {
  const id = window.location.hash.slice(1);
  return STATIONS.some(station => station.id === id) ? id : null;
}

export default function Nav({ visible, animate, active: controlled, onNavigate }) {
  const time = useKarachiTime();
  const rootRef = useRef(null);
  const beadRef = useRef(null);
  const originRef = useRef(null);
  const linkRefs = useRef({});
  const [hashActive, setActive] = useState(fromHash);
  // Controlled by the page's scroll position when a parent passes `active`;
  // otherwise the hash and clicks decide.
  const active = controlled === undefined ? hashActive : controlled;
  const activeRef = useRef(active);
  activeRef.current = active;

  /** A station's centre, or the zero — the name's left edge — in nav space. */
  const xOf = useCallback((element, edge = 'centre') => {
    const nav = rootRef.current.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return (edge === 'start' ? box.left : (box.left + box.right) / 2) - nav.left;
  }, []);

  /** Send the bead to `x`. Elastic, and stretched by how fast it is going. */
  const travel = useCallback((x, immediate = false) => {
    const bead = beadRef.current;
    if (!bead) return;
    gsap.killTweensOf(bead, 'x,scaleX,scaleY');
    if (immediate) { gsap.set(bead, { x, scaleX: 1, scaleY: 1 }); return; }
    if (reducedMotion) { gsap.to(bead, { x, duration: .2, ease: EASE.blend }); return; }
    const setWide = gsap.quickSetter(bead, 'scaleX');
    const setTall = gsap.quickSetter(bead, 'scaleY');
    let lastX = Number(gsap.getProperty(bead, 'x'));
    let lastT = gsap.ticker.time;
    gsap.to(bead, {
      x,
      duration: 1.1,
      ease: EASE.land,
      onUpdate() {
        const now = gsap.ticker.time;
        const here = Number(gsap.getProperty(bead, 'x'));
        const speed = Math.abs(here - lastX) / Math.max(now - lastT, 1 / 240) / 1000;
        lastX = here;
        lastT = now;
        const stretch = Math.min(1 + speed * STRETCH, STRETCH_MAX);
        setWide(stretch);
        setTall(1 / Math.sqrt(stretch));
      },
      onComplete() { setWide(1); setTall(1); },
    });
  }, []);

  /** Home: the active station's tick, or the zero. */
  const rest = useCallback((immediate = false) => {
    const link = activeRef.current && linkRefs.current[activeRef.current];
    if (link) travel(xOf(link), immediate);
    else if (originRef.current) travel(xOf(originRef.current, 'start'), immediate);
  }, [travel, xOf]);

  useLayoutEffect(() => {
    // `x` is the bead's centre from here on.
    gsap.set(beadRef.current, { xPercent: -50 });
    rest(true);
    const observer = new ResizeObserver(() => rest(true));
    observer.observe(rootRef.current);
    document.fonts?.ready.then(() => rest(true));
    const onHash = () => setActive(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => { observer.disconnect(); window.removeEventListener('hashchange', onHash); };
  }, [rest]);

  useEffect(() => { rest(); }, [active, rest]);

  useLayoutEffect(() => {
    if (!animate) return;
    // The ruler is drawn in from the zero; the labels rise as it passes under
    // them; the bead drops onto the rail last. Starts on the loader's
    // completion signal, alongside the hero's own text.
    const context = gsap.context(() => {
      const root = rootRef.current;
      const edge = root.querySelectorAll('.nav__rule, .nav__scale');
      const labels = [root.querySelector('.nav__origin'), ...root.querySelectorAll('.nav__station'), root.querySelector('.nav__meta')];
      gsap.set(labels, { willChange: 'transform, opacity' });
      gsap.timeline({ defaults: { ease: EASE.arrive } })
        .fromTo(edge, { scaleX: 0 }, { scaleX: 1, duration: reducedMotion ? .2 : 1.1 }, 0)
        .fromTo(labels,
          { autoAlpha: 0, y: reducedMotion ? 0 : 8 },
          { autoAlpha: 1, y: 0, duration: reducedMotion ? .2 : .85, stagger: reducedMotion ? 0 : .07, clearProps: 'transform,willChange' }, 0)
        .fromTo(beadRef.current,
          { autoAlpha: 0, y: reducedMotion ? 0 : -6 },
          { autoAlpha: 1, y: 0, duration: reducedMotion ? .2 : .7, ease: reducedMotion ? EASE.blend : EASE.landTight }, reducedMotion ? 0 : .5);
    }, rootRef);
    return () => context.revert();
  }, [animate]);

  return (
    <nav className={`nav${visible ? ' nav--visible' : ''}`} ref={rootRef} aria-label="Primary">
      <a
        className="nav__origin"
        href="/"
        ref={originRef}
        onClick={event => { if (onNavigate) { event.preventDefault(); onNavigate('top'); } }}
        onPointerEnter={() => travel(xOf(originRef.current, 'start'))}
        onPointerLeave={() => rest()}
        onFocus={() => travel(xOf(originRef.current, 'start'))}
        onBlur={() => rest()}
      >
        Saad Aziz
      </a>
      <ul className="nav__stations" onPointerLeave={() => rest()}>
        {STATIONS.map(station => {
          const current = active === station.id;
          return (
            <li className="nav__station" key={station.id}>
              <a
                className={`nav__link${current ? ' nav__link--active' : ''}`}
                href={`#${station.id}`}
                ref={element => { linkRefs.current[station.id] = element; }}
                aria-current={current ? 'location' : undefined}
                onPointerEnter={event => travel(xOf(event.currentTarget))}
                onFocus={event => travel(xOf(event.currentTarget))}
                onBlur={() => rest()}
                onClick={event => { setActive(station.id); if (onNavigate) { event.preventDefault(); onNavigate(station.id); } }}
              >
                <span className="nav__index">{station.index}</span>
                <span className="nav__word">{station.label}</span>
              </a>
              <span className={`nav__tick${current ? ' nav__tick--active' : ''}`} aria-hidden="true" />
            </li>
          );
        })}
      </ul>
      <span className="nav__meta">
        Karachi <span className="nav__clock">{time}</span> local
      </span>
      <span className="nav__rule" aria-hidden="true" />
      <span className="nav__scale" aria-hidden="true" />
      <span className="nav__bead" ref={beadRef} aria-hidden="true" />
    </nav>
  );
}
