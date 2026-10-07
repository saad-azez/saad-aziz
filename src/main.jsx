import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { startSchemeClock } from './brand/scheme.js';
import { startSmoothScroll } from './lib/smoothScroll.js';
import { keepPlace } from './lib/resume.js';
import './styles/global.css';

// Day or night, by the clock at home (Islamabad) — set before the first paint.
startSchemeClock();
// Smooth scrolling, started before anything that reads the scroll joins the ticker.
startSmoothScroll();
// The page always opens at the top: the introduction and the rope start from the word,
// never halfway through (which also meant drawing a moving rope on the very first frame).
// (A phone that threw the tab away, or a reload, comes back to where the reader was once the loader is done:
// lib/resume, HeroRoute.)
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
keepPlace();

createRoot(document.getElementById('root')).render(<App />);
