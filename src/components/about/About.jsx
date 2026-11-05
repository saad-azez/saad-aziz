import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ABOUT, PERSON } from '../../content/site.js';
import { stage } from '../../webgl/stage/DotStage.js';
import { aboutScreens } from '../../webgl/stage/aboutTransition.js';
import { moreTransition, MORE_SCREENS } from '../../webgl/stage/moreTransition.js';
import { reducedMotion } from '../../brand/motion.js';
import Words from '../ui/Words.jsx';
import Hint from '../ui/Hint.jsx';
import Process from '../process/Process.jsx';
import './About.css';

const { card: CARD, line: LINE, process: PROCESS, more: MORE } = ABOUT;
const STARS = '★★★★★';
const clamp01 = value => Math.max(0, Math.min(1, value));
/**
 * After the process: a band of words, rows of monospaced type running across the page, the coin become a ring threaded
 * through it (the stage: DotStage stepBand, Band). Every word of it is what the page says elsewhere: the numbers, what
 * else is on the bench, and who he is, set as code is, a touch of its punctuation between. And what is engraved round
 * the ring.
 */
const figure = item => item.value.toFixed(item.decimals ?? 0);
const ROWS_MORE = [
  ABOUT.numbers.map(item => `${figure(item)} ${item.label}`).join('   //   '),
  `${ABOUT.bench.title}   ` + ABOUT.bench.items.map((item, i) => `#(0${i + 1}) ${item.title}`).join('   >>   '),
  ABOUT.bench.items.map(item => item.text).join('   }   '),
  `${PERSON.name}   ${PERSON.role}   ${PERSON.city}   ${MORE.where}   ` + MORE.tools.map(tool => `{${tool}}`).join(' '),
].map(row => row.toUpperCase());
const ENGRAVING = [
  `${PERSON.name} — ${PERSON.mark} — ${PERSON.role} — ${PERSON.city} — ${MORE.where}`,
  `${ABOUT.numbers.slice(0, 3).map(item => `${figure(item)} ${item.label}`).join(' · ')} · ${PROCESS.title.join(' ')} :)`,
].map(line => line.toUpperCase());

/** How many times each row is said over (enough to cover the widest screen as it runs), and how fast each runs (of the scroll). */
const TRACK_COPIES = 4, MORE_SPEED = [.32, .44, .26, .38];
/** Where (screens into the pinned stretch after the process) the rows start running with the scroll: as they rise. */
const MORE_ROWS_FROM = 1.72;

/** The small words beside the title, for each stop: three rows, as the poster's are. */
const ROWS = [
  item => <><b>{item.where}</b> · {item.role}</>,
  item => item.text,
  item => <>{item.place} · <b>{item.year}{item.span ? `, ${item.span}` : ''}</b></>,
];

/**
 * An element's place inside `within` (px), as it is laid out: without the
 * transforms its reveal puts on it, so the coin's places never move with them.
 */
function placeIn(node, within) {
  let x = 0, y = 0;
  for (let n = node; n && n !== within; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y, w: node.offsetWidth, h: node.offsetHeight };
}

/**
 * The about: the other side of the coin.
 *
 * One pinned screen, like the journey's, that the reader scrolls through while
 * it holds still (aboutTransition has the choreography; the stage draws the
 * coin and tells this what the page shows, through onTransition). The coin
 * jumps off the work's rope into it and turns over to Saad's portrait under
 * the title; goes over to the five years, set as a poster, where it is the
 * wheel, tipped and leaning, the mark on its face melting from each stop's
 * tool into the next's and the words at its lean changing with it; then rises
 * out of the wheel where it stands, turning over to "my process", and goes
 * straight on down into the process, where it comes apart (components/process).
 *
 * After it: the process, then the band of words with the coin become a ring,
 * and the way to get in touch.
 */
/**
 * Where an element is on the page, from the layout: not where it is on the screen just now, which a transform or a
 * pin on an ancestor moves (the stage reads this every frame, and a moving reading flips the coin between states).
 */
const documentTop = element => {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
};

export default function About() {
  const rootRef = useRef(null);
  // The running reviews on a phone only run while the about is near the screen (About.css).
  useEffect(() => {
    const root = rootRef.current;
    const observer = new IntersectionObserver(([entry]) => root.toggleAttribute('data-near', entry.isIntersecting), { rootMargin: '50% 0px' });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const pinRef = useRef(null);
  const moreRef = useRef(null);
  const [stop, setStop] = useState(0);
  /** Which of his sides the coin on the card shows: 'engineer', 'artist', or null (not there yet). */
  const [side, setSide] = useState(null);
  /**
   * The five years, with the reader's scroll: everything in them follows `along` (aboutTransition: -1 before them, 0
   * at the first stop, rising through each to the last), so scrolling back plays it all backwards, and nothing in
   * them runs by the clock. As the coin's mark melts from one stop's into the next's, each row of the small words
   * gives way to the next stop's along its line, a row after the row before: out ahead, in from behind; the arrows
   * nudge forward; and the year by the title goes by as a counter's figures do.
   */
  const along = useRef(-1);
  const draw = () => {
    const root = rootRef.current, at = along.current, n = LINE.stops.length;
    if (!root) return;
    root.querySelectorAll('[data-stop-i]').forEach(node => {
      const off = at - Number(node.dataset.stopI) - Number(node.dataset.row) * .07, shown = clamp01((.5 - Math.abs(off)) / .18);
      node.style.opacity = shown.toFixed(3);
      node.style.visibility = shown > 0 ? 'visible' : 'hidden';
      node.style.transform = `translateX(${(Math.max(-1, Math.min(1, off)) * 46).toFixed(2)}px)`;
    });
    const melt = at > 0 && at < n - 1 ? at - Math.floor(at) : 0;
    root.querySelectorAll('.about__arrow > span').forEach((arrow, k) => {
      arrow.style.transform = `translateX(${(Math.sin(Math.PI * clamp01(melt * 1.25 - k * .1)) * .28).toFixed(3)}em)`;
    });
    const years = root.querySelector('.about__years');
    if (years) years.style.transform = `translateX(${(-Math.max(0, Math.min(n - 1, at)) * 100).toFixed(3)}%)`;
  };
  // (The stage tells the about what to show from a callback made once: it draws as the about is now.)
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useLayoutEffect(() => { draw(); }, []);
  /**
   * The five years' words coming in and going, set as the poster is set: along its lean. In (0 → 1, as the coin goes
   * over to them): the title's rows shot in along their lines out of their masks one after another, the arrows after,
   * the year dropped into its slot, the small words, the line at the foot. Out (1 → 2, as the coin leaves them): all
   * of it fading where it stands, together. One timeline, held still and set by the scroll (lineIn and lineOut, from the stage), so it goes back as
   * readily as forward.
   */
  const words = useRef(null);
  const wordsAt = useRef(0);
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      timeline
        .fromTo('.about__big-in', { xPercent: -104 }, { xPercent: 0, duration: .6, stagger: .1 }, .04)
        .fromTo('.about__arrow', { x: '-.7em', autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .4, stagger: .07 }, .26)
        .fromTo('.about__year-in', { clipPath: 'inset(0% 0% 100% 0%)', y: '-.5em' }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: .5 }, .32)
        .fromTo('.about__small-row', { x: -40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .45, stagger: .07 }, .4)
        .fromTo('.about__foot > *', { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, stagger: .08 }, .52)
        .to('.about__big-in, .about__arrow, .about__year-in, .about__small-row, .about__foot > *', { autoAlpha: 0, duration: 1, ease: 'power1.inOut' }, 1);
      timeline.progress(wordsAt.current / 2);
      words.current = timeline;
    }, rootRef);
    return () => { words.current = null; context.revert(); };
  }, []);
  const screens = aboutScreens(LINE.stops.length);
  const touch = useMemo(() => window.matchMedia('(hover: none)').matches, []);

  /*
   * The coin on the card in the hand (the stage does the rest: DotStage coinGrab, coinTurn, coinLet, coinPoint,
   * coinTap). A press that hardly moves is a tap; one that moves across turns it (up and down is the page's own
   * scroll, on a touch screen: touch-action pan-y).
   */
  const hand = useRef(null);
  const faceAt = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const u = (event.clientX - box.left) / box.width, v = 1 - (event.clientY - box.top) / box.height;
    return Math.hypot(u - .5, v - .5) <= .5 ? { u, v } : null;
  };
  const coinHand = {
    onPointerDown: event => {
      if (event.button > 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      hand.current = { id: event.pointerId, x: event.clientX, lx: event.clientX, lt: performance.now(), v: 0, moved: 0 };
      stage.coinGrab();
    },
    onPointerMove: event => {
      stage.coinPoint(faceAt(event));
      const held = hand.current;
      if (!held || held.id !== event.pointerId) return;
      const now = performance.now(), dx = event.clientX - held.lx;
      held.v += (dx / Math.max(8, now - held.lt) * 1000 - held.v) * .4;
      held.moved = Math.max(held.moved, Math.abs(event.clientX - held.x));
      held.lx = event.clientX; held.lt = now;
      stage.coinTurn(dx);
    },
    onPointerUp: event => {
      const held = hand.current;
      if (!held || held.id !== event.pointerId) return;
      hand.current = null;
      if (held.moved < 6) { stage.coinLet(0); stage.coinTap(); }
      else stage.coinLet(performance.now() - held.lt > 80 ? 0 : held.v);
      // (A finger lifted is no longer over it.)
      if (event.pointerType !== 'mouse') stage.coinPoint(null);
    },
    onPointerCancel: () => { hand.current = null; stage.coinLet(0); },
    onPointerLeave: () => { if (!hand.current) stage.coinPoint(null); },
  };

  useLayoutEffect(() => {
    const root = rootRef.current, pin = pinRef.current;
    const onTransition = state => {
      for (const key of ['enter', 'title', 'lede', 'card', 'line']) root.style.setProperty(`--about-${key}`, state[key].toFixed(4));
      // Each layer there only while it shows at all, and only the one on show taking the pointer.
      for (const key of ['card', 'line']) {
        const shown = state[key] > .001 ? 'on' : 'off';
        if (root.dataset[key] !== shown) root.dataset[key] = shown;
      }
      const on = state.line > .5 ? 'line' : state.card > .5 ? 'card' : 'none';
      if (root.dataset.layer !== on) root.dataset.layer = on;
      setStop(state.stopOn);
      along.current = state.along;
      drawRef.current();
      wordsAt.current = state.lineIn + state.lineOut;
      words.current?.progress(wordsAt.current / 2);
    };
    const measure = () => {
      const spot = selector => {
        const box = placeIn(root.querySelector(selector), pin);
        return { x: box.x + box.w / 2, y: box.y + box.h / 2, r: box.w / 2 };
      };
      // (The coin leaves for the process from where it stands as the wheel: no stop on the way.)
      const piece = spot('.about__spot--line');
      stage.setAbout({
        top: documentTop(root),
        height: root.offsetHeight,
        vh: pin.offsetHeight,
        card: spot('.about__spot--card'),
        line: spot('.about__spot--line'),
        piece,
        stops: LINE.stops.length,
        faces: LINE.stops.map(item => item.face),
        // After it: where the ring is (the middle of the band of words, page px down) and the band of words.
        // After it, its own pinned screen: the ring's place on it and the band of words' box (moreTransition).
        more: (() => {
          const section = moreRef.current, morePin = section.querySelector('.about-more__pin');
          const ring = placeIn(section.querySelector('.about-more__spot'), morePin), band = placeIn(section.querySelector('.about-more__band'), morePin);
          return {
            top: documentTop(section), height: section.offsetHeight, vh: morePin.offsetHeight,
            spot: { x: ring.x + ring.w / 2, y: ring.y + ring.h / 2, r: ring.w / 2 },
            band: { top: band.y, bottom: band.y + band.h, left: band.x, right: band.x + band.w },
            engraving: ENGRAVING,
          };
        })(),
        onTransition,
        onSide: setSide,
        // The reviews, for the stage's ring of glass round the coin.
        ring: { quotes: CARD.called.quotes },
      });
    };
    measure();
    document.fonts?.ready.then(measure);
    // The about's place on the page moves with everything above it (the journey is sized in screens).
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(pin);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      stage.setAbout(null);
    };
  }, []);

  // After the process, its own pinned screen (moreTransition): the band of words, only once the coin has become a
  // ring. Drawn out through it as a thread to the rails, opening into the band, its rows rising into it one after
  // another and then running with the scroll, each the other way from the one above, round and round (the row said
  // over, it wraps where it meets itself). All of it as far as the reader has scrolled, back as readily.
  useEffect(() => {
    const more = moreRef.current, band = more.querySelector('.about-more__band');
    const rows = [...more.querySelectorAll('.about-more__row')], tracks = rows.map(row => row.firstChild);
    let frame = 0, top = 0, vh = 1, centre = .5, widths = [];
    const size = () => {
      top = documentTop(more);
      vh = more.querySelector('.about-more__pin').offsetHeight || window.innerHeight;
      const spot = more.querySelector('.about-more__spot');
      centre = band.offsetWidth ? (spot.offsetLeft + spot.offsetWidth / 2 - band.offsetLeft) / band.offsetWidth : .5;
      widths = tracks.map(track => track.scrollWidth / TRACK_COPIES);
      run();
    };
    const run = () => {
      frame = 0;
      const m = (window.scrollY - top) / vh, t = moreTransition(m, reducedMotion);
      // The thread: from the ring's middle out to either rail; then the band opening from it.
      const left = centre * (1 - t.thread) * 100, right = (1 - centre) * (1 - t.thread) * 100;
      const open = t.open;
      band.style.visibility = t.thread > 0 ? 'visible' : 'hidden';
      band.style.clipPath = `inset(calc(${((1 - open) * 50).toFixed(3)}% - ${((1 - open) * 1.5).toFixed(2)}px) ${right.toFixed(3)}% calc(${((1 - open) * 50).toFixed(3)}% - ${((1 - open) * 1.5).toFixed(2)}px) ${left.toFixed(3)}%)`;
      const ran = Math.max(0, m - MORE_ROWS_FROM) * vh;
      tracks.forEach((track, i) => {
        const rise = t.row(i), way = i % 2 ? 1 : -1, w = widths[i] || 1;
        const at = reducedMotion ? 0 : ran * MORE_SPEED[i % MORE_SPEED.length] * way + (1 - rise) * 160 * way;
        track.style.transform = `translate3d(${(-(((at % w) + w) % w)).toFixed(1)}px, ${((1 - rise) * 105).toFixed(2)}%, 0)`;
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(run); };
    size();
    document.fonts?.ready.then(size);
    const observer = new ResizeObserver(size);
    observer.observe(more);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  const lede = (text, from = 0) => <Words text={text} from={from} />;

  return (
    <>
      <section className="about" id="about" ref={rootRef}
        style={{ height: `${100 + screens * 100}vh` }} aria-labelledby="about-title"
        data-stop={stop} data-layer="none" data-card="on" data-line="off">
        <div className="about__pin" ref={pinRef}>
          {/* Heads: the coin turns over to the portrait under the title (the stage draws it in .about__spot--card). */}
          <div className="about__card about__layer" data-layer-name="card">
            <p className="about__eyebrow">{CARD.eyebrow}</p>
            <h2 className="about__title about__words" id="about-title" aria-label={CARD.title.join(' ')}>
              {lede(CARD.title[0])} <em>{lede(CARD.title[1], CARD.title[0].split(' ').length)}</em>
            </h2>
            <div className="about__coin">
              {/* The coin is the reader's to play with here: dragged or tapped, it turns over between his two sides
                  (his face in code, his face in polygons); over it, a lens shows him as he is. */}
              <div className="about__spot about__spot--card" aria-hidden="true" data-cursor="Drag to flip" data-cursor-icon="drag" {...coinHand} />
              {/* The proof of the title: the reviews that call him Saadi, in a ring of glass round the coin
                  (drawn by the stage: webgl/stage/ReviewRing), the name circled in each. */}
              <ul className="about__said" aria-label={CARD.called.label}>
                {CARD.called.quotes.map((quote, i) => (
                  <li className="about__saying" style={{ '--i': i }} key={i}>
                    <span className="about__saying-chip" aria-hidden="true">{quote.by[0]}</span>
                    <q>{quote.text.split('Saadi').map((part, n, parts) => (
                      <span key={n}>{part}{n < parts.length - 1 && <mark className="about__name">Saadi<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M60 4 C 26 1, 3 9, 4 21 C 5 34, 38 38, 66 36 C 94 34, 99 23, 95 12 C 91 3, 70 2, 44 6" /></svg></mark>}</span>
                    ))}</q>
                    <span className="about__by">{quote.by}<span className="about__saying-stars" aria-hidden="true">{STARS}</span></span>
                  </li>
                ))}
              </ul>
              <Hint className="about__hint" kind={touch ? 'tap' : 'drag'} on={side !== null}>{touch ? CARD.hintTouch : CARD.hint}</Hint>
            </div>
            {/* Which of his sides is up, as the coin turns. */}
            <div className="about__side" aria-live="polite">
              {['engineer', 'artist'].map(key => (
                <p className="about__side-item" key={key} data-active={side === key}>
                  <span className="about__side-label">{CARD.sides[key].label}</span>
                  <span className="about__side-title">{CARD.sides[key].title}</span>
                  <span className="about__side-text">{CARD.sides[key].text}</span>
                </p>
              ))}
            </div>
            <p className="about__lede">{CARD.lede}</p>
          </div>

          {/* The five years, set as a cycling poster is: the coin the wheel, big, tipped and leaning, holding still
              while the mark on its face melts from stop to stop (drawn by the stage over .about__spot--line); and the
              words at its lean, a row at a time: the title in three, thin; an arrow at each; the year, bold, across
              all three, going by as a counter's figures do; and small, beside them, where he was and what he did. */}
          <div className="about__line about__layer" data-layer-name="line">
            <div className="about__wheel">
              <div className="about__spot about__spot--line" aria-hidden="true" />
              <h3 className="about__line-title">{LINE.title.join(' ')}</h3>
              <div className="about__type" aria-hidden="true">
                <div className="about__small">
                  {ROWS.map((row, r) => (
                    <p className="about__small-row" key={r}>
                      {LINE.stops.map((item, i) => <span className="about__small-item" key={item.id} data-stop-i={i} data-row={r}>{row(item)}</span>)}
                    </p>
                  ))}
                </div>
                <div className="about__arrows">{ROWS.map((_, r) => <span className="about__arrow" key={r}><span>→</span></span>)}</div>
                <div className="about__year">
                  <div className="about__year-in">
                    <div className="about__years">{LINE.stops.map(item => <span key={item.id}>{item.year}</span>)}</div>
                  </div>
                </div>
                <div className="about__big">
                  {LINE.title.map(row => <span className="about__big-row" key={row}><span className="about__big-in">{row}</span></span>)}
                </div>
              </div>
              {/* (All of it at once, for a screen reader.) */}
              <ol className="about__stops">
                {LINE.stops.map(item => (
                  <li key={item.id}>{item.year}: {item.where}, {item.role}, {item.place}{item.span ? `, ${item.span}` : ''}. {item.text}</li>
                ))}
              </ol>
              <p className="about__foot">
                <span>{LINE.lede}</span>
                <span className="about__count" aria-hidden="true">{String(stop + 1).padStart(2, '0')} / {String(LINE.stops.length).padStart(2, '0')}</span>
              </p>
            </div>
          </div>

        </div>
      </section>

      <Process />

      {/* After the process: a band of words across the page, rows of code-set type running with the scroll, and the
          coin, become a ring, threaded through it (the stage draws it over .about-more__spot). What it says is there
          in full, for a screen reader, under it. */}
      <section className="about-more" ref={moreRef} aria-labelledby="about-more-title" style={{ height: `${100 + MORE_SCREENS * 100}vh` }}>
        <h3 className="about-more__hidden" id="about-more-title">{MORE.label}</h3>
        <div className="about-more__hidden">
          <ul>{ABOUT.numbers.map(item => <li key={item.label}>{figure(item)} {item.label}</li>)}</ul>
          <h4>{ABOUT.bench.title}</h4>
          <ul>{ABOUT.bench.items.map(item => <li key={item.title}>{item.title}: {item.text}</li>)}</ul>
        </div>
        <div className="about-more__pin">
          <div className="about-more__band" aria-hidden="true">
            {ROWS_MORE.map(row => (
              <p className="about-more__row" key={row}><span className="about-more__track">{`${row}     `.repeat(TRACK_COPIES)}</span></p>
            ))}
          </div>
          <div className="about-more__spot" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
