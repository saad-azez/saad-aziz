import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ABOUT } from '../../content/site.js';
import { stage, FOV } from '../../webgl/stage/DotStage.js';
import { processTransition, PROCESS_SCREENS, LINES_AT, LINE_CHANGE } from '../../webgl/stage/processTransition.js';
import { ABOUT_SCROLL } from '../../webgl/stage/aboutTransition.js';
import { reducedMotion } from '../../brand/motion.js';
import './Process.css';

const PROCESS = ABOUT.process;
/** What each of the coin's eight outer pieces is, in the order they come back in (puzzle DOCK): a step's two, then the next's. */
const PARTS = PROCESS.steps.flatMap(step => step.parts);
/**
 * How far (screens) this screen lies under the end of the about's: the coin's way over from the five years
 * (aboutTransition TO_PROCESS). `m` 0 is where that ends, the coin in its place here. And how far before that (screens)
 * this screen starts to come up over the about's, the same wall.
 */
const UNDER = ABOUT_SCROLL.TO_PROCESS, FADE = .25;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

/**
 * Where each of the eight goes as the coin comes apart (Puzzle place), in DOCK order: across the room round the coin,
 * of the room's width and height from its top left; how near (+) or far (−) it is, of the coin's radius; and how it
 * is tipped and turned (rad). Never one where the headline is; the far ones partly behind the coin, so it hides them.
 */
const SPOTS = {
  wide: [[.3, .14, -1.1, .2, -.3], [.86, .3, -.4, -.15, .25], [.7, .86, -1.4, .25, .5], [.12, .44, -.7, -.2, -.4],
    [.8, .68, .5, .1, -.2], [.58, .1, -1.6, -.25, .35], [.36, .7, -2, .2, -.15], [.17, .2, .4, -.1, .3]],
  tall: [[.2, .08, -1, .2, -.3], [.82, .2, -.4, -.15, .25], [.82, .88, -1, .25, .5], [.12, .56, -.6, -.2, -.4],
    [.86, .58, .35, .1, -.2], [.55, .04, -1.6, -.25, .35], [.5, .98, -1.8, .2, -.15], [.18, .92, .3, -.1, .3]],
};

const documentTop = element => {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
};

/**
 * The coin and where its pieces go, for a pinned screen `w` by `h` (px) whose head comes down to `head`, whose foot
 * starts `foot` from the bottom, with `inset` at the sides and `reserve` kept clear over the foot for the headline:
 * the coin in the middle of the room, as big as it fits; each piece's place from SPOTS, moved in as far as it takes
 * for the piece to stay inside the room as the camera sees it (nearer is bigger, and further from the middle).
 */
function layoutFor(w, h, head, foot, inset, reserve) {
  const tall = w / h < .8;
  const top = head, bottom = h - foot - (tall ? reserve : 0), room = bottom - top;
  const r = Math.round(tall ? clamp(Math.min(w * .3, room * .24), 84, 150) : clamp(Math.min(w * .15, room * .26), 100, 210));
  const disc = { x: Math.round(w / 2), y: Math.round(top + room * (tall ? .48 : .5)), r };
  const distance = (h / 2) / Math.tan(FOV * Math.PI / 360), cx = w / 2, cy = h / 2;
  const spots = SPOTS[tall ? 'tall' : 'wide'].map(([fx, fy, fz, rx, rz]) => {
    const z = fz * r, scale = distance / (distance - z), reach = r * .58 * scale;
    // Where it is seen, kept inside the room, and back to where it is.
    const sx = clamp(cx + (inset + fx * (w - inset * 2) - cx) * scale, inset + reach, w - inset - reach);
    const sy = clamp(cy + (top + fy * room - cy) * scale, top + reach, bottom - reach);
    return { x: cx + (sx - cx) / scale, y: cy + (sy - cy) / scale, z: fz, rx, rz };
  });
  return { w, h, head, foot, inset, tall, disc, spots };
}

/**
 * The process: the coin taken apart and put back together (processTransition has the choreography; the stage draws
 * it, Puzzle, DotStage stepProcess).
 *
 * One pinned screen, lying under the end of the about's: the coin comes over from the five years and arrives in the
 * middle, face on, his words on it. Then the light drops low across it, seams that
 * were always there show, and his words give way to the reader's. It comes apart along them, each piece turning over to what it
 * is, one part of a project; they go out to places of their own, near and far; and the coin's heart draws them back
 * in, a step's two parts at a time, until it is one coin again. Over it, one line says what is happening, each new
 * line fading in once the last has faded out; and round the top of the coin the steps are named as their parts come in.
 *
 * The words are their own layer over the stage's canvas (it draws over the page), moved with the pinned screen as it
 * comes and goes. All of it with the scroll, back as readily.
 */
export default function Process() {
  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const frameRef = useRef(null);
  const wordsRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useLayoutEffect(() => {
    const pin = pinRef.current, frame = frameRef.current;
    const measure = () => {
      const w = pin.offsetWidth, h = pin.offsetHeight;
      if (!w || !h) return;
      const head = frame.offsetTop, foot = h - frame.offsetTop - frame.offsetHeight, inset = frame.offsetLeft;
      // (The headline's room over the foot on an upright screen: its label and two lines, as Process.css sets them.)
      const reserve = 24 + clamp(w * .084, 28, 40) * 2.1 + 16;
      setLayout(was => {
        if (was && was.w === w && was.h === h && was.head === head && was.foot === foot && was.inset === inset) return was;
        return layoutFor(w, h, head, foot, inset, reserve);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pin);
    return () => observer.disconnect();
  }, []);

  // The stage's part: the coin, where its pieces go, and what each is (its place on the page from where the coin is here).
  useLayoutEffect(() => {
    if (!layout) return;
    const root = rootRef.current, pin = pinRef.current;
    const report = () => stage.setProcess({
      top: documentTop(root) + UNDER * pin.offsetHeight, height: root.offsetHeight - UNDER * pin.offsetHeight, vh: pin.offsetHeight,
      clip: layout.head, disc: layout.disc, spots: layout.spots, labels: PARTS, heart: PROCESS.heart, tall: layout.tall,
    });
    report();
    // (Its place on the page moves with everything above it.)
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    return () => { observer.disconnect(); stage.setProcess(null); };
  }, [layout]);

  // The words, with the scroll.
  useEffect(() => {
    if (!layout) return;
    const root = rootRef.current, pin = pinRef.current, words = wordsRef.current;
    const lines = [...words.querySelectorAll('.process-words__line')];
    const kicker = words.querySelector('.process-words__kicker');
    const steps = [...words.querySelectorAll('.process-words__step')];
    let frame = 0;
    const run = () => {
      frame = 0;
      const vh = pin.offsetHeight || window.innerHeight, start = documentTop(root), top = start + UNDER * vh, scroll = window.scrollY;
      const m = (scroll - top) / vh, end = (root.offsetHeight - UNDER * vh - vh) / vh;
      // (None of this screen until the coin is nearly here, and all of it once it is.)
      const shown = reducedMotion ? (m >= 0 ? 1 : 0) : smooth((m + FADE) / FADE);
      pin.style.visibility = shown > 0 ? 'visible' : 'hidden';
      pin.style.opacity = shown.toFixed(3);
      const on = m > -1 && m < end + 1;
      // (Not shown at all off its screen: each line of the headline sets its own visibility.)
      words.style.display = on ? 'block' : 'none';
      if (!on) return;
      const off = clamp(scroll, start, start + root.offsetHeight - vh) - scroll;
      words.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
      // (Under the head's line only, as the puzzle is: its own as it comes up, the head's, which stays, as it goes.)
      words.style.clipPath = `inset(${(off >= 0 ? layout.head : layout.head - off).toFixed(1)}px 0 0 0)`;
      // The headline: the old line fades out, and then the new one fades in, rising a touch (the first as the coin arrives).
      const change = i => clamp((m - LINES_AT[i] + LINE_CHANGE / 2) / LINE_CHANGE, 0, 1);
      kicker.style.opacity = (reducedMotion ? (change(0) >= .5 ? 1 : 0) : smooth(change(0))).toFixed(3);
      lines.forEach((line, i) => {
        const coming = change(i), going = i + 1 < lines.length ? change(i + 1) : 0;
        const into = reducedMotion ? (coming >= .5 ? 1 : 0) : smooth((coming - .5) / .5);
        const away = reducedMotion ? (going >= .5 ? 1 : 0) : smooth(going / .5);
        const shown = into * (1 - away);
        line.style.opacity = shown.toFixed(3);
        line.style.visibility = shown > 0 ? 'visible' : 'hidden';
        line.style.transform = reducedMotion ? '' : `translateY(${((1 - into) * .3 - away * .3).toFixed(3)}em)`;
      });
      // The steps round the coin: each said once both its parts are in; the last said in the accent.
      const t = processTransition(m, reducedMotion);
      steps.forEach((step, k) => {
        step.style.fillOpacity = t.said[k].toFixed(3);
        step.dataset.latest = k === t.latest ? 'true' : 'false';
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [layout]);

  const disc = layout?.disc, ring = disc ? disc.r * 1.24 : 0, box = ring + 48;

  return (
    <section className="process" id="process" ref={rootRef} aria-labelledby="process-title"
      style={{ height: `${100 + (PROCESS_SCREENS + UNDER) * 100}vh`, marginTop: `${-(1 + UNDER) * 100}vh` }}>
      {/* (All of it at once, for a screen reader: the coin is drawn for the eye.) */}
      <div className="process__hidden">
        <h2 id="process-title">{PROCESS.kicker}</h2>
        <p>{PROCESS.lines.join(' ')}</p>
        <ol>{PROCESS.steps.map(step => <li key={step.id}>{step.title}: {step.parts.join(', ')}. {step.text}</li>)}</ol>
        <p>{PROCESS.whole}</p>
      </div>
      {/* The room the coin comes apart in (the stage draws it over this). */}
      <div className="process__pin" ref={pinRef}>
        <div className="process__frame" ref={frameRef} />
      </div>
      {layout && createPortal(
        <div className="process-words" ref={wordsRef} aria-hidden="true" data-layout={layout.tall ? 'tall' : 'wide'} style={{ height: layout.h }}>
          <svg className="process-words__ring" width={box * 2} height={box * 2} viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`}
            style={{ left: disc.x - box, top: disc.y - box }}>
            <path id="process-ring" d={`M ${-ring} 0 A ${ring} ${ring} 0 0 1 ${ring} 0`} fill="none" />
            <text>
              <textPath href="#process-ring" startOffset="50%" textAnchor="middle">
                {PROCESS.steps.map((step, k) => (
                  <tspan className="process-words__step" key={step.id}>{k ? ' · ' : ''}{step.title.toUpperCase()}</tspan>
                ))}
              </textPath>
            </text>
          </svg>
          <div className="process-words__head" style={{ left: layout.inset, right: layout.tall ? layout.inset : 'auto', bottom: layout.foot }}>
            <p className="process-words__kicker">{PROCESS.kicker}</p>
            <div className="process-words__lines">
              {PROCESS.lines.map(line => (
                <p className="process-words__line" key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
