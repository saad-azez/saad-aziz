import Sheet from '../sheet/Sheet.jsx';
import { CONTACT, PERSON, SHEETS, STATUS } from '../../content/site.js';
import { isPlaceholder } from '../../lib/reveal.js';
import { useKarachiTime } from '../../lib/useKarachiTime.js';
import './Contact.css';

/**
 * Sheet 03 — contact, and the colophon that closes the set.
 *
 * One address, set large. The email is the only thing on the page that has to
 * be typed in by hand before launch; until it is, it renders as the
 * placeholder it is rather than as a broken link.
 */
const sheet = SHEETS.find(s => s.id === 'contact');

export default function Contact({ onNavigate }) {
  const time = useKarachiTime();
  const pending = isPlaceholder(PERSON.email);
  const links = PERSON.links.filter(link => link.href);

  return (
    <Sheet id={sheet.id} index={sheet.index} eyebrow={CONTACT.eyebrow} title={CONTACT.title} intro={CONTACT.intro}>
      <div className="contact__body">
        <div className="contact__address">
          <p className="contact__status" data-rise>
            <span className="contact__status-dot" aria-hidden="true" />
            {STATUS}
          </p>
          {pending
            ? <span className="contact__mail ph" data-rise>{PERSON.email}</span>
            : <a className="contact__mail" href={`mailto:${PERSON.email}`} data-rise>{PERSON.email}</a>}
        </div>
        {links.length > 0 && (
          <ul className="contact__links">
            {links.map(link => (
              <li key={link.label} data-rise>
                <a className="contact__link" href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="colophon">
        <span className="colophon__rule" data-rule aria-hidden="true" />
        {CONTACT.colophon.map(line => <p className="colophon__line" data-rise key={line}>{line}</p>)}
        <p className="colophon__line colophon__line--end" data-rise>
          {PERSON.city} <span className="colophon__clock">{time}</span>
          <a className="colophon__top" href="#top" onClick={event => { if (onNavigate) { event.preventDefault(); onNavigate('top'); } }}>
            Top
            <svg className="colophon__top-mark" viewBox="0 0 9 18" aria-hidden="true" focusable="false">
              <path d="M4.5 18 V2 M1 5.5 L4.5 2 L8 5.5" />
            </svg>
          </a>
        </p>
      </footer>
    </Sheet>
  );
}
