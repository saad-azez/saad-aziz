import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import SketchClock from '../hero/SketchClock.jsx';
import RingButton from '../ui/RingButton.jsx';
import { sectionLink } from '../../lib/sectionLink.js';
import { PERSON, ABOUT, CONTACT } from '../../content/site.js';
import ring from '../../assets/monogram-ring.svg?raw';
import letters from '../../assets/monogram-letters.svg?raw';
import './SiteHeader.css';

/** The chapters, as the header names them while the reader is in one (none over the hero itself). */
const CHAPTERS = {
  work: { index: '01', label: 'Work' },
  about: { index: ABOUT.index, label: ABOUT.label },
  contact: { index: CONTACT.index, label: CONTACT.label },
};

/**
 * Where the reader is, at this scroll: the chapter (null over the hero), and
 * whether the header is over a pinned screen (the journey's, the about's),
 * whose own layout leaves the header its room, or over the page's own flow,
 * which runs on under it (then it has a ground of its own to be read on).
 */
function whereAt(scroll, vh) {
  const journey = document.querySelector('.journey'), about = document.querySelector('.about'), contact = document.querySelector('.contact');
  if (!journey) return { chapter: null, pinned: true };
  const top = node => node.getBoundingClientRect().top + scroll;
  const middle = scroll + vh / 2;
  let chapter = null;
  if (contact && middle >= top(contact)) chapter = 'contact';
  else if (about && middle >= top(about)) chapter = 'about';
  else if (journey.dataset.phase === 'work') chapter = 'work';
  const pinnedIn = node => node && scroll >= top(node) - 1 && scroll <= top(node) + node.offsetHeight - vh + 1;
  return { chapter, pinned: scroll <= top(journey) + journey.offsetHeight - vh + 1 || pinnedIn(about) };
}

/**
 * The site's header: the mark, the clock (which is the navigation) and the one
 * call to action, fixed at the top of the screen over every chapter, so the
 * clock is always there. It was the hero's own header; the hero keeps a spacer
 * its size (.hero__top--spacer), so the layout under it, and everything the
 * journey measures from it, is as it was. Beside the mark, the chapter the
 * reader is in.
 *
 * `visible`: held back until the loader hands over, like the rails;
 * `animate`: draws itself in with the hero's text.
 */
export default function SiteHeader({ visible, animate }) {
  const rootRef = useRef(null);
  const markRef = useRef(null);
  const ringRef = useRef(null);
  const [where, setWhere] = useState({ chapter: null, pinned: true });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const next = whereAt(window.scrollY, window.innerHeight);
      setWhere(was => (was.chapter === next.chapter && was.pinned === next.pinned ? was : next));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The journey says when its phase changes (hero → work) without the page having scrolled far.
    const journey = document.querySelector('.journey');
    const observer = journey ? new MutationObserver(schedule) : null;
    observer?.observe(journey, { attributes: true, attributeFilter: ['data-phase'] });
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  // The monogram is a coin. Under the pointer its ring spins on the vertical
  // axis — winding up to speed, holding while the pointer stays, and coasting
  // to a stop on the next face-on turn once it leaves. The letters never move.
  useEffect(() => {
    const mark = markRef.current;
    const face = ringRef.current;
    if (!mark || !face || reducedMotion) return;
    const SPIN = 420; // degrees per second, once wound up
    const coin = { angle: 0, speed: 0 };
    let ticking = false;
    const paint = () => { face.style.transform = `rotateY(${coin.angle}deg)`; };
    const tick = (_, delta) => {
      const dt = Math.min(delta, 50) / 1000;
      coin.speed += (SPIN - coin.speed) * Math.min(1, dt * 5);
      coin.angle += coin.speed * dt;
      paint();
    };
    const enter = () => {
      gsap.killTweensOf(coin);
      if (!ticking) { ticking = true; gsap.ticker.add(tick); }
    };
    const leave = () => {
      gsap.ticker.remove(tick);
      ticking = false;
      const rest = Math.ceil((coin.angle + 1) / 360) * 360;
      gsap.to(coin, { angle: rest, speed: 0, duration: .8 + (rest - coin.angle) / 540, ease: 'power3.out', onUpdate: paint });
    };
    mark.addEventListener('pointerenter', enter);
    mark.addEventListener('pointerleave', leave);
    return () => {
      mark.removeEventListener('pointerenter', enter);
      mark.removeEventListener('pointerleave', leave);
      gsap.ticker.remove(tick);
      gsap.killTweensOf(coin);
    };
  }, []);

  // Drawn in with the hero's text: the rule from the left, then the mark, the clock and the call to action.
  useLayoutEffect(() => {
    if (!animate) return undefined;
    const context = gsap.context(() => {
      const root = rootRef.current;
      const rule = root.querySelector('.hero__rule--top');
      const parts = root.querySelectorAll('.hero__mark, .hero__meta, .hero__nav');
      if (reducedMotion) {
        gsap.set(rule, { scaleX: 1 });
        gsap.to(parts, { autoAlpha: 1, duration: .2, ease: EASE.blend });
        return;
      }
      gsap.timeline({ defaults: { ease: EASE.arrive } })
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.2 }, 0)
        .fromTo(parts, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .2);
    }, rootRef);
    return () => context.revert();
  }, [animate]);

  const chapter = CHAPTERS[where.chapter];
  return (
    <div className={`site-header${visible ? ' site-header--visible' : ''}`} ref={rootRef} data-solid={!where.pinned}>
      <header className="hero__top">
        <div className="site-header__start">
          <a className="hero__mark" {...sectionLink('top')} aria-label={PERSON.name} ref={markRef}>
            <span className="hero__mark-letters" dangerouslySetInnerHTML={{ __html: letters }} />
            <span className="hero__mark-ring" ref={ringRef} dangerouslySetInnerHTML={{ __html: ring }} />
          </a>
          {/* The chapter the reader is in, changing as they go (read by the eye; the page's headings say it otherwise). */}
          <p className="site-header__chapter" aria-hidden="true" data-on={Boolean(chapter)}>
            {Object.entries(CHAPTERS).map(([key, item]) => (
              <span key={key} data-active={where.chapter === key}><span className="site-header__index">{item.index}</span>{item.label}</span>
            ))}
          </p>
        </div>
        <SketchClock draw={animate} />
        <nav className="hero__nav" aria-label="Main navigation">
          <RingButton {...sectionLink('contact')} motion arrow>Let’s talk</RingButton>
        </nav>
        <span className="hero__rule hero__rule--top" aria-hidden="true" />
      </header>
    </div>
  );
}
