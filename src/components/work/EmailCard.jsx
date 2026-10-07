import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PERSON } from '../../content/site.js';
import RingButton from '../ui/RingButton.jsx';
import './EmailCard.css';

const SUBJECT = 'Hello Saad';
/** The mail the reader's own app opens with: to Saad, the subject filled in. */
export const MAILTO = `mailto:${PERSON.email}?subject=${encodeURIComponent(SUBJECT)}`;
const TO = encodeURIComponent(PERSON.email), SU = encodeURIComponent(SUBJECT);
/** The same mail written in Gmail in the browser, for whoever has no mail app set up. */
const GMAIL = `https://mail.google.com/mail/?view=cm&fs=1&to=${TO}&su=${SU}`;
/**
 * The same mail in the Outlook app (its own link, ms-outlook:, which the app
 * registers where it is installed), and in Outlook on the web where it is not.
 */
const OUTLOOK_APP = `ms-outlook://compose?to=${TO}&subject=${SU}`;
const OUTLOOK_WEB = `https://outlook.live.com/mail/0/deeplink/compose?to=${TO}&subject=${SU}`;
/** How long a mail app has to take the page's focus before the card offers the browser instead (ms). */
const WAIT = 1200;

/** Copy `text`: the clipboard where the browser allows it, else the old way, through a selected field. */
export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(field);
    field.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { /* nothing to fall back to */ }
    field.remove();
    return done;
  }
}

/**
 * The card that opens where the reader clicked Saad's email on the book: the
 * address, and two ways to use it. "Write an email" opens their own mail app
 * (Mail on a Mac, Outlook, Gmail on a phone) with the subject filled in; if
 * none takes the page's focus within WAIT (no mail app is set up, as on many
 * Windows machines), it offers Gmail in the browser, or the Outlook app (and,
 * if that does not open either, Outlook on the web). "Copy address" puts it on their clipboard. It closes with Escape, a click outside it, or the page scrolling on
 * (not the smooth scroll's own last few pixels of settling).
 *
 * `at`: where it opens ({ x, y }, px on the screen), or null for closed.
 */
export default function EmailCard({ at, onClose }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  /** 'waiting' after "Write an email", until a mail app opens; 'none' when none did. */
  const [mail, setMail] = useState(null);
  const mailTimer = useRef(0);
  /** The Outlook button: 'trying' the app, 'web' once it has not opened (it then links to Outlook on the web). */
  const [outlook, setOutlook] = useState(null);

  /**
   * Hand `href` to whatever app on the reader's machine opens it. An app opening takes the page's focus: then
   * `opened` (the card closes); if nothing has within WAIT, `missed`.
   */
  const tryApp = (href, missed) => {
    clearTimeout(mailTimer.current);
    const opened = () => { clearTimeout(mailTimer.current); window.removeEventListener('blur', opened); onClose(); };
    window.addEventListener('blur', opened);
    window.location.href = href;
    mailTimer.current = setTimeout(() => {
      window.removeEventListener('blur', opened);
      missed();
      // A browser that asks first ("Open Outlook?") may still hand it on: the card closes when it does.
      window.addEventListener('blur', onClose, { once: true });
    }, WAIT);
  };

  // Opened from the click itself, so the link is still on the page when the browser follows it (it does not
  // follow one that has gone). A mail app opening takes the page's focus: then the card closes.
  const writeEmail = event => {
    event.preventDefault();
    setMail('waiting');
    tryApp(MAILTO, () => setMail('none'));
  };
  // The Outlook app first; the second click, once it has not opened, goes to Outlook on the web (the link's own).
  const writeOutlook = event => {
    if (outlook === 'web') { setTimeout(onClose, 0); return; }
    event.preventDefault();
    setOutlook('trying');
    tryApp(OUTLOOK_APP, () => setOutlook('web'));
  };
  useEffect(() => () => { clearTimeout(mailTimer.current); window.removeEventListener('blur', onClose); }, [onClose]);

  useEffect(() => {
    if (!at) return undefined;
    setCopied(false);
    setMail(null);
    setOutlook(null);
    const from = window.scrollY;
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && ref.current?.contains(event.target)) return;
      if (event.type === 'scroll' && Math.abs(window.scrollY - from) < 40) return;
      onClose();
    };
    // After the click that opened it has finished.
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('keydown', close);
      window.addEventListener('scroll', close, { passive: true });
    });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close);
    };
  }, [at, onClose]);

  if (!at) return null;
  // Kept on the screen, whichever corner it was opened near.
  const width = Math.min(360, window.innerWidth - 32), height = mail === 'none' ? 230 : 150, margin = 16;
  const left = Math.min(Math.max(margin, at.x - width / 2), window.innerWidth - width - margin);
  const top = at.y + 18 + height > window.innerHeight - margin ? at.y - height - 18 : at.y + 18;

  // On the page itself, over the stage's canvas (which lies over everything in the work).
  return createPortal(
    <div className="email-card" ref={ref} role="dialog" aria-label="Email Saad" style={{ left, top, width }}>
      <p className="email-card__label">Write to me</p>
      <p className="email-card__address">{PERSON.email}</p>
      <div className="email-card__actions">
        <RingButton href={MAILTO} onClick={writeEmail} arrow>{mail === 'waiting' ? 'Opening…' : 'Write an email'}</RingButton>
        <RingButton as="button" className="email-card__copy" aria-live="polite"
          onClick={async () => { if (await copy(PERSON.email)) setCopied(true); }}>
          {copied ? 'Copied ✓' : 'Copy address'}
        </RingButton>
      </div>
      {mail === 'none' && (
        <div className="email-card__web">
          <p className="email-card__hint">{outlook === 'web' ? 'Outlook didn’t open? Use it on the web:' : 'No mail app opened? Try one of these:'}</p>
          <div className="email-card__actions">
            <RingButton href={GMAIL} target="_blank" rel="noreferrer" onClick={() => setTimeout(onClose, 0)} arrow>Gmail</RingButton>
            {outlook === 'web'
              ? <RingButton href={OUTLOOK_WEB} target="_blank" rel="noreferrer" onClick={writeOutlook} arrow>Outlook on the web</RingButton>
              : <RingButton href={OUTLOOK_APP} onClick={writeOutlook} arrow>{outlook === 'trying' ? 'Opening…' : 'Outlook app'}</RingButton>}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
