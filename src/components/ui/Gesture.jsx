import './Gesture.css';

/**
 * A gesture, drawn and moving, so a hint shows what to do as well as saying it:
 *
 *   drag   a fingertip sliding to and fro between two chevrons;
 *   tap    a fingertip pressing, a ring going out from it;
 *   look   a lens drifting, a glint in it;
 *   grab   a fingertip lifting, an arrow up from it.
 *
 * In currentColor, 24 px square; still, with reduced motion (Gesture.css).
 */
export default function Gesture({ kind = 'drag' }) {
  return (
    <svg className={`gesture gesture--${kind}`} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'drag' && <>
        <path className="gesture__chevron" d="M5.5 9 2.5 12l3 3" />
        <path className="gesture__chevron gesture__chevron--end" d="M18.5 9l3 3-3 3" />
        <circle className="gesture__tip" cx="12" cy="12" r="3.3" />
      </>}
      {kind === 'tap' && <>
        <circle className="gesture__ring" cx="12" cy="12" r="8.5" />
        <circle className="gesture__tip" cx="12" cy="12" r="3.3" />
      </>}
      {kind === 'look' && <g className="gesture__lens">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
        <path className="gesture__glint" d="M8 8.5a3 3 0 0 1 2.5-1.5" />
      </g>}
      {kind === 'grab' && <>
        <path className="gesture__arrow" d="M12 3.5v6M9 6.5l3-3 3 3" />
        <circle className="gesture__tip" cx="12" cy="16" r="3.3" />
      </>}
    </svg>
  );
}
