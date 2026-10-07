import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { projectTitle, projectPending } from '../../content/projectDisplay.js';
import { reducedMotion } from '../../brand/motion.js';
import RingButton from '../ui/RingButton.jsx';
import { stage } from '../../webgl/stage/DotStage.js';
import './PageViewer.css';

/**
 * The page on show, lifted out of the book into the reader's hands: on a phone
 * the open book's pages are a few hundred pixels wide, too small to see a site
 * by. Tapped (or "Look closer"), the page comes up out of the book's room
 * (`from`, its box on the screen), turning to face the reader and growing to
 * a sheet of the book's own paper, with the whole site on it, top to bottom,
 * to scroll through (public/work/<id>.webp, scripts/capture-previews.mjs), its
 * name, the way to it, and the pages either side. Put down, it goes back into
 * the book the way it came.
 */
/** Kept to the viewer (React carries a portal's events up to the component that rendered it). */
const stop = event => event.stopPropagation();

export default function PageViewer({ project, index, count, from, onClose, onStep }) {
  const rootRef = useRef(null);
  const sheetRef = useRef(null);
  const closing = useRef(false);
  const title = projectTitle(project, index);
  const pending = projectPending(project);

  // Up out of the book: from its room, small, turned and tipped back like the page on show, to the sheet.
  useLayoutEffect(() => {
    const root = rootRef.current, sheet = sheetRef.current, backdrop = root.querySelector('.page-viewer__backdrop');
    // Nothing on it can be touched until it has come all the way up: a stray click from the tap that brought it
    // (or a hand still moving) must not land on its link to the site, or put it straight back down.
    root.dataset.arriving = 'true';
    // Once it is all the way up, the drawing under it is put away (DotStage suspend): a phone needs the memory for
    // the whole site on the page, and nothing of the book shows under the sheet.
    const arrived = () => { delete root.dataset.arriving; stage.suspend(true); };
    if (reducedMotion || !from) { gsap.set(backdrop, { opacity: 1 }); const wait = setTimeout(arrived, 350); return () => clearTimeout(wait); }
    const box = sheet.getBoundingClientRect();
    const scale = Math.max(.15, Math.min(.6, (from.width * .55) / box.width));
    const tween = gsap.timeline({ onComplete: arrived });
    tween.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: .45, ease: 'power2.out' }, 0);
    tween.fromTo(sheet,
      { x: from.left + from.width / 2 - (box.left + box.width / 2), y: from.top + from.height / 2 - (box.top + box.height / 2), scale, rotation: -7, rotationX: 38, opacity: 0 },
      { x: 0, y: 0, scale: 1, rotation: 0, rotationX: 0, opacity: 1, duration: .8, ease: 'expo.out' }, 0);
    tween.fromTo(sheet.querySelectorAll('[data-in]'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .05, ease: 'power2.out' }, .3);
    return () => tween.kill();
  }, []);

  // Put down: back into the book the way it came, then gone.
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    // The book back under it first, for the page to go back into.
    stage.suspend(false);
    const sheet = sheetRef.current, backdrop = rootRef.current.querySelector('.page-viewer__backdrop');
    if (reducedMotion || !from) { onClose(); return; }
    const box = sheet.getBoundingClientRect();
    const scale = Math.max(.15, Math.min(.6, (from.width * .55) / box.width));
    gsap.timeline({ onComplete: onClose })
      .to(sheet, { x: from.left + from.width / 2 - (box.left + box.width / 2), y: from.top + from.height / 2 - (box.top + box.height / 2), scale, rotation: -7, rotationX: 38, opacity: 0, duration: .5, ease: 'power3.in' }, 0)
      .to(backdrop, { opacity: 0, duration: .4, ease: 'power1.in' }, .1);
  };

  // Escape puts it down; the close button has the focus. (The page under it is not locked: nothing on the sheet
  // scrolls it, PageViewer.css touch-action and overscroll-behavior; locking the page's own scroll on a phone moves it.)
  useEffect(() => {
    const returnTo = document.activeElement;
    rootRef.current.querySelector('.page-viewer__close')?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') onStep(1);
      if (event.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stage.suspend(false);
      window.removeEventListener('keydown', onKey);
      returnTo?.focus?.({ preventScroll: true });
    };
  }, []);

  // Another page: the site on it comes in fresh, from the top.
  useEffect(() => {
    const scroller = rootRef.current.querySelector('.page-viewer__site');
    scroller.scrollTop = 0;
    if (!reducedMotion) gsap.fromTo(scroller.querySelector('img'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .45, ease: 'power2.out' });
  }, [project.id]);

  return createPortal(
    // Its own: nothing done on it reaches the work under it (whose arrow keys would turn the book a second time).
    <div className="page-viewer" ref={rootRef} role="dialog" aria-modal="true" aria-label={`${title}: the site, top to bottom`}
      onClick={stop} onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onKeyDown={stop}>
      <div className="page-viewer__backdrop" onClick={close} />
      <article className="page-viewer__sheet" ref={sheetRef}>
        <header className="page-viewer__head" data-in>
          <p className="page-viewer__count">No. {String(index + 1).padStart(2, '0')} <span>of {String(count).padStart(2, '0')}</span></p>
          <h3 className="page-viewer__title">{title}</h3>
          {project.role && <p className="page-viewer__role">{project.role}</p>}
          <RingButton as="button" shape="round" className="page-viewer__close" onClick={close} aria-label="Put the page back">
            <span aria-hidden="true">×</span>
          </RingButton>
        </header>
        <div className="page-viewer__site" data-in tabIndex={0} aria-label={`${title}, top to bottom: scroll to see it all`}>
          <img src={`/work/${project.id}.webp`} alt={`The ${title} site, top to bottom`} decoding="async" draggable="false" />
          {pending && <p className="page-viewer__pending">Not published yet.</p>}
        </div>
        <footer className="page-viewer__foot" data-in>
          <RingButton as="button" shape="round" className="page-viewer__step" onClick={() => onStep(-1)} aria-label="The page before">
            <span aria-hidden="true">←</span>
          </RingButton>
          {project.href
            ? <RingButton href={project.href} target="_blank" rel="noreferrer" motion arrow>Visit site</RingButton>
            : <span className="page-viewer__soon">Not live yet</span>}
          <RingButton as="button" shape="round" className="page-viewer__step" onClick={() => onStep(1)} aria-label="The page after">
            <span aria-hidden="true">→</span>
          </RingButton>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
