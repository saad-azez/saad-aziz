import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Gesture from './Gesture.jsx';
import { reducedMotion } from '../../brand/motion.js';
import './CursorHint.css';

/** Only where there is a mouse (or a pen): a touch screen has no pointer to follow, and has the Hint chips. */
const FINE = '(hover: hover) and (pointer: fine)';

/**
 * The pointer's companion: over anything that can be handled (an element, or
 * one of its ancestors, with `data-cursor="what to do"` and, optionally,
 * `data-cursor-icon`: drag, tap, look, grab), a disc of the accent with the
 * gesture moving in it, and what to do beside it, follows the pointer a
 * little behind it, springing in; anywhere else, it is not there. The native
 * pointer stays as it is: this only says what the pointer can do.
 */
export default function CursorHint() {
  const rootRef = useRef(null);
  const [hint, setHint] = useState(null);
  const [fine] = useState(() => typeof window !== 'undefined' && window.matchMedia(FINE).matches);

  useEffect(() => {
    if (!fine) return undefined;
    const root = rootRef.current;
    const x = gsap.quickTo(root, 'x', { duration: reducedMotion ? .01 : .45, ease: 'power3.out' });
    const y = gsap.quickTo(root, 'y', { duration: reducedMotion ? .01 : .45, ease: 'power3.out' });
    let shown = null;
    const onMove = event => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      x(event.clientX);
      y(event.clientY);
      const host = event.target instanceof Element ? event.target.closest('[data-cursor]') : null;
      const next = host ? `${host.dataset.cursorIcon || 'drag'}|${host.dataset.cursor}` : null;
      if (next === shown) return;
      shown = next;
      setHint(host ? { kind: host.dataset.cursorIcon || 'drag', label: host.dataset.cursor } : null);
    };
    const onLeave = () => { shown = null; setHint(null); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [fine]);

  if (!fine) return null;
  return (
    <div className="cursor-hint" ref={rootRef} data-on={Boolean(hint)} aria-hidden="true">
      <span className="cursor-hint__disc"><Gesture kind={hint?.kind ?? 'drag'} key={hint?.kind} /></span>
      <span className="cursor-hint__label">{hint?.label}</span>
    </div>
  );
}
