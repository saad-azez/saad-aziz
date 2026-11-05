import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Rails from '../components/hero/Rails.jsx';
import PullCord from '../components/cord/PullCord.jsx';
import Journey from '../components/journey/Journey.jsx';
import About from '../components/about/About.jsx';
import Contact from '../components/contact/Contact.jsx';
import SiteHeader from '../components/header/SiteHeader.jsx';
import CursorHint from '../components/ui/CursorHint.jsx';
import Stage from '../components/stage/Stage.jsx';
import { createLoadTracker } from '../lib/loadTracker.js';
import { holdScroll, scrollToY } from '../lib/smoothScroll.js';
import { RESUME_Y } from '../lib/resume.js';
import './HeroRoute.css';

/** Once the page has been painted and the main thread has caught its breath (but not for long). */
function whenQuiet(then) {
  const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 200));
  requestAnimationFrame(() => requestAnimationFrame(() => idle(then, { timeout: 1200 })));
}

export default function HeroRoute({ loader }) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const tracker = useMemo(() => createLoadTracker(), []);
  useEffect(() => () => tracker.destroy(), [tracker]);

  const onReady = useCallback(() => tracker.set('hero', 1), [tracker]);

  // The loader is already up, in its own thread (main.jsx). It hears how the page is getting on,
  // and starts the rip once the page has been painted underneath, so there is something to tear open onto.
  useEffect(() => {
    loader.onReveal(() => setRevealed(true));
    loader.onFinish(() => setLoading(false));
    tracker.set('boot', 1);
    return tracker.subscribe((progress, settled) => {
      loader.progress(progress);
      if (settled) whenQuiet(() => loader.ready());
    });
  }, [loader, tracker]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('is-loading', loading);
    holdScroll(loading);
    // Back where the reader was, if the phone threw the tab away (or it was reloaded) in this visit: lib/resume.
    if (!loading && RESUME_Y != null) scrollToY(RESUME_Y, { immediate: true });
  }, [loading]);

  return (
    <>
      <Rails visible={revealed} />
      <PullCord visible={revealed} />
      <SiteHeader visible={revealed} animate={!loading} />
      <main className="site-shell" id="top">
        <Journey reveal={revealed} animateText={!loading} onReady={onReady} />
        <About />
        <Contact />
      </main>
      <Stage />
      <CursorHint />
    </>
  );
}
