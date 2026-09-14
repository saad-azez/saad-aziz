import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Sheet from '../sheet/Sheet.jsx';
import { ABOUT, SHEETS } from '../../content/site.js';
import { isPlaceholder } from '../../lib/reveal.js';
import { reducedMotion } from '../../brand/motion.js';
import portrait from '../../assets/portrait.jpeg';
import threedotjs from '../../assets/logos/threedotjs.svg?raw';
import react from '../../assets/logos/react.svg?raw';
import webflow from '../../assets/logos/webflow.svg?raw';
import framer from '../../assets/logos/framer.svg?raw';
import figma from '../../assets/logos/figma.svg?raw';
import './About.css';

gsap.registerPlugin(ScrollTrigger);

/**
 * Sheet 02 — about.
 *
 * The figure on the left, the record on the right: the story, then the two
 * tables a drawing keeps — its revisions (how it changed: the timeline) and
 * its schedule (what goes where: what I build with, and what each is for).
 *
 * The figure is pinned under the head rail while the record scrolls past it.
 * Pinned by ScrollTrigger rather than `position: sticky`, because the page is
 * moved by transform (ScrollSmoother) and sticky only answers native scroll.
 */
const sheet = SHEETS.find(s => s.id === 'about');
const MARKS = { threedotjs, react, webflow, framer, figma };

function Table({ field, columns, children }) {
  return (
    <div className="table">
      <p className="table__field" data-rise>
        <span className="table__field-key" aria-hidden="true">§</span>{field}
      </p>
      {columns && (
        <p className="table__cols" data-rise>
          {columns.map(col => <span key={col}>{col}</span>)}
        </p>
      )}
      {children}
    </div>
  );
}

export default function About() {
  const bodyRef = useRef(null);
  const figureRef = useRef(null);
  const recordRef = useRef(null);

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(min-width: 64.01em)', () => {
      const figure = figureRef.current, record = recordRef.current;
      const railTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-top')) || 64;
      const gutter = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 24;
      ScrollTrigger.create({
        trigger: bodyRef.current,
        pin: figure,
        pinSpacing: false,
        start: () => `top ${railTop() + gutter()}px`,
        end: () => `+=${Math.max(0, record.offsetHeight - figure.offsetHeight)}`,
        invalidateOnRefresh: true,
      });
    });
    return () => media.revert();
  }, []);

  return (
    <Sheet id={sheet.id} index={sheet.index} eyebrow={ABOUT.eyebrow} title={ABOUT.title}>
      <div className="about__body" ref={bodyRef}>
        <figure className="figure" ref={figureRef} data-rise>
          <span className="figure__frame">
            <img className="figure__img" src={portrait} alt={`${ABOUT.figure.legend.replace(/\.$/, '')}, in a maroon three-piece suit.`} />
            <span className="figure__corner figure__corner--tl" aria-hidden="true" />
            <span className="figure__corner figure__corner--tr" aria-hidden="true" />
            <span className="figure__corner figure__corner--bl" aria-hidden="true" />
            <span className="figure__corner figure__corner--br" aria-hidden="true" />
          </span>
          <figcaption className="figure__caption">
            <span className="figure__caption-key">{ABOUT.figure.caption}</span>
            <span>{ABOUT.figure.legend}</span>
          </figcaption>
        </figure>

        <div className="about__record" ref={recordRef}>
          <div className="about__story">
            {ABOUT.story.map((paragraph, i) => (
              <p className={i === 0 ? 'about__lede' : 'about__para'} data-rise key={i}>{paragraph}</p>
            ))}
          </div>

          <Table field={ABOUT.revisions.field} columns={ABOUT.revisions.columns}>
            {ABOUT.revisions.rows.map(row => (
              <div className="table__row" data-rise key={row.rev}>
                <span className="table__rule" data-rule aria-hidden="true" />
                <span className="table__rev">{row.rev}</span>
                <span className={`table__date${isPlaceholder(row.date) ? ' ph' : ''}`}>{row.date}</span>
                <span className={`table__note${isPlaceholder(row.note) ? ' ph' : ''}`}>{row.note}</span>
              </div>
            ))}
            <span className="table__end" data-rule aria-hidden="true" />
          </Table>

          <Table field={ABOUT.schedule.field}>
            {ABOUT.schedule.rows.map(row => (
              <div className="table__row table__row--schedule" data-rise key={row.mark}>
                <span className="table__rule" data-rule aria-hidden="true" />
                <span className="table__mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MARKS[row.mark] }} />
                <span className="table__name">{row.name}</span>
                <span className="table__note">{row.use}</span>
              </div>
            ))}
            <span className="table__end" data-rule aria-hidden="true" />
          </Table>
        </div>
      </div>
    </Sheet>
  );
}
