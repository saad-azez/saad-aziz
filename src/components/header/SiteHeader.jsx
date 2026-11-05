import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import SketchClock from '../hero/SketchClock.jsx';
import RingButton from '../ui/RingButton.jsx';
import { sectionLink } from '../../lib/sectionLink.js';
import { PERSON } from '../../content/site.js';
import ring from '../../assets/monogram-ring.svg?raw';
import letters from '../../assets/monogram-letters.svg?raw';
import './SiteHeader.css';

/**
 * The site's header: the mark, the call to action and the line under them, at the top of the page, scrolling away
 * with it; and the clock, which is the navigation, in a layer of its own that stays on the screen all the way down,
 * over everything (.site-clock). The hero keeps a spacer the header's size (.hero__top--spacer), so the layout under
 * it, and everything the journey measures from it, is as it was.
 *
 * `visible`: held back until the loader hands over, like the rails;
 * `animate`: draws itself in with the hero's text.
 */
export default function SiteHeader({ visible, animate }) {
  const rootRef = useRef(null);
  const markRef = useRef(null);
  const ringRef = useRef(null);
  const clockRef = useRef(null);

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
    const enter = event => {
      if (event.pointerType === 'touch') return;
      gsap.killTweensOf(coin);
      if (!ticking) { ticking = true; gsap.ticker.add(tick); }
    };
    const leave = () => {
      if (!ticking) return;
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
      const parts = [...root.querySelectorAll('.hero__mark, .hero__nav'), clockRef.current.querySelector('.hero__meta')];
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

  return (
    <>
      <div className={`site-header${visible ? ' site-header--visible' : ''}`} ref={rootRef}>
        {/* Past this, the clock is on its own over the page (SketchClock: data-afloat). */}
        <span className="site-header__sentinel" aria-hidden="true" />
        <header className="hero__top">
          <a className="hero__mark" {...sectionLink('top')} aria-label={PERSON.name} ref={markRef}>
            <span className="hero__mark-letters" dangerouslySetInnerHTML={{ __html: letters }} />
            <span className="hero__mark-ring" ref={ringRef} dangerouslySetInnerHTML={{ __html: ring }} />
          </a>
          <nav className="hero__nav" aria-label="Main navigation">
            <RingButton {...sectionLink('contact')} motion arrow>Let’s talk</RingButton>
          </nav>
          <span className="hero__rule hero__rule--top" aria-hidden="true" />
        </header>
      </div>
      <div className={`site-clock${visible ? ' site-clock--visible' : ''}`} ref={clockRef}>
        <SketchClock draw={animate} />
      </div>
    </>
  );
}
