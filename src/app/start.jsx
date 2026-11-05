import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startSmoothScroll } from '../lib/smoothScroll.js';
import { keepPlace } from '../lib/resume.js';
import gsap from 'gsap';
import { perf } from '../lib/perf.js';

/** The site itself: fetched after the loader is up (main.jsx). */
export function start(loader) {
  // (?perf: GSAP's listeners and tweens timed from the first one.)
  perf.gsap(gsap);
  // Smooth scrolling, started before anything that reads the scroll joins the ticker.
  startSmoothScroll();
  keepPlace();
  createRoot(document.getElementById('root')).render(<App loader={loader} />);
}
