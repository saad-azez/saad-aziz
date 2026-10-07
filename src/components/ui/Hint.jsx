import Gesture from './Gesture.jsx';
import './Hint.css';

/**
 * A hint: what can be done here, as a small chip with the gesture moving in
 * it (Gesture), springing in when `on` and out when not. The one way the
 * site's hints look, wherever they are.
 */
export default function Hint({ kind = 'drag', on = true, className = '', children }) {
  return (
    <p className={`hint${className ? ` ${className}` : ''}`} data-on={on} aria-hidden="true">
      <span className="hint__icon"><Gesture kind={kind} /></span>
      <span className="hint__label">{children}</span>
    </p>
  );
}
