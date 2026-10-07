import { useLayoutEffect, useRef } from 'react';
import Hero from '../hero/Hero.jsx';
import Work from '../work/Work.jsx';
import { WORK } from '../../content/site.js';
import { stage, SCROLL } from '../../webgl/stage/DotStage.js';
import { barInset } from '../../lib/viewport.js';
import './Journey.css';

/** The screens where the lines about the shut book go above and below it, not either side (Work.css, the same query). */
const STACKED = '(max-width: 600px), (max-aspect-ratio: 4/5)';

/**
 * The journey: the hero and the work as one pinned scene.
 *
 * The section is tall; the screen inside it is sticky, so the reader scrolls
 * through the section while the screen holds still. The hero and the work
 * share that pinned screen. The stage samples the coin's way,
 * then sends opacity and stagger progress back through onTransition so the
 * copy follows the same scroll position as the WebGL objects.
 */
export default function Journey({ reveal, animateText, onReady }) {
  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const projects = WORK.projects;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const pin = pinRef.current;
    const onPhase = phase => { root.dataset.phase = phase; };
    const onReveal = revealed => { root.classList.toggle('is-revealed', revealed); };
    const heroNode = root.querySelector('.hero');
    const header = root.querySelector('.hero__top');
    // Everything of the hero but its header, which stays on top for the work too.
    const heroBody = [...heroNode.querySelectorAll('.hero__frame > :not(.hero__top)')];
    const onTransition = ({ work, title, names, details, intro = 0, leave = 0, lens = 0, lensX = 0, lensY = 0, lensR = 0 }) => {
      for (const [key, value] of Object.entries({ work, title, names, details, intro, leave })) {
        root.style.setProperty(`--${key}-reveal`, value.toFixed(5));
      }
      // The lines about the shut book, taken away outright once they have moved out (or before they come in), so
      // nothing of them lingers, blurred, over the open book on any browser (Work.css .work__intro).
      const introOn = intro > .001 && leave < .999;
      if (root.dataset.intro !== String(introOn)) root.dataset.intro = introOn;
      // The window the coin opens: where it is, how big, and its hairline (gone as it fills the screen).
      root.style.setProperty('--lens-x', `${lensX.toFixed(1)}px`);
      root.style.setProperty('--lens-y', `${lensY.toFixed(1)}px`);
      root.style.setProperty('--lens-r', `${lensR.toFixed(1)}px`);
      root.style.setProperty('--lens-line', (Math.min(1, lens * 12) * (1 - Math.max(0, (lens - .7) / .3))).toFixed(3));
      heroBody.forEach(node => { node.inert = lens >= .999; });
      // The book can be taken in the hand as soon as the work is in view; the copy, once it is there.
      root.querySelector('.work').inert = lens < .999;
      root.querySelectorAll('.work__copy, .work__lead').forEach(node => { node.inert = details < .5; });
    };
    // The shut book as the stage stands it (px, on the pinned screen): its size, and the top of the room it is
    // centred in, for the lines about it to be set round it (Work.css .work__intro).
    const onShut = ({ w, h, top, cy }) => {
      root.style.setProperty('--shut-w', `${w.toFixed(1)}px`);
      root.style.setProperty('--shut-h', `${h.toFixed(1)}px`);
      root.style.setProperty('--shut-top', `${top.toFixed(1)}px`);
      root.style.setProperty('--shut-y', `${cy.toFixed(1)}px`);
    };
    // While the shut book can be picked up, its own hold is on, where it stands (Work.css .work__hold).
    const onHoldable = on => { root.dataset.holdable = on; };
    const measure = () => {
      // The work's layout starts below the header (see Work.css).
      const pinBox = pin.getBoundingClientRect();
      root.style.setProperty('--site-header', `${Math.round(header.getBoundingClientRect().bottom - pinBox.top)}px`);
      const box = root.getBoundingClientRect();
      // The book's room and the coin's place, on the pinned screen.
      const room = root.querySelector('.work__stage').getBoundingClientRect();
      // (Its foot and middle, for what sits on it: Work.css .work__peek.)
      root.style.setProperty('--room-x', `${Math.round(room.left + room.width / 2)}px`);
      root.style.setProperty('--room-bottom', `${Math.round(room.bottom - pinBox.top)}px`);
      // The copy's column slides up as it comes in: where things in it will be once it has.
      const copyNode = root.querySelector('.work__copy');
      const lift = new DOMMatrixReadOnly(getComputedStyle(copyNode).transform).m42;
      // Where the shut book may stand: under the site header, or, where the lines about it go above and below it
      // (Work.css: a narrow or upright screen), under the work's own title too.
      const stacked = window.matchMedia(STACKED).matches;
      const titleNode = root.querySelector('.work__header');
      const shutTop = stacked
        ? titleNode.getBoundingClientRect().bottom - pinBox.top - new DOMMatrixReadOnly(getComputedStyle(titleNode).transform).m42
        : header.getBoundingClientRect().bottom - pinBox.top;
      const work = {
        // How much of the bottom of the pinned screen a phone's address bar can cover, for the shut book to keep clear of.
        shutTop, stacked, onShut, onHoldable, barInset: barInset(),
        stage: { x: room.left + room.width / 2, y: room.top - pinBox.top + room.height / 2, w: room.width, h: room.height },
        // The rope's lane in the project on show (which one: `toolsFor`), where it will be once the copy has come in:
        // the rope runs along its foot, from its left to its right; the coin sits on it (`tools`, its seat).
        toolsFor: Number(root.querySelector('.work__project[data-active="true"]')?.dataset.index ?? -1),
        ...(() => {
          const node = root.querySelector('.work__project[data-active="true"] .work__rope');
          if (!node) return { tools: [], rope: null };
          const r = node.getBoundingClientRect();
          // The coin a size to balance on the rope, with room to lean; the stage stands it on the rope (ropeSeat).
          const y = r.bottom - pinBox.top - lift - 3, radius = r.height * .34;
          const rope = { x0: r.left, x1: r.right, y };
          return { rope, tools: [{ x: r.left + Math.min(r.width / 2, radius * 3.2), y: y - radius - 2, r: radius }] };
        })(),
        top: box.top + window.scrollY,
        height: root.offsetHeight,
        vh: pinBox.height,
        projects,
        onPhase,
        onReveal,
        onTransition,
      };
      // Asked again on every resize (a phone's address bar coming and going is one): only told when something moved.
      const key = JSON.stringify(work, (name, value) => (typeof value === 'function' || name === 'projects' ? undefined : value));
      if (key === lastKey) return;
      lastKey = key;
      stage.setWork(work);
    };
    let lastKey = null;
    onTransition({ work: 0, title: 0, names: 0, details: 0, lens: 0 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(root.querySelector('.work__stage'));
    observer.observe(header);
    window.addEventListener('resize', measure);
    // The work tells when its layout has changed (another project on show).
    root.addEventListener('work:layout', measure);
    return () => {
      root.removeEventListener('work:layout', measure);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [projects]);

  const screens = SCROLL.ROPE + SCROLL.ZOOM + SCROLL.HOLD + SCROLL.SHUT + SCROLL.RECEDE + SCROLL.GAP + SCROLL.FOLD;
  // In the full screen's height (lib/viewport), as the pinned screen and the stage's pacing are.
  const height = `calc(${100 + screens * 100}vh + ${SCROLL.START}px)`;

  return (
    <section className="journey" ref={rootRef} style={{ height }} data-phase="hero">
      <div className="journey__pin" ref={pinRef}>
        <Hero reveal={reveal} animateText={animateText} onReady={onReady} />
        <Work />
        <div className="journey__lens" aria-hidden="true" />
      </div>
    </section>
  );
}
