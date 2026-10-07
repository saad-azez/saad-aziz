import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ABOUT } from '../../content/site.js';
import { stage } from '../../webgl/stage/DotStage.js';
import { aboutScreens } from '../../webgl/stage/aboutTransition.js';
import { towerLayout, towerAt, towerPaths, TOWER } from '../../webgl/stage/tower.js';
import { reducedMotion } from '../../brand/motion.js';
import Words from '../ui/Words.jsx';
import Hint from '../ui/Hint.jsx';
import './About.css';

const { card: CARD, line: LINE, process: PROCESS } = ABOUT;
const STARS = '★★★★★';
/** The screens where the words about each stop go under the tower, not either side of it (About.css, the same query). */
const STACKED = '(max-width: 600px), (max-aspect-ratio: 4/5)';
const clamp01 = value => Math.max(0, Math.min(1, value));

/**
 * The words about each stop, either side of the tower (wide screens): on the
 * side its stop stands (left, right, left…), as near level with it as they
 * fit, a leader drawn from the stop on the road out to them. `block` is how
 * tall one stop's words are at most (px, About.css), for those on one side to
 * keep clear of each other; `gap` how far they stand off the column.
 */
function besideTower(tower) {
  const { w, h, cx, R, T } = tower;
  const block = Math.min(184, Math.max(150, h * .28)), gap = Math.min(110, Math.max(48, w * .05));
  // (The lowest kept this far clear of the foot of the box.)
  const floor = h - block - 18;
  const stops = tower.stops.map((angle, i) => {
    const at = towerAt(tower, angle);
    return { i, left: i % 2 === 0, x: at.x, y: at.y + T * .12, top: at.y - 22 };
  });
  // Each side, top to bottom, kept a block apart and on the screen.
  for (const left of [true, false]) {
    const side = stops.filter(stop => stop.left === left).sort((a, b) => a.top - b.top);
    side.forEach((stop, k) => { stop.top = Math.max(stop.top, k ? side[k - 1].top + block : 0); });
    for (let k = side.length - 1; k >= 0; k--) side[k].top = Math.min(side[k].top, k < side.length - 1 ? side[k + 1].top - block : floor);
    side.forEach(stop => { stop.top = Math.max(0, stop.top); });
  }
  return stops.map(stop => {
    // The leader: from the stop across the column to its edge, out, and over (at a slant) to the words' first line.
    const dir = stop.left ? -1 : 1, edge = cx + dir * R, out = edge + dir * 12, end = edge + dir * gap;
    const y = stop.top + 9, slant = Math.min(Math.abs(y - stop.y), (gap - 26) * .5);
    return {
      ...stop,
      on: `M${stop.x.toFixed(1)} ${stop.y.toFixed(1)} H${edge.toFixed(1)}`,
      off: `M${edge.toFixed(1)} ${stop.y.toFixed(1)} H${out.toFixed(1)} L${(out + dir * slant).toFixed(1)} ${y.toFixed(1)} H${end.toFixed(1)}`,
      style: {
        '--stop-top': `${stop.top.toFixed(1)}px`,
        ...(stop.left ? { '--stop-right': `${(w - end + 10).toFixed(1)}px` } : { '--stop-left': `${(end + 10).toFixed(1)}px` }),
        '--stop-width': `${Math.max(180, Math.min(370, stop.left ? end - 10 : w - end - 10)).toFixed(0)}px`,
      },
    };
  });
}

/**
 * The tower (tower.js): a column with a ribbon of road wound round it, the
 * coin (drawn by the stage) climbing it. The road behind the coin is drawn in
 * as it goes (the trail, set by the about as the stage reports the climb); at
 * each stop, a mark on the road and its year cut into the column under it;
 * over the summit, a burst once the coin is up there.
 */
function Tower({ tower, beside, stop }) {
  const { body, runs } = useMemo(() => towerPaths(tower), [tower]);
  const { w, h, cx, R, ry, T, r, topY, baseY } = tower;
  const marks = tower.stops.map(angle => towerAt(tower, angle));
  const summit = marks[marks.length - 1];
  const last = marks.length - 1;
  return (
    <svg className="about__tower" viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`} aria-hidden="true">
      <defs>
        {/* Round, lit from the left: its sides falling away into shade, a sheen down it left of the middle. */}
        <linearGradient id="about-tower-round" x1="0" x2="1" y1="0" y2="0">
          <stop className="about__shade" offset="0" stopOpacity=".55" />
          <stop className="about__shade" offset=".18" stopOpacity=".14" />
          <stop className="about__sheen" offset=".33" stopOpacity=".16" />
          <stop className="about__sheen" offset=".44" stopOpacity="0" />
          <stop className="about__shade" offset=".72" stopOpacity=".12" />
          <stop className="about__shade" offset="1" stopOpacity=".6" />
        </linearGradient>
        <radialGradient id="about-tower-pool">
          <stop className="about__shade" offset="0" stopOpacity=".32" />
          <stop className="about__shade" offset="1" stopOpacity="0" />
        </radialGradient>
        <clipPath id="about-tower-body"><path d={body} /></clipPath>
        <clipPath id="about-tower-roads">{runs.map(run => <path d={run.road} key={run.a} />)}</clipPath>
      </defs>
      {/* Where it stands: its shadow on the floor. */}
      <ellipse fill="url(#about-tower-pool)" cx={cx + R * .25} cy={baseY + ry * .35} rx={R * 1.9} ry={ry * 2} />
      <path className="about__column" d={body} />
      <rect clipPath="url(#about-tower-body)" fill="url(#about-tower-round)" x={cx - R} y={topY - ry} width={2 * R} height={baseY - topY + 2 * ry} />
      <g clipPath="url(#about-tower-body)">
        {runs.map(run => <path className="about__road-shadow" d={run.shadow} key={run.a} />)}
      </g>
      <ellipse className="about__column-top" cx={cx} cy={topY} rx={R} ry={ry} />
      {/* The landing at the summit, where the road comes out on top. */}
      <ellipse className="about__road" cx={summit.x} cy={summit.y - T * .08} rx={T * 1.25} ry={T * 1.25 * TOWER.tilt + T * .32} />
      {runs.map(run => (
        <g key={run.a}>
          <path className="about__road" d={run.road} />
          <path className="about__road-wall" d={run.wall} />
        </g>
      ))}
      {/* The road round as the column is: a little shade where it turns away. */}
      <rect className="about__road-round" clipPath="url(#about-tower-roads)" fill="url(#about-tower-round)" x={cx - R} y={topY - ry} width={2 * R} height={baseY - topY + 2 * ry} />
      {runs.map(run => (
        <g key={run.a}>
          <path className="about__trail-ahead" d={run.trail} />
          <path className="about__trail" d={run.trail} pathLength="1" data-a={run.a} data-b={run.b} />
        </g>
      ))}
      {/* Each stop: a mark on the road, its year cut into the column under it. */}
      {marks.map((at, i) => (
        <g className="about__mark" key={i} data-active={stop === i} data-past={i < stop}>
          <circle cx={at.x} cy={at.y + T * .12} r={Math.max(2.5, T * .17)} />
          <text x={at.x} y={at.y + T * .5 + Math.max(11, T * .62)}>{LINE.stops[i].year}</text>
        </g>
      ))}
      {/* The summit: a burst round the coin standing on it. */}
      <g className="about__burst" data-active={stop === last} transform={`translate(${summit.x.toFixed(1)} ${(summit.y - r).toFixed(1)})`}>
        {Array.from({ length: 12 }, (_, k) => {
          const a = k / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          return <path key={k} style={{ '--k': k }} pathLength="1" d={`M${(c * r * 1.4).toFixed(1)} ${(s * r * 1.4).toFixed(1)} L${(c * r * (k % 2 ? 1.75 : 2)).toFixed(1)} ${(s * r * (k % 2 ? 1.75 : 2)).toFixed(1)}`} />;
        })}
      </g>
      {/* The leaders out to the words about each stop (wide screens). */}
      {beside && beside.map(item => (
        <g className="about__leader" key={item.i} data-state={item.i < stop ? 'past' : item.i === stop ? 'active' : 'future'}>
          <path className="about__leader-on" d={item.on} pathLength="1" />
          <path className="about__leader-off" d={item.off} pathLength="1" />
        </g>
      ))}
    </svg>
  );
}

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
 * the title; drops onto the road wound up a tower (tower.js) and climbs it,
 * stop by stop, round the back of the column and out again, turning to each
 * one's tool and summiting at today; then goes to the bench, where each step
 * of the process makes it again: sketched, modelled, built, finished, each
 * beside a client's words about that part of the work.
 *
 * After it, in the page's own flow: the numbers, more clients in their words,
 * what else is on the bench, and the way to get in touch.
 */
export default function About() {
  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const moreRef = useRef(null);
  const [stop, setStop] = useState(0);
  const [step, setStep] = useState(0);
  /** Which of his sides the coin on the card shows: 'engineer', 'artist', or null (not there yet). */
  const [side, setSide] = useState(null);
  /** The tower as it stands in its box (tower.js towerLayout), once measured. */
  const [tower, setTower] = useState(null);
  const beside = useMemo(() => (tower && !tower.stacked ? besideTower(tower) : null), [tower]);
  const screens = aboutScreens(LINE.stops.length, PROCESS.steps.length);
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
    },
    onPointerCancel: () => { hand.current = null; stage.coinLet(0); },
    onPointerLeave: () => { if (!hand.current) stage.coinPoint(null); },
  };

  useLayoutEffect(() => {
    const root = rootRef.current, pin = pinRef.current;
    const onTransition = state => {
      for (const key of ['enter', 'title', 'lede', 'card', 'line', 'bench']) root.style.setProperty(`--about-${key}`, state[key].toFixed(4));
      // Each layer there only while it shows at all, and only the one on show taking the pointer.
      for (const key of ['card', 'line', 'bench']) {
        const shown = state[key] > .001 ? 'on' : 'off';
        if (root.dataset[key] !== shown) root.dataset[key] = shown;
      }
      const on = state.bench > .5 ? 'bench' : state.line > .5 ? 'line' : state.card > .5 ? 'card' : 'none';
      if (root.dataset.layer !== on) root.dataset.layer = on;
      setStop(state.stopOn);
      setStep(state.stepOn);
      // The road behind the coin, drawn in up to where it has climbed (each stretch in front: from its angle a to b).
      const climb = state.climb ?? -Infinity;
      root.querySelectorAll('.about__trail').forEach(node => {
        const a = Number(node.dataset.a), b = Number(node.dataset.b);
        node.style.strokeDashoffset = (1 - clamp01((climb - a) / (b - a))).toFixed(4);
      });
    };
    let lastTower = null;
    const measure = () => {
      const spot = selector => {
        const box = placeIn(root.querySelector(selector), pin);
        return { x: box.x + box.w / 2, y: box.y + box.h / 2, r: box.w / 2 };
      };
      // The tower, in its box: drawn by the tower here, the coin stood on it by the stage, from the one geometry.
      const climbBox = placeIn(root.querySelector('.about__climb'), pin);
      const built = towerLayout({ w: climbBox.w, h: climbBox.h, n: LINE.stops.length, stacked: window.matchMedia(STACKED).matches });
      const same = lastTower && JSON.stringify(lastTower) === JSON.stringify(built);
      if (!same) { lastTower = built; setTower(built); }
      stage.setAbout({
        top: root.getBoundingClientRect().top + window.scrollY,
        height: root.offsetHeight,
        vh: pin.offsetHeight,
        card: spot('.about__spot--card'),
        bench: spot('.about__spot--bench'),
        line: { x: climbBox.x, y: climbBox.y, r: lastTower.r, stops: lastTower.stops, tower: lastTower },
        faces: LINE.stops.map(item => item.face),
        steps: PROCESS.steps.length,
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

  // The page after the pinned screen: each piece comes in as it scrolls into view, the numbers counting up to themselves.
  useEffect(() => {
    const more = moreRef.current;
    const count = node => {
      const value = Number(node.dataset.value), decimals = Number(node.dataset.decimals ?? 0);
      if (reducedMotion) return;
      const shown = { value: 0 };
      gsap.to(shown, {
        value, duration: 1.6, ease: 'power3.out',
        onUpdate: () => { node.textContent = shown.value.toFixed(decimals); },
      });
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      entry.target.querySelectorAll('[data-value]').forEach(count);
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    more.querySelectorAll('[data-in]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const lede = (text, from = 0) => <Words text={text} from={from} />;

  return (
    <>
      <section className="about" id="about" ref={rootRef}
        style={{ height: `${100 + screens * 100}vh` }} aria-labelledby="about-title"
        data-stop={stop} data-step={step} data-layer="none" data-card="on" data-line="off" data-bench="off">
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

          {/* The tower: a ribbon of road wound up a column, a stop for each step of the way, the coin climbing it
              from one to the next and the words about each coming out to the side it stands on. */}
          <div className="about__line about__layer" data-layer-name="line">
            <div className="about__line-head">
              <h3 className="about__line-title">{LINE.title}</h3>
              <p className="about__line-lede">{LINE.lede}</p>
            </div>
            <div className="about__climb" data-stacked={tower?.stacked ?? false}>
              {tower && <Tower tower={tower} beside={beside} stop={stop} />}
              <ol className="about__stops">
                {LINE.stops.map((item, i) => (
                  <li className="about__stop" key={item.id} style={beside?.[i].style}
                    data-side={i % 2 ? 'right' : 'left'} data-state={i < stop ? 'past' : i === stop ? 'active' : 'future'}
                    aria-current={stop === i ? 'step' : undefined}>
                    <p className="about__stop-no">
                      <span className="about__stop-count">{String(i + 1).padStart(2, '0')}</span>
                      <span className="about__year">{item.year}{item.span && <span className="about__span"> · {item.span}</span>}</span>
                    </p>
                    <h4 className="about__where about__words" aria-label={item.where}><Words text={item.where} /></h4>
                    <p className="about__role">{item.role}<span aria-hidden="true"> · </span>{item.place}</p>
                    <div className="about__stop-more"><p className="about__text">{item.text}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* The bench: how a project goes, the coin made again by each step (drawn in .about__spot--bench). */}
          <div className="about__bench about__layer" data-layer-name="bench">
            <div className="about__desk">
              <svg className="about__guides" viewBox="-100 -100 200 200" aria-hidden="true">
                <circle className="about__guide-circle" r="64" pathLength="1" />
                <path className="about__guide-centre" d="M-96 0 H96 M0 -96 V74" />
                <path className="about__guide-dim" d="M-64 82 H64 M-64 76 V88 M64 76 V88" />
                <text className="about__guide-label" x="0" y="96">Ø 1 : 1</text>
              </svg>
              <div className="about__spot about__spot--bench" aria-hidden="true" />
              <p className="about__figure" aria-hidden="true">
                {PROCESS.steps.map((item, i) => (
                  <span key={item.id} data-active={step === i}>Fig. {i + 1}<span className="about__figure-dash"> — </span>{item.figure}</span>
                ))}
              </p>
            </div>
            <div className="about__process">
              <h3 className="about__bench-title">{PROCESS.title}</h3>
              <p className="about__bench-lede">{PROCESS.lede}</p>
              <ol className="about__steps-index" aria-hidden="true">
                {PROCESS.steps.map((item, i) => (
                  <li key={item.id} data-active={step === i} data-done={i < step}><span>0{i + 1}</span>{item.title}</li>
                ))}
              </ol>
              <div className="about__step-view">
                {PROCESS.steps.map((item, i) => (
                  <article className="about__step" key={item.id} data-active={step === i} aria-hidden={step !== i} inert={step !== i ? '' : undefined}>
                    <h4 className="about__step-title"><span>0{i + 1}</span> {item.title}</h4>
                    <p className="about__step-text">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-more" ref={moreRef} aria-label="Saad in numbers, and what else he makes">
        <ul className="about-more__numbers" data-in>
          {ABOUT.numbers.map((item, i) => (
            <li style={{ '--i': i }} key={item.label}>
              <span className="about-more__value" data-value={item.value} data-decimals={item.decimals ?? 0}>
                {reducedMotion ? item.value.toFixed(item.decimals ?? 0) : (0).toFixed(item.decimals ?? 0)}
              </span>
              <span className="about-more__label">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="about-more__bench">
          <h3 className="about-more__title" data-in>{ABOUT.bench.title}</h3>
          <ul className="about-more__items">
            {ABOUT.bench.items.map((item, i) => (
              <li style={{ '--i': i }} key={item.title} data-in>
                <span className="about-more__no">0{i + 1}</span>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
