import { useLayoutEffect, useRef } from 'react';
import { revealSheet } from '../../lib/reveal.js';
import './Sheet.css';

/**
 * A sheet.
 *
 * A drawing set is made of numbered sheets, and this page is a drawing set:
 * every section below the hero is one. Each opens with the same head — a rule,
 * the sheet number and its name in the margin, a display title, and an intro —
 * so the set reads as one document rather than a stack of landing-page bands.
 *
 * `night` flips the sheet's tokens to the other scheme (see tokens.css), the
 * way a drawing set carries the odd dark plate.
 */
export default function Sheet({ id, index, eyebrow, title, intro, night = false, className = '', children }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => revealSheet(rootRef.current), []);

  return (
    <section
      id={id}
      className={`sheet${night ? ' sheet--night' : ''}${className ? ` ${className}` : ''}`}
      ref={rootRef}
      aria-labelledby={`${id}-title`}
    >
      <header className="sheet__head">
        <span className="sheet__rule" data-rule aria-hidden="true" />
        <p className="sheet__meta">
          <span className="sheet__no" data-rise>
            <span className="sheet__no-key">Sheet</span>{index}
          </span>
          <span className="sheet__eyebrow" data-rise>{eyebrow}</span>
        </p>
        <h2 className="sheet__title" id={`${id}-title`}>
          {title.map((line, i) => (
            <span className="sheet__title-line" key={i}>
              <span className="sheet__title-text" data-line>{line}</span>
            </span>
          ))}
        </h2>
        {intro && <p className="sheet__intro" data-rise>{intro}</p>}
      </header>
      <div className="sheet__body">{children}</div>
    </section>
  );
}
