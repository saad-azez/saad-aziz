import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Rails from '../components/hero/Rails.jsx';
import Hero from '../components/hero/Hero.jsx';
import Loader from '../components/loader/Loader.jsx';
import { createLoadTracker } from '../lib/loadTracker.js';
import './HeroRoute.css';

export default function HeroRoute() {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const tracker = useMemo(() => {
    const hold = Number(new URLSearchParams(window.location.search).get('loader'));
    return createLoadTracker(Number.isFinite(hold) && hold > 0 ? { minDuration: hold } : undefined);
  }, []);
  useEffect(() => () => tracker.destroy(), [tracker]);

  const onReady = useCallback(() => tracker.set('hero', 1), [tracker]);
  const onReveal = useCallback(() => setRevealed(true), []);
  const onFinish = useCallback(() => setLoading(false), []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('is-loading', loading);
  }, [loading]);

  return (
    <>
      <Rails visible={revealed} />
      <main className="site-shell" id="top">
        <Hero reveal={revealed} animateText={!loading} onReady={onReady} />
      </main>
      {loading && <Loader tracker={tracker} onReveal={onReveal} onFinish={onFinish} />}
    </>
  );
}
