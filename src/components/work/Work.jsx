import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { WORK } from '../../content/site.js';
import { projectTitle, projectPending } from '../../content/projectDisplay.js';
import { reducedMotion } from '../../brand/motion.js';
import { stage } from '../../webgl/stage/DotStage.js';
import { hasMark } from '../../webgl/coinMarks.js';
import RingButton from '../ui/RingButton.jsx';
import Words from '../ui/Words.jsx';
import EmailCard from './EmailCard.jsx';
import Hint from '../ui/Hint.jsx';
import PageViewer from './PageViewer.jsx';
import './Work.css';

/** After the reader flips it or looks at a page, it waits this long before turning on by itself again (ms). */
const RESUME = 9000;
/** A press that moves less than this (px) is a tap, not a drag. */
const TAP = 6;

/**
 * The work: a book of the projects, one page each, turning slowly round its
 * spine (drawn by the stage, webgl/stage/Book.js, into `.work__stage`, in the
 * middle), and the project on show either side of it: name, role, summary,
 * tools and the way to the site. The coin, gone onto the right-hand rail as
 * the reader's guide, shows that project's tools on its head. The stage turns
 * the book on by itself and says which page is on show; ← and → turn it by
 * hand (past the last page on to the first, through the covers), and it can
 * be dragged and flicked.
 */
export default function Work() {
  const rootRef = useRef(null);
  const previousRef = useRef(0);
  const howRef = useRef('jump');
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [lit, setLit] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Over a sticker on the book (it can be peeled off): the pointer says so. */
  const [onSticker, setOnSticker] = useState(false);
  /** Over Saad's email written on the book (it can be clicked); and where the card it opens is, if it is open. */
  const [onLink, setOnLink] = useState(false);
  const [emailAt, setEmailAt] = useState(null);
  /** The page on show lifted out of the book to look at closely (PageViewer), and where it came up from; or null. */
  const [viewing, setViewing] = useState(null);
  /** The tool on the face of the coin balancing on the rope. */
  const [shownTool, setShownTool] = useState(null);
  useEffect(() => {
    stage.onTool = setShownTool;
    // How the rope hangs (where the coin stands on it, how far it gives under it, how far it sags by itself): the
    // tags hanging from it sag with it (Work.css .work__tool).
    const root = rootRef.current;
    stage.onRope = (c, dip, droop) => {
      root.style.setProperty('--rope-c', c.toFixed(4));
      root.style.setProperty('--rope-dip', dip.toFixed(2));
      root.style.setProperty('--rope-droop', droop);
    };
    return () => { stage.onTool = null; stage.onRope = null; };
  }, []);
  const closeEmail = useCallback(() => setEmailAt(null), []);
  const dragRef = useRef(null);
  /** When the open book was last tapped on a touch screen: its click lifts the page out. */
  const tapRef = useRef(0);
  const projects = WORK.projects;
  const count = projects.length;
  const go = (step, how) => {
    howRef.current = how;
    setActive(index => (index + step + count) % count);
  };
  const flip = step => {
    go(step, step > 0 ? 'next' : 'prev');
    setHeld(true);
  };
  /** The page on show lifted out of the book to look at closely, up out of the book's room. */
  const lookCloser = () => {
    setViewing({ from: rootRef.current.querySelector('.work__stage').getBoundingClientRect() });
    setHeld(true);
  };

  useEffect(() => { stage.setActive(active, howRef.current); }, [active]);
  useEffect(() => { stage.setLit(lit); }, [lit]);
  // A flick decides where the lamp lands: the stage says which project that is.
  useEffect(() => {
    stage.onActive = index => { howRef.current = 'stage'; setActive(index); };
    return () => { stage.onActive = null; };
  }, []);

  /* The book in the hand. Shut, it is picked up and turned round any way (on a touch screen, once the touch has
     started across: see the touch handling below) and let go to spin it. Open, it is dragged (up and down with a
     mouse, across on a touch screen) and flicked to turn its pages. */
  const along = event => (event.pointerType === 'mouse' ? event.clientY : event.clientX);
  const grab = event => {
    if (!event.isPrimary || event.button !== 0) return;
    // On the email written on the book: a click (not a drag) opens the card for it.
    if (stage.linkAt(event.clientX, event.clientY) === 'email') {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { id: event.pointerId, link: 'email', x: event.clientX, y: event.clientY, moved: 0 };
      return;
    }
    // On a sticker: it peels off into the hand, and the book stays where it is.
    if (stage.stickerDown(event.clientX, event.clientY)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { id: event.pointerId, sticker: true };
      setHeld(true);
      setDragging(true);
      return;
    }
    if (!revealed && !stage.canHold()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId, type: event.pointerType, last: along(event), time: performance.now(), velocity: 0, moved: 0,
      x: event.clientX, y: event.clientY, vx: 0, vy: 0,
    };
    setHeld(true);
    setDragging(true);
    stage.dragStart();
  };
  const move = event => {
    const drag = dragRef.current;
    if (drag?.sticker && drag.id === event.pointerId) {
      stage.stickerMove(event.clientX, event.clientY);
      return;
    }
    if (drag?.link && drag.id === event.pointerId) {
      drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.x, event.clientY - drag.y));
      return;
    }
    if (!drag && event.pointerType === 'mouse') {
      setOnSticker(stage.stickerHover(event.clientX, event.clientY));
      setOnLink(stage.linkAt(event.clientX, event.clientY) === 'email');
    }
    if (drag && drag.id === event.pointerId) {
      const now = performance.now(), at = along(event), delta = at - drag.last;
      const dt = Math.max(.008, (now - drag.time) / 1000);
      // The hand's speed, smoothed over the last few moves.
      drag.velocity = drag.velocity * .35 + (delta / dt) * .65;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.vx = drag.vx * .35 + (dx / dt) * .65;
      drag.vy = drag.vy * .35 + (dy / dt) * .65;
      drag.moved += Math.hypot(dx, dy);
      drag.last = at;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.time = now;
      // (Once a touch has taken the book, up and down tips it, as with a mouse: the page is not scrolling under it.)
      stage.dragMove(delta, dx, dy);
      return;
    }
    if (event.pointerType === 'mouse' && revealed) { setHeld(true); setLit(true); }
  };
  const release = (event, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (drag.link) {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!cancelled && drag.moved < TAP) { setHeld(true); setEmailAt({ x: event.clientX, y: event.clientY }); }
      return;
    }
    if (drag.sticker) {
      stage.stickerUp();
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    // A hand that has stopped before letting go is not flicking.
    const still = performance.now() - drag.time > 90;
    const flick = !(cancelled || still);
    stage.dragEnd(flick ? drag.velocity : 0, flick ? drag.vx : 0, flick ? drag.vy : 0);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // A tap on a touch screen lights it up, or puts it back.
    // A tap on a touch screen: the open book's page comes up to be looked at closely (PageViewer), on the click that
    // follows the tap (inHand onClick), never before it: opened here, under the finger, that click would land on
    // whatever of the page had just come up there (its link to the site).
    if (!cancelled && drag.moved < TAP && drag.type !== 'mouse' && revealed) tapRef.current = performance.now();
  };

  /** The book in the hand, wherever it is taken hold of. */
  const inHand = {
    onPointerDown: grab,
    onPointerMove: move,
    onPointerUp: event => release(event),
    onPointerCancel: event => release(event, true),
    onLostPointerCapture: event => release(event, true),
    // The click after a tap on the open book (release): only now does the page come up, the tap all done.
    onClick: () => {
      if (performance.now() - tapRef.current > 700) return;
      tapRef.current = 0;
      lookCloser();
    },
    onPointerLeave: event => {
      if (event.pointerType !== 'mouse' || dragRef.current) return;
      setLit(false);
      setOnSticker(stage.stickerHover(null));
      setOnLink(false);
    },
  };

  // On a touch screen the book and its stickers share the finger with the page's own scroll. A touch that starts on
  // a sticker (or the email written on the book) is all the sticker's, in any direction: the page never scrolls
  // under it. Anywhere else on the book the touch's first move decides: across, or near enough, takes the book (it
  // turns and tips with the finger, or turns its pages); up and down is the page's scroll, as anywhere else.
  useEffect(() => {
    const nodes = [...rootRef.current.querySelectorAll('.work__hold, .work__stage')];
    let gesture = null;
    const start = event => {
      if (event.touches.length !== 1) { gesture = null; return; }
      const { clientX: x, clientY: y } = event.touches[0];
      if (stage.stickerAt(x, y) || stage.linkAt(x, y)) {
        event.preventDefault();
        gesture = { mine: true };
        return;
      }
      gesture = { x, y, mine: null };
    };
    const moving = event => {
      if (!gesture) return;
      if (gesture.mine === null) {
        const touch = event.touches[0];
        const dx = Math.abs(touch.clientX - gesture.x), dy = Math.abs(touch.clientY - gesture.y);
        if (!dx && !dy) return;
        gesture.mine = dx >= dy * .7;
      }
      if (gesture.mine && event.cancelable) event.preventDefault();
    };
    const end = () => { gesture = null; };
    const listeners = [['touchstart', start, { passive: false }], ['touchmove', moving, { passive: false }], ['touchend', end], ['touchcancel', end]];
    nodes.forEach(node => listeners.forEach(([type, fn, options]) => node.addEventListener(type, fn, options)));
    return () => nodes.forEach(node => listeners.forEach(([type, fn]) => node.removeEventListener(type, fn)));
  }, []);

  // The work is in view once the journey has revealed it (Journey sets the class).
  useEffect(() => {
    const journey = rootRef.current.closest('.journey');
    if (!journey) return undefined;
    const update = () => {
      const on = journey.classList.contains('is-revealed');
      setRevealed(on);
      if (!on) setLit(false);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(journey, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // On its own, the book turns on round its pages (the stage turns it, slowly, and says which page is on show),
  // while the work is in view and the reader is not reading, looking or flipping.
  useEffect(() => {
    // (Never while a page is lifted out to look at: it would change under the reader.)
    stage.setAutoplay(revealed && !held && !viewing && !reducedMotion);
    return () => stage.setAutoplay(false);
  }, [revealed, held, viewing]);
  useEffect(() => {
    if (!held) return undefined;
    const timer = setTimeout(() => setHeld(false), RESUME);
    return () => clearTimeout(timer);
  }, [held, active]);

  // The copy for the project on show comes in; the one before it goes. Then
  // the journey measures the coin's new place on the tools line.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const cards = [...root.querySelectorAll('.work__project')];
    const of = index => cards.filter(card => Number(card.dataset.index) === index);
    const current = of(active);
    const previous = previousRef.current === active ? [] : of(previousRef.current);
    const direction = active >= previousRef.current ? 1 : -1;
    const context = gsap.context(() => {
      gsap.set(cards, { autoAlpha: 0 });
      if (previous.length && !reducedMotion) {
        gsap.fromTo(previous, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -12 * direction, duration: .22 });
      }
      gsap.set(current, { autoAlpha: 1, y: 0 });
      if (!reducedMotion && previous.length) {
        const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
        // (The name's card and the copy's each have only some of these: a part a card does not have is passed over.)
        const part = (nodes, from, to, at) => { if (nodes.length) timeline.fromTo(nodes, from, to, at); };
        current.forEach(card => {
          part(card.querySelectorAll('.work__word'),
            { y: 18 * direction, opacity: 0 },
            { y: 0, opacity: 1, duration: .65 }, .12);
          part(card.querySelectorAll('[data-reveal]'),
            { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .55, stagger: .04 }, .22);
          // The summary steps onto its lines a word at a time, as onto a rope: down onto its foot, tipping one way
          // and the other, and wobbling still.
          part(card.querySelectorAll('.work__summary .w'),
            { y: -9, rotation: i => (i % 2 ? -9 : 7), opacity: 0 },
            { y: 0, rotation: 0, opacity: 1, duration: 1.1, ease: 'elastic.out(1, .38)', stagger: .016, clearProps: 'transform,opacity' }, .2);
          // The tags drop onto their threads under the rope and swing there.
          part(card.querySelectorAll('.work__hang'),
            { y: -16, rotation: i => (i % 2 ? 14 : -12), opacity: 0 },
            { y: 0, rotation: 0, opacity: 1, duration: 1.4, ease: 'elastic.out(1, .3)', stagger: .07, clearProps: 'transform,opacity' }, .3);
        });
      }
    }, root);
    previousRef.current = active;
    root.dispatchEvent(new Event('work:layout', { bubbles: true }));
    return () => context.revert();
  }, [active]);

  // A long name is set smaller, just until its longest word fits the column.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const context = document.createElement('canvas').getContext('2d');
    const fit = () => {
      root.querySelectorAll('.work__name').forEach(name => {
        name.style.fontSize = '';
        const style = getComputedStyle(name);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const widest = Math.max(...name.textContent.split(/\s+/).map(word => context.measureText(word).width));
        const room = name.clientWidth;
        if (widest > room && room > 0) name.style.fontSize = `${Math.floor(parseFloat(style.fontSize) * room / widest * .97)}px`;
      });
      root.dispatchEvent(new Event('work:layout', { bubbles: true }));
    };
    fit();
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    root.querySelectorAll('.work__copy, .work__lead').forEach(column => observer.observe(column));
    return () => observer.disconnect();
  }, [projects]);

  const heading = (project, i) => <>
    <h3 className="work__name" aria-label={projectTitle(project, i)}>
      <span className="work__word">{projectTitle(project, i)}</span>
    </h3>
    {project.role && <p className="work__role" data-reveal>{project.role}</p>}
  </>;
  const card = (project, i, children, extra = '') => (
    <article className={`work__project${extra}`} key={project.id} data-index={i} data-active={active === i}
      aria-hidden={active !== i} inert={active !== i ? '' : undefined}>{children}</article>
  );

  return (
    <section className="work work--centre" id="work" ref={rootRef} aria-labelledby="work-title" data-lit={lit} data-dragging={dragging} data-sticker={onSticker} data-link={onLink}
      onPointerMove={event => {
        if (event.pointerType !== 'mouse') return;
        const box = event.currentTarget.getBoundingClientRect();
        stage.leanTo((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
      }}
      onPointerLeave={() => stage.leanTo(null, null)}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          flip(event.key === 'ArrowRight' ? 1 : -1);
        }
      }}>
      <header className="work__header">
        <h2 className="work__title work__words" id="work-title" aria-label={WORK.title}><Words text={WORK.title} /></h2>
      </header>

      {/* While the book stands shut in the middle, before it opens: what is in it on one side, what to do with
          it on the other (above and below it on a narrow screen). The words rise one by one with the scroll as
          the book flies in, the arrow draws itself toward the book. */}
      <div className="work__intro work__words" aria-hidden="true">
        <div className="work__intro-side work__intro-side--start">
          <p className="work__intro-lead"><Words text="Every page in here went live." /></p>
        </div>
        <div className="work__intro-side work__intro-side--end">
          <div className="work__nudge"><Hint kind="grab">Pick it up · turn it over</Hint></div>
          <p className="work__intro-body"><Words text="Brand sites, 3D worlds, stores and tools, for studios and for founders, built from the first sketch to the last line of code." from={6} /></p>
          <p className="work__intro-hint"><Words text="Turn it over, or keep scrolling and it falls open." from={24} /></p>
          <p className="work__intro-hint"><Words text="It's my journal: peel the stickers off and stick them anywhere." from={34} /></p>
        </div>
      </div>

      <div className="work__lead">
        <div className="work__projects">
          {projects.map((project, i) => card(project, i, heading(project, i), ' work__project--lead'))}
        </div>
      </div>

      {/* The book's room. Drag it to turn it, flick it to spin it; under the pointer (or a tap, on a
          touch screen) the page on show stands up a little and the gap in front of it opens. */}
      <div className="work__stage" role="img" aria-label={`A book of the projects, open at ${projectTitle(projects[active], active)}`}
        data-cursor="Drag to turn the pages" data-cursor-icon="drag" {...inHand} />
      {/* The shut book's own hold, where it stands (on a phone, nowhere near the open book's room): on only while
          it can be picked up (Work.css). */}
      <div className="work__hold" aria-hidden="true" data-cursor="Pick it up · turn it over" data-cursor-icon="grab" {...inHand} />
      <EmailCard at={emailAt} onClose={closeEmail} />
      {/* On a touch screen, where the open book is small: the way to lift its page out and look at it closely (a tap
          on the book does the same). Under the book's room (Journey: --room-x, --room-bottom). */}
      <RingButton as="button" className="work__peek" onClick={lookCloser} tabIndex={revealed ? 0 : -1} motion arrow>Look closer</RingButton>
      {viewing && <PageViewer project={projects[active]} index={active} count={count} from={viewing.from}
        onClose={() => setViewing(null)} onStep={flip} />}

      <div className="work__copy" onPointerEnter={() => setHeld(true)} onFocusCapture={() => setHeld(true)}>
        <div className="work__projects" aria-live="polite" aria-atomic="true">
          {projects.map((project, i) => card(project, i, <>
            <p className="work__summary"><Words text={projectPending(project) ? 'Not published yet.' : project.summary} /></p>
            {/* The tools: the scroll rope comes in here (`.work__rope`, drawn by the stage), tied between two posts,
                and the coin walks it, from tool to tool, turning to each; their names hang from it as tags on threads,
                the one the coin is over lit and swinging; the tools with no mark after them in words. */}
            <div className="work__made">
              <div className="work__rope" aria-hidden="true" />
              <ul className="work__tools" aria-label="Made with" style={{ '--n': Math.max(1, project.tools.filter(hasMark).length) }}
                data-many={project.tools.filter(hasMark).length > 3}>
                {project.tools.filter(hasMark).map((tool, n) => (
                  <li className="work__tool" key={tool} style={{ '--i': n }} data-on={active === i && shownTool === tool}>
                    <span className="work__hang"><span className="work__tag">{tool}</span></span>
                  </li>
                ))}
              </ul>
              {project.tools.some(tool => !hasMark(tool)) && (
                <p className="work__also" data-reveal>With {project.tools.filter(tool => !hasMark(tool)).join(', ')}</p>
              )}
            </div>
            {project.credit && <p className="work__credit" data-reveal>
              With <a href={project.credit.href} target="_blank" rel="noreferrer">{project.credit.label} <span aria-hidden="true">↗</span></a>
            </p>}
            {project.href && <div className="work__actions" data-reveal>
              <RingButton href={project.href} target="_blank" rel="noreferrer" motion arrow>Visit site</RingButton>
            </div>}
          </>))}
        </div>
        <div className="work__nav">
          <RingButton as="button" shape="round" className="work__step" onClick={() => flip(-1)} aria-label="Previous project">
            <span aria-hidden="true">←</span>
          </RingButton>
          <RingButton as="button" shape="round" className="work__step" onClick={() => flip(1)} aria-label="Next project">
            <span aria-hidden="true">→</span>
          </RingButton>
        </div>
      </div>
    </section>
  );
}
