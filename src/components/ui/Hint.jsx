import { useEffect, useRef } from 'react';
import Gesture from './Gesture.jsx';
import './Hint.css';

/**
 * A hint: what can be done here, as a small chip with the gesture moving in
 * it (Gesture), springing in when `on` and out when not. The one way the
 * site's hints look, wherever they are. Its loops only run while it is near the
 * screen (data-near, Hint.css): they are redrawn by the main thread, seen or not.
 */
export default function Hint({ kind = 'drag', on = true, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const observer = new IntersectionObserver(([entry]) => node.toggleAttribute('data-near', entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <p className={`hint${className ? ` ${className}` : ''}`} data-on={on} ref={ref} aria-hidden="true">
      <span className="hint__icon"><Gesture kind={kind} /></span>
      <span className="hint__label">{children}</span>
    </p>
  );
}
