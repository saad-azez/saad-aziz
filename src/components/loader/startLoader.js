import LoaderWorker from './loader.worker.js?worker&inline';
import { LoaderScene } from './LoaderScene.js';
import { reducedMotion } from './reducedMotion.js';
import './Loader.css';

/**
 * Puts the loader up, before any of the rest of the site has been fetched, and
 * gives the page its handle on it: `progress(0-1)`, `ready()`, `onReveal(fn)`,
 * `onFinish(fn)`.
 *
 * Three ways to run, each the fallback of the one before, so there is always a
 * way off the loader:
 * 1. In a worker, on an OffscreenCanvas: untouched by anything on the main thread.
 *    (The worker is inlined as a blob: a page cannot start a worker from another
 *    domain, which is where the site's files are served from on Webflow.)
 * 2. The same scene on the main thread, where a browser has no OffscreenCanvas.
 * 3. No WebGL at all: a plain cover in the ground colour, which fades away.
 */

/** How long before the page is let out regardless, if the scene never answers (a dead worker, say). */
const FAILSAFE = 20000;
const STARTUP = 2500;

function colour(probe, name) {
  probe.style.color = `var(${name})`;
  const [r, g, b] = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
  return [r / 255, g / 255, b / 255];
}

function readOptions(root) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--gutter);font-size:var(--step-display);line-height:0';
  root.append(probe);
  const display = parseFloat(getComputedStyle(probe).fontSize);
  const gutter = probe.getBoundingClientRect().width;
  probe.style.fontSize = 'var(--step-unit)';
  const unit = parseFloat(getComputedStyle(probe).fontSize);
  const colours = {
    glow: colour(probe, '--ground-glow'), ground: colour(probe, '--ground'), edge: colour(probe, '--ground-edge'),
    ink: colour(probe, '--ink'), accent: colour(probe, '--accent'),
  };
  probe.remove();
  return { colours, metrics: { gutter, display, unit } };
}

export function startLoader({ seen = false, lite = false } = {}) {
  const root = document.createElement('div');
  root.className = 'loader';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-label', 'Loading Saad Aziz portfolio');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', '0');
  document.body.append(root);

  const size = () => ({
    width: root.clientWidth || innerWidth,
    height: root.clientHeight || innerHeight,
    dpr: Math.min(devicePixelRatio || 1, lite ? 1.5 : 2),
  });
  const options = { ...readOptions(root), ...size(), middle: innerHeight / 2, seen, reduced: reducedMotion };

  const handlers = { reveal: [], finish: [] };
  const happened = { reveal: false, finish: false };
  const fire = name => {
    if (happened[name]) return;
    happened[name] = true;
    handlers[name].forEach(fn => fn());
  };

  // What happened, in the page's time (ms), for lib/perf's report: how it ran, and when it heard what.
  const trail = [];
  const note = what => trail.push([Math.round(performance.now()), what]);
  let send = () => {};
  let scene = null, worker = null, started = false, readySaid = false, lastProgress = -1;
  let startupTimer = 0, failsafeTimer = 0;

  const clear = () => {
    clearTimeout(startupTimer); clearTimeout(failsafeTimer);
    window.removeEventListener('resize', onResize);
    worker?.terminate(); worker = null;
    scene?.stop(); scene = null;
    root.remove();
  };
  const finish = () => { fire('reveal'); clear(); fire('finish'); };

  // Nothing could draw the sheet: a plain cover, gone as soon as the page is ready.
  const plain = () => {
    if (root.classList.contains('loader--plain')) return;
    note('plain cover (no WebGL)');
    worker?.terminate(); worker = null;
    scene?.stop(); scene = null;
    root.querySelector('canvas')?.remove();
    root.classList.add('loader--plain');
    send = message => {
      if (message.type !== 'ready') return;
      fire('reveal');
      root.classList.add('loader--plain-out');
      setTimeout(() => { note('done'); window.dispatchEvent(new CustomEvent('loader:done', { detail: { plain: true, trail } })); finish(); }, 320);
    };
    if (readySaid) send({ type: 'ready' });
  };

  const receive = message => {
    if (message.type === 'started') { started = true; clearTimeout(startupTimer); note(`started (${worker ? 'worker' : 'main thread'})`); }
    else if (message.type === 'count') root.setAttribute('aria-valuenow', String(message.value));
    else if (message.type === 'reveal') { note('rip'); fire('reveal'); }
    else if (message.type === 'failed') { note(worker ? 'worker failed: main thread' : 'failed'); if (worker) runOnMainThread(); else plain(); }
    else if (message.type === 'done') {
      note('done');
      window.dispatchEvent(new CustomEvent('loader:done', { detail: { ...message.stats, trail } }));
      finish();
    }
  };

  const canvasElement = () => {
    root.querySelector('canvas')?.remove();
    const canvas = document.createElement('canvas');
    canvas.className = 'loader__stage';
    canvas.setAttribute('aria-hidden', 'true');
    root.append(canvas);
    return canvas;
  };

  const replay = () => {
    if (lastProgress >= 0) send({ type: 'progress', value: lastProgress });
    if (readySaid) send({ type: 'ready' });
  };

  function runOnMainThread() {
    worker?.terminate(); worker = null;
    clearTimeout(startupTimer);
    try {
      scene = new LoaderScene(canvasElement(), receive, options);
      send = message => {
        if (message.type === 'progress') scene?.setProgress(message.value);
        else if (message.type === 'ready') scene?.setReady();
        else if (message.type === 'resize') scene?.resize(message.size);
      };
      scene.start();
      replay();
    } catch {
      plain();
    }
  }

  const onResize = () => send({ type: 'resize', size: size() });
  window.addEventListener('resize', onResize);

  const canWork = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
    && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  if (canWork) {
    try {
      worker = new LoaderWorker();
      worker.onmessage = event => receive(event.data);
      worker.onerror = () => runOnMainThread();
      const canvas = canvasElement().transferControlToOffscreen();
      worker.postMessage({ type: 'init', canvas, options }, [canvas]);
      send = message => worker?.postMessage(message);
      note('worker created');
      // A worker that never answers: the main thread takes over.
      startupTimer = setTimeout(() => { if (!started && worker) { note('worker silent: main thread'); runOnMainThread(); } }, STARTUP);
    } catch {
      runOnMainThread();
    }
  } else {
    runOnMainThread();
  }

  // Whatever else goes wrong, the page is never left behind the sheet. (A hidden tab draws nothing,
  // so the time only counts while it can be seen.)
  const failsafe = () => {
    if (document.hidden) failsafeTimer = setTimeout(failsafe, 1000);
    else { note('failsafe: never finished'); window.dispatchEvent(new CustomEvent('loader:done', { detail: { failsafe: true, trail } })); finish(); }
  };
  failsafeTimer = setTimeout(failsafe, FAILSAFE);

  return {
    progress(value) {
      if (value <= lastProgress) return;
      if (lastProgress < 0) note('first progress');
      lastProgress = value;
      send({ type: 'progress', value });
    },
    ready() {
      if (readySaid) return;
      readySaid = true;
      note('page ready');
      send({ type: 'ready' });
    },
    onReveal(fn) { if (happened.reveal) fn(); else handlers.reveal.push(fn); },
    onFinish(fn) { if (happened.finish) fn(); else handlers.finish.push(fn); },
  };
}
