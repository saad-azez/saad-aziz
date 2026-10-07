import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Rails from '../components/hero/Rails.jsx';
import PullCord from '../components/cord/PullCord.jsx';
import Journey from '../components/journey/Journey.jsx';
import About from '../components/about/About.jsx';
import Contact from '../components/contact/Contact.jsx';
import SiteHeader from '../components/header/SiteHeader.jsx';
import CursorHint from '../components/ui/CursorHint.jsx';
import Stage from '../components/stage/Stage.jsx';
import Loader from '../components/loader/Loader.jsx';
import { createLoadTracker } from '../lib/loadTracker.js';
import { holdScroll, scrollToY } from '../lib/smoothScroll.js';
import { RESUME_Y } from '../lib/resume.js';
import { INTRO } from '../brand/intro.js';
import './HeroRoute.css';

export default function HeroRoute() {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  // The count is shorter for a reader who has been here before.
  const tracker = useMemo(() => createLoadTracker(INTRO.seen ? { minDuration: 800 } : undefined), []);
  useEffect(() => () => tracker.destroy(), [tracker]);

  const onReady = useCallback(() => tracker.set('hero', 1), [tracker]);
  const onReveal = useCallback(() => setRevealed(true), []);
  const onFinish = useCallback(() => setLoading(false), []);

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
      {loading && <Loader tracker={tracker} onReveal={onReveal} onFinish={onFinish} />}
    </>
  );
}
