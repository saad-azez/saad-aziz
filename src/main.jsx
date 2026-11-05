import { startSchemeClock } from './brand/scheme.js';
import { INTRO } from './brand/intro.js';
import { LITE } from './lib/device.js';
import { startLoader } from './components/loader/startLoader.js';
import { PERF, attachMonitor } from './lib/perf.js';
import './styles/global.css';

// This file is what a visitor downloads first, so it holds only what puts the loader on screen.
// Everything heavy (React, GSAP, Three) comes in through the import at the bottom, behind it.

// Day or night, by the clock at home (Islamabad) — set before the first paint.
startSchemeClock();
// The page always opens at the top: the introduction and the rope start from the word,
// never halfway through (which also meant drawing a moving rope on the very first frame).
// (A phone that threw the tab away, or a reload, comes back to where the reader was once the loader is done:
// lib/resume, HeroRoute.)
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.documentElement.classList.add('is-loading');

// With ?perf, the performance monitor first (lib/perf.js), so it sees everything from the loader on. Otherwise not fetched.
if (PERF) import('./lib/perfMonitor.js').then(m => attachMonitor(m.createMonitor())).catch(() => {}).then(boot);
else boot();

function boot() {
const loader = startLoader({ seen: INTRO.seen, lite: LITE });

// If the rest of the site cannot be fetched, try the page once more before saying so: never a blank page behind the loader.
const RETRIED = 'saad:load-retried';
import('./app/start.jsx').then(({ start }) => {
  try { window.sessionStorage.removeItem(RETRIED); } catch { /* storage off */ }
  start(loader);
}).catch(() => {
  let retried = true;
  try {
    retried = window.sessionStorage.getItem(RETRIED) === '1';
    window.sessionStorage.setItem(RETRIED, '1');
  } catch { /* storage off: no second try, so it can never reload for ever */ }
  if (!retried) { window.location.reload(); return; }
  const root = document.getElementById('root');
  root.className = 'load-failed';
  root.textContent = "The page didn't load. Please check your connection and try again.";
  loader.ready();
  loader.onFinish(() => document.documentElement.classList.remove('is-loading'));
});
}
